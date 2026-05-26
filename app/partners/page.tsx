import { CrmShell } from "@/components/crm-shell";
import { PartnersDirectory } from "@/components/partnerships-directory";
import { requireDisplayUser } from "@/lib/auth/session-display";
import {
  listCachedCompanyDirectory,
  listCachedEvents,
  listCachedPartnerDirectoryPage,
  listCachedUsers,
} from "@/lib/partnerships/cached";

type PartnersPageProps = {
  searchParams?: Promise<{ partnerId?: string; page?: string }>;
};

export default async function PartnersPage({ searchParams }: PartnersPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params?.page ?? 1));
  const [{ id: currentUserId, displayName, role }, partnersResult, companies, events, users] = await Promise.all([
    requireDisplayUser(),
    listCachedPartnerDirectoryPage({ page }),
    listCachedCompanyDirectory(),
    listCachedEvents(),
    listCachedUsers(),
  ]);

  return (
    <CrmShell
      displayName={displayName}
      activeSection="partners"
      isAdmin={role === "admin"}
    >
      <PartnersDirectory
        partners={partnersResult.data}
        paginationMeta={partnersResult}
        companies={companies}
        events={events}
        users={users}
        initialPartnerId={params?.partnerId}
        currentUserId={currentUserId}
      />
    </CrmShell>
  );
}
