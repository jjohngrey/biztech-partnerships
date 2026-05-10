import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted shared state for the db mock — referenced from the vi.mock factory.
// ---------------------------------------------------------------------------

const { state, tables, dbMock, queueSelect } = vi.hoisted(() => {
  const tables = {
    users: { __table: "users" } as const,
    companies: { __table: "companies" } as const,
    partners: { __table: "partners" } as const,
    contactActivities: {
      __table: "contactActivities",
      // The route uses bare-column references like contactActivities.externalMessageId
      // when building a where() clause; we stub them as inert sentinels.
      externalMessageId: { __col: "externalMessageId" },
      id: { __col: "id" },
    } as const,
    contactActivityCompanies: { __table: "contactActivityCompanies" } as const,
    contactActivityPartners: { __table: "contactActivityPartners" } as const,
    contactActivityAttendees: { __table: "contactActivityAttendees" } as const,
  };

  // Per-table queued results. Each select() call shifts the next result set.
  const state = {
    selectResults: new Map<string, unknown[][]>(),
    insertCalls: [] as Array<{ table: string; values: unknown }>,
    activityIdCounter: 0,
  };

  function queueSelect(tableKey: string, rows: unknown[]) {
    if (!state.selectResults.has(tableKey)) state.selectResults.set(tableKey, []);
    state.selectResults.get(tableKey)!.push(rows);
  }

  function shiftSelect(tableKey: string): unknown[] {
    const queue = state.selectResults.get(tableKey);
    if (!queue || queue.length === 0) return [];
    return queue.shift()!;
  }

  function makeSelectChain() {
    let resolvedTable: string | null = null;
    const chain: any = {
      from(table: { __table: string }) {
        resolvedTable = table.__table;
        return chain;
      },
      where: () => chain,
      limit: () => chain,
      orderBy: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        const rows = shiftSelect(resolvedTable ?? "");
        return Promise.resolve(rows).then(onFulfilled, onRejected);
      },
    };
    return chain;
  }

  function makeInsertChain(table: { __table: string }) {
    let pendingValues: unknown = null;
    const chain: any = {
      values(values: unknown) {
        pendingValues = values;
        state.insertCalls.push({ table: table.__table, values });
        return chain;
      },
      returning() {
        // Only contactActivities returns rows in this route; fabricate one.
        if (table.__table === "contactActivities") {
          state.activityIdCounter += 1;
          const id = `activity-${state.activityIdCounter}`;
          return Promise.resolve([{ id, ...(pendingValues as object) }]);
        }
        return Promise.resolve([]);
      },
      onConflictDoNothing() {
        return Promise.resolve(undefined);
      },
      then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        // Bare insert(...).values(...) is awaited directly when neither
        // returning() nor onConflictDoNothing() is chained.
        return Promise.resolve(undefined).then(onFulfilled, onRejected);
      },
    };
    return chain;
  }

  const dbMock: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  } = {
    select: vi.fn(() => makeSelectChain()),
    insert: vi.fn((table: { __table: string }) => makeInsertChain(table)),
    transaction: vi.fn(),
  };
  dbMock.transaction.mockImplementation(
    async (callback: (tx: typeof dbMock) => Promise<unknown>) => callback(dbMock),
  );

  return { state, tables, dbMock, queueSelect };
});

vi.mock("@/lib/db", () => ({
  db: dbMock,
  ...tables,
}));

vi.mock("@/lib/db/schema", () => tables);

// drizzle-orm's eq is referenced by the route to build a where clause; stub it.
vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => ({ __eq: [a, b] }),
}));

import { POST } from "../route";

// ---------------------------------------------------------------------------
// Helpers for building NextRequest-like inputs.
// ---------------------------------------------------------------------------

