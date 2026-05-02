"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  meetingNotes,
  meetingNotePartners,
  meetingNoteAttendees,
  meetingNoteEvents,
} from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";

export const createMeetingNoteSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be 200 characters or fewer"),
  meetingDate: z.string().min(1, "Meeting date is required"),
  summary: z.string().max(500, "Summary must be 500 characters or fewer").optional(),
  content: z.string().min(1, "Note content is required"),
  source: z.enum(["upload", "paste"]),
  originalFilename: z.string().optional(),
  partnerIds: z
    .array(z.string().uuid())
    .min(1, "At least one partner attendee is required"),
  biztechAttendeeIds: z
    .array(z.string().uuid())
    .min(1, "At least one BizTech attendee is required"),
  eventIds: z.array(z.string().uuid()),
});

export type CreateMeetingNoteSchema = z.infer<typeof createMeetingNoteSchema>;

export type ActionState = {
  errors?: Partial<Record<keyof CreateMeetingNoteSchema, string[]>>;
  error?: string;
} | null;

export async function createMeetingNote(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const raw = {
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

  const parsed = createMeetingNoteSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as ActionState["errors"] };
  }

  const { title, meetingDate, summary, content, source, originalFilename, partnerIds, biztechAttendeeIds, eventIds } =
    parsed.data;

  let noteId: string;

  await db.transaction(async (tx) => {
    const [note] = await tx
      .insert(meetingNotes)
      .values({
        title,
        meetingDate: new Date(meetingDate),
        summary: summary ?? null,
        content,
        source,
        originalFilename: originalFilename ?? null,
        createdBy: user.id,
      })
      .returning({ id: meetingNotes.id });

    noteId = note.id;

    if (partnerIds.length > 0) {
      await tx.insert(meetingNotePartners).values(
        partnerIds.map((pid) => ({ meetingNoteId: note.id, partnerId: pid }))
      );
    }

    if (biztechAttendeeIds.length > 0) {
      await tx.insert(meetingNoteAttendees).values(
        biztechAttendeeIds.map((uid) => ({ meetingNoteId: note.id, userId: uid }))
      );
    }

    if (eventIds.length > 0) {
      await tx.insert(meetingNoteEvents).values(
        eventIds.map((eid) => ({ meetingNoteId: note.id, eventId: eid }))
      );
    }
  });

  redirect(`/meetings/${noteId!}`);
}
