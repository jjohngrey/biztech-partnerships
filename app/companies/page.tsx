import { CrmShell } from "@/components/crm-shell";
import { CompaniesClient } from "./companies-client";
import { requireDisplayUser } from "@/lib/auth/session-display";
import {
  listCachedCompanyDirectoryPage,
  listCachedEvents,
  listCachedMeetingLogs,
  listCachedPartnerDirectory,
  listCachedUsers,
} from "@/lib/partnerships/cached";

type CompaniesPageProps = {
  searchParams?: Promise<{ companyId?: string; page?: string }>;
};

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params?.page ?? 1));
  const [{ id: currentUserId, displayName, role }, companiesResult, events, users, partners, meetings] = await Promise.all([
    requireDisplayUser(),
    listCachedCompanyDirectoryPage({ page }),
    listCachedEvents(),
    listCachedUsers(),
    listCachedPartnerDirectory(),
    listCachedMeetingLogs(),
  ]);

  return (
    <CrmShell
      displayName={displayName}
      activeSection="companies"
      isAdmin={role === "admin"}
    >
      <CompaniesClient
        companiesResult={companiesResult}
        events={events}
        users={users}
        partners={partners}
        meetings={meetings}
        initialCompanyId={params?.companyId}
        currentUserId={currentUserId}
      />
    </CrmShell>
  );
}
