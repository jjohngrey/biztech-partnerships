import { CrmShell } from "@/components/crm-shell";
import { EventsDirectory } from "@/components/events-directory";
import { requireDisplayUser } from "@/lib/auth/session-display";
import { listCachedEvents, listCachedPartnerDirectory } from "@/lib/partnerships/cached";

export default async function EventsPage({
  searchParams,
}: {
  searchParams?: Promise<{ eventId?: string }>;
}) {
  const params = await searchParams;
  const [{ displayName }, events, partners] = await Promise.all([
    requireDisplayUser(),
    listCachedEvents(),
    listCachedPartnerDirectory(),
  ]);

  return (
    <CrmShell
      displayName={displayName}
      activeSection="events"
    >
      <EventsDirectory events={events} partners={partners} initialEventId={params?.eventId} />
    </CrmShell>
  );
}
