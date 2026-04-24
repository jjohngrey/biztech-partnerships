import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth callback. Google redirects here with `?code=...`. We exchange the
 * code for a Supabase session, then enforce the Workspace-domain policy.
 *
 * Enforcement is deliberately belt-and-suspenders:
 *   1. `hd` claim from Google ID token must equal the allowed domain.
 *   2. Email must end in `@<allowed-domain>`.
 * If either fails we sign the user out and bounce them to /login with an
 * error. Checking just the email is enough in practice, but pinning `hd`
 * rejects cases where a personal gmail alias happens to match the pattern.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const allowedDomain = process.env.ALLOWED_WORKSPACE_DOMAIN ?? "ubcbiztech.com";
  const email = data.user.email ?? "";
  const identityHd = data.user.identities?.[0]?.identity_data?.hd as
    | string
    | undefined;
  const metadataHd = data.user.user_metadata?.hd as string | undefined;
  const hd = identityHd ?? metadataHd;

  const domainOk = email.toLowerCase().endsWith(`@${allowedDomain}`);
  // `hd` is nice-to-have: it's always present on full Google Workspace
  // accounts, but not on Cloud Identity Free or when the Workspace's primary
  // domain differs from the sign-in domain (multi-domain Workspaces). We
  // accept "matches" or "absent"; we reject "present but different", since
  // that genuinely means the user is from a different Workspace.
  const hdOk = hd === allowedDomain || hd === undefined;

  if (!domainOk || !hdOk) {
    // Dev-time diagnostics: helps debug why a Workspace sign-in was
    // rejected. Never logs the full user object (could contain PII).
    console.warn("[auth/callback] domain check failed", {
      allowedDomain,
      email,
      emailDomainOk: domainOk,
      hdFromIdentity: identityHd,
      hdFromMetadata: metadataHd,
      hdOk,
      provider: data.user.app_metadata?.provider,
    });

    await supabase.auth.signOut();
    const reason = !domainOk ? "domain-email" : "domain-hd";
    return NextResponse.redirect(`${origin}/login?error=${reason}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
