import { CrmShell } from "@/components/crm-shell";
import { OutreachDirectory } from "@/components/outreach-directory";
import { requireDisplayUser } from "@/lib/auth/session-display";
import { headers } from "next/headers";
import {
  getCachedEmailSyncSummary,
  listCachedEmailCampaigns,
  listCachedEmailRecipients,
  listCachedEmailTemplates,
  listCachedEvents,
  listCachedUsers,
} from "@/lib/partnerships/cached";

export default async function OutreachPage() {
  const [{ displayName }, templates, recipients, campaigns, events, users, syncSummary] =
    await Promise.all([
      requireDisplayUser(),
      listCachedEmailTemplates(),
      listCachedEmailRecipients(),
      listCachedEmailCampaigns(),
      listCachedEvents(),
      listCachedUsers(),
      getCachedEmailSyncSummary(),
    ]);
  const headerStore = await headers();
  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const siteUrl = host
    ? `${proto}://${host}`
    : process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return (
    <CrmShell
      displayName={displayName}
      activeSection="outreach"
    >
      <OutreachDirectory
        templates={templates}
        recipients={recipients}
        campaigns={campaigns}
        events={events}
        users={users}
        syncSummary={syncSummary}
        syncIngestUrl={`${siteUrl}/api/partnerships/email/sync/ingest`}
      />
    </CrmShell>
  );
}
