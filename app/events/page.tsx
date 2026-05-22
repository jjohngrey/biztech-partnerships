import { CrmShell } from "@/components/crm-shell";
import { EventsDirectory } from "@/components/events-directory";
import { requireDisplayUser } from "@/lib/auth/session-display";
import { listCachedEvents, listCachedPartnerDirectory, listCachedUsers } from "@/lib/partnerships/cached";

export default async function EventsPage({
  searchParams,
}: {
  searchParams?: Promise<{ eventId?: string }>;
}) {
  const params = await searchParams;
  const [{ displayName, role }, events, partners, directors] = await Promise.all([
    requireDisplayUser(),
    listCachedEvents(),
    listCachedPartnerDirectory(),
    listCachedUsers(),
  ]);

  return (
    <CrmShell
      displayName={displayName}
      activeSection="events"
      isAdmin={role === "admin"}
    >
      <EventsDirectory
        events={events}
        partners={partners}
        directors={directors}
        initialEventId={params?.eventId}
      />
    </CrmShell>
  );
}
