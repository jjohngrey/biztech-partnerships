import { redirect } from "next/navigation";
import { CrmShell } from "@/components/crm-shell";
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
    <CrmShell
      displayName={displayName}
      email={user.email ?? undefined}
    />
  );
}
