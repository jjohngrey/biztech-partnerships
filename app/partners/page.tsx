import { CrmShell } from "@/components/crm-shell";
import { PartnersDirectory } from "@/components/partnerships-directory";
import { requireDisplayUser } from "@/lib/auth/session-display";
import {
  listCachedCompanyDirectory,
  listCachedEvents,
  listCachedPartnerDirectory,
  listCachedUsers,
} from "@/lib/partnerships/cached";

type PartnersPageProps = {
  searchParams?: Promise<{ partnerId?: string }>;
};

export default async function PartnersPage({ searchParams }: PartnersPageProps) {
  const params = await searchParams;
  const [{ displayName }, partners, companies, events, users] = await Promise.all([
    requireDisplayUser(),
    listCachedPartnerDirectory(),
    listCachedCompanyDirectory(),
    listCachedEvents(),
    listCachedUsers(),
  ]);

  return (
    <CrmShell
      displayName={displayName}
      activeSection="partners"
    >
      <PartnersDirectory
        partners={partners}
        companies={companies}
        events={events}
        users={users}
        initialPartnerId={params?.partnerId}
      />
    </CrmShell>
  );
}
