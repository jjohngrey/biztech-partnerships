"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Server action triggered by the "Sign in with Google" button on /login.
 *
 * We pass `hd=ubcbiztech.com` as a Google OAuth query param so Google's
 * account chooser restricts the picker to Workspace accounts in that
 * domain. This is UX only — a determined user could bypass it by editing
 * the URL, so the real enforcement happens server-side in the /auth/callback
 * route handler.
 */
export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "";
  const allowedDomain = process.env.ALLOWED_WORKSPACE_DOMAIN ?? "ubcbiztech.com";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        hd: allowedDomain,
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  if (data?.url) {
    redirect(data.url);
  }

  redirect("/login?error=unknown");
}
