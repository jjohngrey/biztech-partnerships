import { redirect } from "next/navigation";
import { resolveCrmUserForAuthUser } from "@/lib/auth/crm-user";
import { createClient } from "@/lib/supabase/server";

export async function requireDisplayUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const crmUser = await resolveCrmUserForAuthUser(user);

  return {
    id: crmUser.id,
    displayName: crmUser.name,
    email: crmUser.email,
  };
}