function makeRequest(
  body: unknown,
  options: { secretHeader?: string } = {},
): import("next/server").NextRequest {
  const headers = new Headers();
  if (options.secretHeader) headers.set("x-crm-ingest-secret", options.secretHeader);
  return {
    headers,
    json: async () => body,
  } as unknown as import("next/server").NextRequest;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SECRET = "ingest-secret-test-value";

const userRow = {
  id: "user-1",
  email: "jess@biztech.org",
  first_name: "Jess",
  last_name: "Park",
  role: "member",
  team: "partnerships",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const companyRow = {
  id: "company-1",
  name: "Initech",
  website: null,
  linkedin: null,
  tier: null,
  tags: [],
  notes: null,
  isAlumni: false,
  archived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const partnerRow = {
  id: "partner-1",
  firstName: "Ada",
  lastName: "Lovelace",
  companyId: "company-1",
  role: null,
  email: "ada@initech.com",
  linkedin: null,
  phone: null,
  notes: null,
  isPrimary: true,
  archived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  state.selectResults.clear();
  state.insertCalls.length = 0;
  state.activityIdCounter = 0;
  process.env.PARTNERSHIPS_EMAIL_INGEST_SECRET = SECRET;
});

describe("POST /api/partnerships/email/sync/ingest", () => {
  it("returns 503 when PARTNERSHIPS_EMAIL_INGEST_SECRET is unset", async () => {
    delete process.env.PARTNERSHIPS_EMAIL_INGEST_SECRET;
    const response = await POST(makeRequest({ messages: [] }));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({
      error: "PARTNERSHIPS_EMAIL_INGEST_SECRET is not configured.",
    });
  });

  it("returns 401 when the secret is wrong", async () => {
    const response = await POST(makeRequest({ messages: [] }, { secretHeader: "wrong" }));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("accepts the secret in the body when no header is supplied", async () => {
    const response = await POST(
      makeRequest({ secret: SECRET, messages: [] }),
    );
    expect(response.status).toBe(200);
  });

  it("returns zeroed counts for an empty messages payload without hitting the DB", async () => {
    const response = await POST(
      makeRequest({ messages: [] }, { secretHeader: SECRET }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: 0, imported: 0, skipped: 0, unmatched: 0 });
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it("imports a message matched by partner email", async () => {
    queueSelect("users", [userRow]);
    queueSelect("companies", [companyRow]);
    queueSelect("partners", [partnerRow]);
    queueSelect("contactActivities", []); // dedupe lookup: no existing row

    const response = await POST(
      makeRequest(
        {
          messages: [
            {
              actorEmail: "jess@biztech.org",
              partnerEmail: "ada@initech.com",
              subject: "Re: sponsorship",
              summary: "Discussed booth tiers",
              direction: "inbound",
              messageId: "gmail-msg-1",
              threadId: "gmail-thread-1",
            },
          ],
        },
        { secretHeader: SECRET },
      ),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: 1, imported: 1, skipped: 0, unmatched: 0 });

    // Check that the activity row inserted has the expected fields.
    const activityInsert = state.insertCalls.find(
      (call) => call.table === "contactActivities",
    );
    expect(activityInsert).toBeDefined();
    expect(activityInsert!.values).toMatchObject({
      type: "email",
      direction: "inbound",
      subject: "Re: sponsorship",
      notes: "Discussed booth tiers",
      source: "gmail_sync",
      externalMessageId: "gmail-msg-1",
      externalThreadId: "gmail-thread-1",
      primaryCompanyId: "company-1",
      primaryPartnerId: "partner-1",
      primaryUserId: "user-1",
      createdBy: "user-1",
    });

    // And that the join-table inserts ran.
    expect(state.insertCalls.some((c) => c.table === "contactActivityCompanies")).toBe(true);
    expect(state.insertCalls.some((c) => c.table === "contactActivityPartners")).toBe(true);
    expect(state.insertCalls.some((c) => c.table === "contactActivityAttendees")).toBe(true);
  });

  it("falls back to the partner-name match when partner email does not match", async () => {
    queueSelect("users", [userRow]);
    queueSelect("companies", [companyRow]);
    queueSelect("partners", [partnerRow]);
    queueSelect("contactActivities", []);

    const response = await POST(
      makeRequest(
        {
          messages: [
            {
              actorEmail: "jess@biztech.org",
              partnerEmail: "stale@nope.com",
              partnerName: "Ada Lovelace",
              subject: "Hi",
            },
          ],
        },
        { secretHeader: SECRET },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      received: 1,
      imported: 1,
      skipped: 0,
      unmatched: 0,
    });
    const activityInsert = state.insertCalls.find(
      (call) => call.table === "contactActivities",
    );
    expect(activityInsert!.values).toMatchObject({
      primaryPartnerId: "partner-1",
      primaryCompanyId: "company-1",
    });
  });

  it("imports against a company-only match (no partner) when no partner is found", async () => {
    queueSelect("users", [userRow]);
    queueSelect("companies", [companyRow]);
    queueSelect("partners", []); // no partners at all
    queueSelect("contactActivities", []);

    const response = await POST(
      makeRequest(
        {
          messages: [
            {
              actorEmail: "jess@biztech.org",
              companyName: "Initech",
              subject: "Reaching out",
            },
          ],
        },
        { secretHeader: SECRET },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ imported: 1, unmatched: 0 });

    const activityInsert = state.insertCalls.find(
      (c) => c.table === "contactActivities",
    );
    expect(activityInsert!.values).toMatchObject({
      primaryCompanyId: "company-1",
      primaryPartnerId: null,
    });
    // No partner-link insert when there is no partner match.
    expect(
      state.insertCalls.some((c) => c.table === "contactActivityPartners"),
    ).toBe(false);
  });

  it("skips a message that has already been ingested (externalMessageId hit)", async () => {
    queueSelect("users", [userRow]);
    queueSelect("companies", [companyRow]);
    queueSelect("partners", [partnerRow]);
    // Dedupe lookup returns an existing activity row.
    queueSelect("contactActivities", [{ id: "existing-activity-1" }]);

    const response = await POST(
      makeRequest(
        {
          messages: [
            {
              actorEmail: "jess@biztech.org",
              partnerEmail: "ada@initech.com",
              messageId: "gmail-msg-1",
            },
          ],
        },
        { secretHeader: SECRET },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      received: 1,
      imported: 1 - 1,
      skipped: 1,
      unmatched: 0,
    });
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it("counts a message as unmatched when the actor email is unknown", async () => {
    queueSelect("users", []); // no matching user
    queueSelect("companies", [companyRow]);
    queueSelect("partners", [partnerRow]);

    const response = await POST(
      makeRequest(
        {
          messages: [
            {
              actorEmail: "stranger@example.com",
              partnerEmail: "ada@initech.com",
              messageId: "gmail-msg-2",
            },
          ],
        },
        { secretHeader: SECRET },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      received: 1,
      imported: 0,
      skipped: 0,
      unmatched: 1,
    });
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it("counts a message as unmatched when neither partner nor company resolves", async () => {
    queueSelect("users", [userRow]);
    queueSelect("companies", [companyRow]);
    queueSelect("partners", [partnerRow]);
    queueSelect("contactActivities", []);

    const response = await POST(
      makeRequest(
        {
          messages: [
            {
              actorEmail: "jess@biztech.org",
              partnerEmail: "nobody@nope.com",
              partnerName: "Nobody Here",
              companyName: "Unknown Co",
              messageId: "gmail-msg-3",
            },
          ],
        },
        { secretHeader: SECRET },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      received: 1,
      imported: 0,
      unmatched: 1,
    });
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it("defaults direction to outbound for any value other than 'inbound'", async () => {
    queueSelect("users", [userRow]);
    queueSelect("companies", [companyRow]);
    queueSelect("partners", [partnerRow]);
    queueSelect("contactActivities", []);

    await POST(
      makeRequest(
        {
          messages: [
            {
              actorEmail: "jess@biztech.org",
              partnerEmail: "ada@initech.com",
              direction: "weird-value",
              messageId: "gmail-msg-4",
            },
          ],
        },
        { secretHeader: SECRET },
      ),
    );

    const activityInsert = state.insertCalls.find(
      (c) => c.table === "contactActivities",
    );
    expect((activityInsert!.values as { direction: string }).direction).toBe(
      "outbound",
    );
  });

  it("supports a bare-array body shape", async () => {
    queueSelect("users", [userRow]);
    queueSelect("companies", [companyRow]);
    queueSelect("partners", [partnerRow]);
    queueSelect("contactActivities", []);

    const response = await POST(
      makeRequest(
        [
          {
            actorEmail: "jess@biztech.org",
            partnerEmail: "ada@initech.com",
            messageId: "gmail-msg-5",
          },
        ],
        { secretHeader: SECRET },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: 1, imported: 1 });
  });
});
