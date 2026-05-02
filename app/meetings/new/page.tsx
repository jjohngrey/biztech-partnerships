import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getAllPartners,
  getAllUsers,
  getAllEvents,
} from "@/lib/db/queries/meeting-notes";
import { MeetingNoteForm } from "@/components/meetings/meeting-note-form";
import { createMeetingNote } from "./actions";

export default async function NewMeetingNotePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [allPartners, allUsers, allEvents] = await Promise.all([
    getAllPartners(),
    getAllUsers(),
    getAllEvents(),
  ]);

  const partners = allPartners.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    companyId: p.companyId ?? null,
    companyName: p.companyName ?? null,
  }));

  const users = allUsers.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
  }));

  const events = allEvents.map((e) => ({
    id: e.id,
    name: e.name,
    startDate: e.startDate,
    archived: e.archived,
  }));

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-semibold text-neutral-900">New Meeting Note</h1>
      <MeetingNoteForm
        partners={partners}
        users={users}
        events={events}
        currentUserId={user.id}
        action={createMeetingNote}
        cancelHref="/meetings"
      />
    </div>
  );
}
