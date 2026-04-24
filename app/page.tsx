import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Home page. The middleware already redirects unauthenticated users to
 * /login, but we re-check here so this file is safe to reason about in
 * isolation and so we have a typed `user` to render from.
 */
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Google identities populate `user_metadata.full_name` and `.name`.
  // Fall back to email's local part, then to email.
  const metadata = user.user_metadata ?? {};
  const displayName =
    (metadata.full_name as string | undefined) ??
    (metadata.name as string | undefined) ??
    user.email?.split("@")[0] ??
    user.email ??
    "there";

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Hi, {displayName}.
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          You're signed in as {user.email}.
        </p>

        <form action="/auth/signout" method="post" className="mt-6">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
