import { afterEach, describe, expect, it, vi } from "vitest";

// The quota helpers run real Drizzle queries against `db`. We mock the db
// module so the only thing under test is the timezone math and the cap
// arithmetic — not Postgres.
const selectRows = vi.fn();

vi.mock("@/lib/db", () => {
  // Minimal thenable chain: every builder method returns the same object, and
  // awaiting it resolves to whatever selectRows() currently returns.
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "from", "innerJoin", "where", "orderBy", "limit"]) {
    chain[method] = () => chain;
  }
  chain.then = (resolve: (value: unknown) => unknown) => resolve(selectRows());
  return { db: chain, emailCampaigns: {}, emailSends: {} };
});

vi.mock("@/lib/db/schema", () => ({ emailCampaigns: {}, emailSends: {} }));

import {
  DAILY_PER_SENDER_CAP,
  getDailySentCount,
  getRemainingDailyQuota,
  startOfTodayUtc,
} from "../email-quota";

afterEach(() => {
  vi.clearAllMocks();
});

describe("startOfTodayUtc", () => {
  it("returns the same calendar day's 08:00Z boundary for a mid-afternoon PT time", () => {
    // 2026-05-20 15:00 Vancouver (PDT, UTC-7) == 2026-05-20 22:00Z.
    const now = new Date("2026-05-20T22:00:00.000Z");
    const start = startOfTodayUtc(now);
    expect(start.toISOString()).toBe("2026-05-20T08:00:00.000Z");
  });

  it("uses the local calendar date, not the UTC date, near midnight PT", () => {
    // 2026-05-21 01:00Z is still 2026-05-20 18:00 in Vancouver, so 'today'
    // should anchor to the 20th, not the 21st.
    const now = new Date("2026-05-21T01:00:00.000Z");
    const start = startOfTodayUtc(now);
    expect(start.toISOString()).toBe("2026-05-20T08:00:00.000Z");
  });
});

describe("getDailySentCount", () => {
  it("counts the rows returned by the sent-today query", async () => {
    selectRows.mockReturnValue([{ id: "a" }, { id: "b" }, { id: "c" }]);
    const count = await getDailySentCount("sender-1", new Date("2026-05-20T22:00:00Z"));
    expect(count).toBe(3);
  });

  it("returns 0 when the sender has sent nothing today", async () => {
    selectRows.mockReturnValue([]);
    const count = await getDailySentCount("sender-1", new Date("2026-05-20T22:00:00Z"));
    expect(count).toBe(0);
  });
});

describe("getRemainingDailyQuota", () => {
  it("subtracts today's sends from the cap", async () => {
    selectRows.mockReturnValue(Array.from({ length: 30 }, (_, i) => ({ id: String(i) })));
    const remaining = await getRemainingDailyQuota("sender-1");
    expect(remaining).toBe(DAILY_PER_SENDER_CAP - 30);
  });

  it("never goes negative when the sender is over the cap", async () => {
    selectRows.mockReturnValue(
      Array.from({ length: DAILY_PER_SENDER_CAP + 5 }, (_, i) => ({ id: String(i) })),
    );
    const remaining = await getRemainingDailyQuota("sender-1");
    expect(remaining).toBe(0);
  });
});
