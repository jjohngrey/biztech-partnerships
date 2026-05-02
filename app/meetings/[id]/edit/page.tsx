import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getMeetingNoteForEdit,
  getAllPartners,
  getAllUsers,
  getAllEvents,
} from "@/lib/db/queries/meeting-notes";
import { MeetingNoteForm } from "@/components/meetings/meeting-note-form";
import { updateMeetingNote } from "./actions";

export default async function EditMeetingNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [note, allPartners, allUsers, allEvents] = await Promise.all([
    getMeetingNoteForEdit(id, user.id),
    getAllPartners(),
    getAllUsers(),
    getAllEvents(),
  ]);

  if (!note) notFound();

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

  const partnerAttendees = note.partnersByCompany.flatMap((c) => c.partners.map((p) => p.id));
  const noCompanyPartnerIds = note.noCompanyPartners.map((p) => p.id);

  // Wrap action to inject note ID
  async function updateAction(prev: Parameters<typeof updateMeetingNote>[0], formData: FormData) {
    "use server";
    formData.set("id", id);
    return updateMeetingNote(prev, formData);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-semibold text-neutral-900">Edit Meeting Note</h1>
      <MeetingNoteForm
        partners={partners}
        users={users}
        events={events}
        currentUserId={user.id}
        action={updateAction}
        cancelHref={`/meetings/${id}`}
        defaultValues={{
          title: note.title,
          meetingDate: note.meetingDate.toISOString(),
          summary: note.summary ?? undefined,
          content: note.content,
          source: note.source as "upload" | "paste",
          originalFilename: note.originalFilename ?? undefined,
          partnerIds: [...partnerAttendees, ...noCompanyPartnerIds],
          biztechAttendeeIds: note.attendees.map((a) => a.userId),
          eventIds: note.events.map((e) => e.eventId),
        }}
      />
    </div>
  );
}
