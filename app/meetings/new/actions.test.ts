import { describe, it, expect } from "vitest";
import { createMeetingNoteSchema } from "./actions";

// Zod v4 requires proper UUID format: version bits [1-8] and variant bits [89ab]
const PARTNER_UUID = "00000000-0000-4000-8000-000000000001";
const ATTENDEE_UUID = "00000000-0000-4000-8000-000000000002";

const validPayload = {
  title: "Intro call with Accenture",
  meetingDate: "2026-05-02",
  content: "We discussed the sponsorship package and timeline.",
  source: "paste" as const,
  partnerIds: [PARTNER_UUID],
  biztechAttendeeIds: [ATTENDEE_UUID],
  eventIds: [],
};

describe("createMeetingNoteSchema", () => {
  it("parses a valid payload successfully", () => {
    const result = createMeetingNoteSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("fails when title is missing", () => {
    const result = createMeetingNoteSchema.safeParse({ ...validPayload, title: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      expect(fields.title).toBeDefined();
    }
  });

  it("fails when partnerIds is empty", () => {
    const result = createMeetingNoteSchema.safeParse({ ...validPayload, partnerIds: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      expect(fields.partnerIds).toBeDefined();
      expect(fields.partnerIds![0]).toMatch(/at least one partner/i);
    }
  });

  it("fails when biztechAttendeeIds is empty", () => {
    const result = createMeetingNoteSchema.safeParse({ ...validPayload, biztechAttendeeIds: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      expect(fields.biztechAttendeeIds).toBeDefined();
    }
  });

  it("fails when summary exceeds 500 characters", () => {
    const result = createMeetingNoteSchema.safeParse({
      ...validPayload,
      summary: "x".repeat(501),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      expect(fields.summary).toBeDefined();
    }
  });

  it("passes when summary is exactly 500 characters", () => {
    const result = createMeetingNoteSchema.safeParse({
      ...validPayload,
      summary: "x".repeat(500),
    });
    expect(result.success).toBe(true);
  });

  it("fails when content is empty", () => {
    const result = createMeetingNoteSchema.safeParse({ ...validPayload, content: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      expect(fields.content).toBeDefined();
      expect(fields.content![0]).toMatch(/required/i);
    }
  });

  it("fails when source is not in enum", () => {
    const result = createMeetingNoteSchema.safeParse({ ...validPayload, source: "granola" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      expect(fields.source).toBeDefined();
    }
  });

  it("accepts source='upload' with optional originalFilename", () => {
    const result = createMeetingNoteSchema.safeParse({
      ...validPayload,
      source: "upload",
      originalFilename: "notes.txt",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional summary when absent", () => {
    const { summary: _s, ...rest } = validPayload as typeof validPayload & { summary?: string };
    const result = createMeetingNoteSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });
});
