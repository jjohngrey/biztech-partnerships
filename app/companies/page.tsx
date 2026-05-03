import { CrmShell } from "@/components/crm-shell";
import { CompaniesClient } from "./companies-client";
import { requireDisplayUser } from "@/lib/auth/session-display";
import {
  listCachedCompanyDirectory,
  listCachedEvents,
  listCachedMeetingLogs,
  listCachedPartnerDirectory,
  listCachedUsers,
} from "@/lib/partnerships/cached";

type CompaniesPageProps = {
  searchParams?: Promise<{ companyId?: string }>;
};

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  const params = await searchParams;
  const [{ displayName }, companies, events, users, partners, meetings] = await Promise.all([
    requireDisplayUser(),
    listCachedCompanyDirectory(),
    listCachedEvents(),
    listCachedUsers(),
    listCachedPartnerDirectory(),
    listCachedMeetingLogs(),
  ]);

  return (
    <CrmShell
      displayName={displayName}
      activeSection="companies"
    >
      <CompaniesClient
        companies={companies}
        events={events}
        users={users}
        partners={partners}
        meetings={meetings}
        initialCompanyId={params?.companyId}
      />
    </CrmShell>
  );
}
