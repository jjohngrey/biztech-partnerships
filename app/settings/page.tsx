import { CrmShell } from "@/components/crm-shell";
import { SettingsDirectory } from "@/components/settings-directory";
import { requireDisplayUser } from "@/lib/auth/session-display";
import { listCachedUsers } from "@/lib/partnerships/cached";

export default async function SettingsPage() {
  const [{ displayName }, directors] = await Promise.all([
    requireDisplayUser(),
    listCachedUsers(),
  ]);

  return (
    <CrmShell displayName={displayName} activeSection="settings">
      <SettingsDirectory directors={directors} />
    </CrmShell>
  );
}
