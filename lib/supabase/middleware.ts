import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs on every matched request. Two jobs:
 *   1. Refresh the Supabase session cookie if it's close to expiring.
 *   2. Redirect unauthenticated users away from protected routes.
 *
 * Public routes: /login, /auth/*, and Next.js internals (excluded by the
 * matcher in middleware.ts).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/auth") ||
    pathname === "/api/google/callback" ||
    pathname === "/api/partnerships/email/sync/ingest" ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  // Supabase falls back to the configured Site URL when a redirect URL is not
  // allowed. That can land OAuth codes on `/` or `/login`; route those codes
  // back through our real exchange handler instead of treating them as normal
  // page requests.
  if (request.nextUrl.searchParams.has("code") && !pathname.startsWith("/auth")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    url.searchParams.delete("redirectedFrom");
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // IMPORTANT: use getUser(), not getSession(). getUser() revalidates the
  // token against Supabase and is safe to rely on for auth checks.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
