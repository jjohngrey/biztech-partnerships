import { z } from "zod";

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