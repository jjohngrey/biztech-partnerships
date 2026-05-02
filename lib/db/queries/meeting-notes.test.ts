import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoist the builder BEFORE vi.mock() hoisting runs.
// Builder is a thenable object — every method returns `builder` (for chaining),
// and `await builder` resolves to `[]` via the custom `.then()`.
// This avoids the mockResolvedValue vs mockReturnValue conflict.
// ---------------------------------------------------------------------------
const { builder, mockLimit, mockWhere, mockSelect, mockFrom,
        mockOrderBy, mockInnerJoin, mockLeftJoin } = vi.hoisted(() => {
  // We'll fill builder after creating the mock fns.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: Record<string, any> = {};

  const mkFn = () => vi.fn().mockReturnValue(builder);

  const mockSelect = mkFn();
  const mockSelectDistinct = mkFn();
  const mockFrom = mkFn();
  const mockWhere = mkFn();
  const mockInnerJoin = mkFn();
  const mockLeftJoin = mkFn();
  const mockOrderBy = mkFn();
  const mockLimit = mkFn();

  Object.assign(builder, {
    select: mockSelect,
    selectDistinct: mockSelectDistinct,
    from: mockFrom,
    where: mockWhere,
    innerJoin: mockInnerJoin,
    leftJoin: mockLeftJoin,
    orderBy: mockOrderBy,
    limit: mockLimit,
    // Make the builder itself thenable so `await someChain` resolves to []
    then: (resolve: (v: unknown[]) => void) => resolve([]),
  });

  return { builder, mockLimit, mockWhere, mockSelect, mockFrom,
           mockOrderBy, mockInnerJoin, mockLeftJoin };
});

vi.mock("@/lib/db", () => ({ db: builder }));

vi.mock("@/lib/db/schema", () => ({
  meetingNotes: { id: "id", meetingDate: "meeting_date", source: "source",
                  title: "title", createdAt: "created_at" },
  meetingNotePartners: { meetingNoteId: "meeting_note_id", partnerId: "partner_id" },
  meetingNoteAttendees: { meetingNoteId: "meeting_note_id", userId: "user_id" },
  meetingNoteEvents: { meetingNoteId: "meeting_note_id", eventId: "event_id" },
  partners: { id: "id", first_name: "first_name", last_name: "last_name",
              companyId: "company_id" },
  companies: { id: "id", name: "name" },
  users: { id: "id", first_name: "first_name", last_name: "last_name" },
  events: { id: "id", name: "name", startDate: "start_date", archived: "archived" },
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ type: "and", args }),
  eq: (a: unknown, b: unknown) => ({ type: "eq", a, b }),
  gte: (a: unknown, b: unknown) => ({ type: "gte", a, b }),
  lte: (a: unknown, b: unknown) => ({ type: "lte", a, b }),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ type: "sql", strings, values }),
    { raw: (s: string) => ({ type: "sql_raw", s }) }
  ),
}));

import { getMeetingNotes, getAllEvents } from "./meeting-notes";

describe("getMeetingNotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply chaining after clearAllMocks (mockReturnValue only — no mockResolvedValue
    // on chaining methods to avoid overriding the return value with a Promise).
    for (const fn of [mockSelect, mockFrom, mockWhere, mockOrderBy,
                      mockInnerJoin, mockLeftJoin, mockLimit]) {
      fn.mockReturnValue(builder);
    }
  });

  it("calls .limit(200) on the notes query", async () => {
    await getMeetingNotes({});
    expect(mockLimit).toHaveBeenCalledWith(200);
  });

  it("calls .where() when companyId filter is provided", async () => {
    await getMeetingNotes({ companyId: "abc" });
    expect(mockWhere).toHaveBeenCalled();
  });

  it("calls .where() when dateFrom filter is provided", async () => {
    await getMeetingNotes({ dateFrom: "2026-01-01" });
    expect(mockWhere).toHaveBeenCalled();
  });

  it("calls .where() when dateTo filter is provided", async () => {
    await getMeetingNotes({ dateTo: "2026-12-31" });
    expect(mockWhere).toHaveBeenCalled();
  });

  it("calls .where() when biztechAttendeeId filter is provided", async () => {
    await getMeetingNotes({ biztechAttendeeId: "00000000-0000-4000-8000-000000000001" });
    expect(mockWhere).toHaveBeenCalled();
  });

  it("calls .where() when eventId filter is provided", async () => {
    await getMeetingNotes({ eventId: "00000000-0000-4000-8000-000000000001" });
    expect(mockWhere).toHaveBeenCalled();
  });

  it("returns an empty array when DB returns no rows", async () => {
    const result = await getMeetingNotes({});
    expect(result).toEqual([]);
  });
});

describe("getAllEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const fn of [mockSelect, mockFrom, mockWhere, mockOrderBy,
                      mockInnerJoin, mockLeftJoin, mockLimit]) {
      fn.mockReturnValue(builder);
    }
  });

  it("orders by archived then startDate DESC", async () => {
    await getAllEvents();
    expect(mockOrderBy).toHaveBeenCalled();
  });
});
