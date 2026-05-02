"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  meetingNotes,
  meetingNotePartners,
  meetingNoteAttendees,
  meetingNoteEvents,
} from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { createMeetingNoteSchema, type ActionState } from "@/app/meetings/new/actions";

const updateMeetingNoteSchema = createMeetingNoteSchema.extend({
  id: z.string().uuid(),
});

export async function updateMeetingNote(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const raw = {
    id: formData.get("id"),
    title: formData.get("title"),
    meetingDate: formData.get("meetingDate"),
    summary: formData.get("summary") || undefined,
    content: formData.get("content"),
    source: formData.get("source"),
    originalFilename: formData.get("originalFilename") || undefined,
    partnerIds: formData.getAll("partnerIds"),
    biztechAttendeeIds: formData.getAll("biztechAttendeeIds"),
    eventIds: formData.getAll("eventIds"),
  };

  const parsed = updateMeetingNoteSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as ActionState["errors"] };
  }

  const { id, title, meetingDate, summary, content, source, originalFilename, partnerIds, biztechAttendeeIds, eventIds } =
    parsed.data;

  // Authorization check (belt-and-suspenders; RLS is authoritative)
  const [existing] = await db
    .select({ createdBy: meetingNotes.createdBy })
    .from(meetingNotes)
    .where(eq(meetingNotes.id, id));

  if (!existing) return { error: "Note not found." };
  if (existing.createdBy !== user.id) return { error: "Not authorized." };

  await db.transaction(async (tx) => {
    // Delete-then-insert join rows
    await tx.delete(meetingNotePartners).where(eq(meetingNotePartners.meetingNoteId, id));
    await tx.delete(meetingNoteAttendees).where(eq(meetingNoteAttendees.meetingNoteId, id));
    await tx.delete(meetingNoteEvents).where(eq(meetingNoteEvents.meetingNoteId, id));

    if (partnerIds.length > 0) {
      await tx.insert(meetingNotePartners).values(
        partnerIds.map((pid) => ({ meetingNoteId: id, partnerId: pid }))
      );
    }
    if (biztechAttendeeIds.length > 0) {
      await tx.insert(meetingNoteAttendees).values(
        biztechAttendeeIds.map((uid) => ({ meetingNoteId: id, userId: uid }))
      );
    }
    if (eventIds.length > 0) {
      await tx.insert(meetingNoteEvents).values(
        eventIds.map((eid) => ({ meetingNoteId: id, eventId: eid }))
      );
    }

    await tx
      .update(meetingNotes)
      .set({
        title,
        meetingDate: new Date(meetingDate),
        summary: summary ?? null,
        content,
        source,
        originalFilename: originalFilename ?? null,
        updatedAt: new Date(),
      })
      .where(eq(meetingNotes.id, id));
  });

  redirect(`/meetings/${id}`);
}

export async function deleteMeetingNote(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [existing] = await db
    .select({ createdBy: meetingNotes.createdBy })
    .from(meetingNotes)
    .where(eq(meetingNotes.id, id));

  if (!existing || existing.createdBy !== user.id) return;

  await db.delete(meetingNotes).where(eq(meetingNotes.id, id));

  redirect("/meetings");
}
