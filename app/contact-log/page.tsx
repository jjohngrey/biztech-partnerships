import { CrmShell } from "@/components/crm-shell";
import { TouchpointsDirectory } from "@/components/touchpoints-directory";
import { requireDisplayUser } from "@/lib/auth/session-display";
import {
  listCachedCompanyDirectory,
  listCachedEvents,
  listCachedMeetingLogs,
  listCachedPartnerDirectory,
  listCachedTouchpoints,
  listCachedUsers,
} from "@/lib/partnerships/cached";

export default async function ContactLogPage({
  searchParams,
}: {
  searchParams?: Promise<{ activity?: string; create?: string; company?: string; contact?: string; event?: string }>;
}) {
  const params = await searchParams;
  const [{ displayName }, touchpoints, meetings, companies, partners, users, events] = await Promise.all([
    requireDisplayUser(),
    listCachedTouchpoints(),
    listCachedMeetingLogs(),
    listCachedCompanyDirectory(),
    listCachedPartnerDirectory(),
    listCachedUsers(),
    listCachedEvents(),
  ]);

  return (
    <CrmShell
      displayName={displayName}
      activeSection="touchpoints"
    >
      <TouchpointsDirectory
        touchpoints={touchpoints}
        meetings={meetings}
        companies={companies}
        partners={partners}
        users={users}
        events={events}
        initialActivityKey={params?.activity}
        initialCreate={params?.create === "1"}
        initialCompanyName={params?.company}
        initialContactName={params?.contact}
        initialEventName={params?.event}
      />
    </CrmShell>
  );
}
