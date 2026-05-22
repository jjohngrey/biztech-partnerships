import { CrmShell } from "@/components/crm-shell";
import { OutreachDirectory } from "@/components/outreach-directory";
import { requireDisplayUser } from "@/lib/auth/session-display";
import { headers } from "next/headers";
import {
  getCachedEmailSyncSummary,
  listCachedEmailCampaigns,
  listCachedEmailRecipientsPage,
  listCachedEmailTemplates,
  listCachedEvents,
  listCachedUsers,
} from "@/lib/partnerships/cached";

type OutreachPageProps = {
  searchParams?: Promise<{ page?: string; search?: string }>;
};

export default async function OutreachPage({ searchParams }: OutreachPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params?.page ?? 1));
  const search = params?.search ?? "";
  const [{ displayName, role }, templates, recipientsResult, campaigns, events, users, syncSummary] =
    await Promise.all([
      requireDisplayUser(),
      listCachedEmailTemplates(),
      listCachedEmailRecipientsPage({ page, search }),
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
      isAdmin={role === "admin"}
    >
      <OutreachDirectory
        templates={templates}
        recipientsResult={recipientsResult}
        campaigns={campaigns}
        events={events}
        users={users}
        syncSummary={syncSummary}
        syncIngestUrl={`${siteUrl}/api/partnerships/email/sync/ingest`}
      />
    </CrmShell>
  );
}
