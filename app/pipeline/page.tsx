import { CrmShell } from "@/components/crm-shell";
import { PipelineDirectory } from "@/components/pipeline-directory";
import { requireDisplayUser } from "@/lib/auth/session-display";
import {
  listCachedCurrentPipeline,
  listCachedCompanyDirectory,
  listCachedEvents,
  listCachedPartnerDirectory,
  listCachedUsers,
} from "@/lib/partnerships/cached";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams?: Promise<{ conversationId?: string }>;
}) {
  const params = await searchParams;
  const [{ displayName }, records, partners, users, companies, events] = await Promise.all([
    requireDisplayUser(),
    listCachedCurrentPipeline(),
    listCachedPartnerDirectory(),
    listCachedUsers(),
    listCachedCompanyDirectory(),
    listCachedEvents(),
  ]);

  return (
    <CrmShell
      displayName={displayName}
      activeSection="pipeline"
    >
      <PipelineDirectory
        records={records}
        partners={partners}
        users={users}
        companies={companies}
        events={events}
        initialConversationId={params?.conversationId}
      />
    </CrmShell>
  );
}
