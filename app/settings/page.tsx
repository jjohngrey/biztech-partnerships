import { redirect } from "next/navigation";
import { CrmShell } from "@/components/crm-shell";
import { SettingsDirectory } from "@/components/settings-directory";
import { requireDisplayUser } from "@/lib/auth/session-display";
import { listCachedUsers, listCachedYears } from "@/lib/partnerships/cached";

export default async function SettingsPage() {
  const [{ displayName, role }, directors, availableYears] = await Promise.all([
    requireDisplayUser(),
    listCachedUsers(),
    listCachedYears(),
  ]);

  if (role !== "admin") {
    redirect("/contact-log");
  }

  return (
    <CrmShell displayName={displayName} activeSection="settings" isAdmin>
      <SettingsDirectory directors={directors} availableYears={availableYears} />
    </CrmShell>
  );
}
