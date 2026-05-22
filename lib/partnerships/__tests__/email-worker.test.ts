import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The worker awaits Drizzle chains at the end of each logical query. We model
 * that with a thenable chain that consumes one canned result per await, in the
 * order the worker issues its queries. Keep `dbResults` aligned with the query
 * order in processNextBatch() if you reorder the worker.
 */
let dbResults: unknown[] = [];
const updateCampaignSpy = vi.fn();

function makeChain() {
  const chain: Record<string, unknown> = {};
  const passthrough = [
    "select",
    "from",
    "innerJoin",
    "where",
    "orderBy",
    "limit",
    "set",
  ];
  for (const method of passthrough) {
    chain[method] = () => chain;
  }
  // `update(...).set(...).where(...)` is awaited without `.returning()` in the
  // "mark sending" / "touch last_attempted_at" paths; record those writes.
  chain.update = () => {
    updateCampaignSpy();
    return chain;
  };
  chain.then = (resolve: (value: unknown) => unknown) => {
    const next = dbResults.length ? dbResults.shift() : [];
    return resolve(next);
  };
  return chain;
}

vi.mock("@/lib/db", () => ({ db: makeChain(), emailCampaigns: {}, emailSends: {} }));
vi.mock("@/lib/db/schema", () => ({ emailCampaigns: {}, emailSends: {} }));

const getRemainingDailyQuota = vi.fn();
const sleep = vi.fn(() => Promise.resolve());
vi.mock("../email-quota", () => ({
  BATCH_SIZE: 10,
  DAILY_PER_SENDER_CAP: 100,
  INTER_MESSAGE_DELAY_MS: 0,
  getRemainingDailyQuota: (...args: unknown[]) => getRemainingDailyQuota(...args),
  sleep: () => sleep(),
}));

const gmailSend = vi.fn();
const getAuthedClient = vi.fn();
vi.mock("@/lib/google/client", () => ({
  getAuthedClient: (...args: unknown[]) => getAuthedClient(...args),
}));

const updateEmailSendResult = vi.fn();
const updateEmailCampaignStatus = vi.fn((...args: unknown[]) => {
  updateCampaignSpy(...args);
  return Promise.resolve();
});
const logEmailInteraction = vi.fn();
vi.mock("../repository", () => ({
  buildMergeValues: () => Promise.resolve({}),
  renderMergeTemplate: (template: string) => template,
  listEmailRecipients: () =>
    Promise.resolve([
      { id: "p1", companyId: "c1", companyName: "Acme", contactName: "A", email: "a@acme.com", latestStatus: null },
      { id: "p2", companyId: "c2", companyName: "Beta", contactName: "B", email: "b@beta.com", latestStatus: null },
    ]),
  listUsers: () => Promise.resolve([{ id: "sender-1", name: "Dana", email: "dana@ubcbiztech.com" }]),
  listEvents: () => Promise.resolve([]),
  logEmailInteraction: (...args: unknown[]) => logEmailInteraction(...args),
  updateEmailCampaignStatus: (...args: unknown[]) => updateEmailCampaignStatus(...args),
  updateEmailSendResult: (...args: unknown[]) => updateEmailSendResult(...args),
}));

import { processNextBatch } from "../email-worker";

const campaign = {
  id: "camp-1",
  senderUserId: "sender-1",
  eventId: null,
  subject: "Hello {{company_name}}",
  body: "Body",
  status: "queued",
  scheduledAt: null,
};

beforeEach(() => {
  dbResults = [];
  getRemainingDailyQuota.mockResolvedValue(100);
  getAuthedClient.mockResolvedValue({ gmail: { users: { messages: { send: gmailSend } } } });
  gmailSend.mockResolvedValue({ data: { id: "gmail-msg-1" } });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("processNextBatch", () => {
  it("returns idle when no campaign is queued", async () => {
    dbResults = [[]]; // pickDueCampaign → none
    const result = await processNextBatch(new Date("2026-05-20T22:00:00Z"));
    expect(result).toEqual({ kind: "idle", reason: "no-campaign" });
    expect(gmailSend).not.toHaveBeenCalled();
  });

  it("blocks without sending when the sender's daily quota is exhausted", async () => {
    getRemainingDailyQuota.mockResolvedValue(0);
    dbResults = [
      [campaign], // pickDueCampaign
      [], // touch last_attempted_at (update→where awaited)
    ];
    const result = await processNextBatch(new Date("2026-05-20T22:00:00Z"));
    expect(result.kind).toBe("blocked");
    if (result.kind === "blocked") expect(result.reason).toBe("quota-exhausted");
    expect(gmailSend).not.toHaveBeenCalled();
  });

  it("marks the campaign failed when the sender lost Gmail consent", async () => {
    getAuthedClient.mockResolvedValue({ kind: "needs-consent", consentUrl: "https://x" });
    dbResults = [[campaign]]; // pickDueCampaign
    const result = await processNextBatch(new Date("2026-05-20T22:00:00Z"));
    expect(result.kind).toBe("blocked");
    if (result.kind === "blocked") expect(result.reason).toBe("needs-consent");
    expect(updateEmailCampaignStatus).toHaveBeenCalledWith("camp-1", "failed", expect.anything());
    expect(gmailSend).not.toHaveBeenCalled();
  });

  it("sends the queued batch and flips the campaign to 'sent' when none fail", async () => {
    dbResults = [
      [campaign], // pickDueCampaign
      [
        { id: "s1", campaignId: "camp-1", companyId: "c1", partnerId: "p1", recipientEmail: "a@acme.com", status: "queued" },
        { id: "s2", campaignId: "camp-1", companyId: "c2", partnerId: "p2", recipientEmail: "b@beta.com", status: "queued" },
      ], // queuedSends
      [], // mark sending (update→where awaited)
      [], // remaining queued after batch → none
      [], // flipTerminalStatus failed-rows lookup → none
    ];
    const result = await processNextBatch(new Date("2026-05-20T22:00:00Z"));
    expect(gmailSend).toHaveBeenCalledTimes(2);
    expect(result.kind).toBe("processed");
    if (result.kind === "processed") {
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.remainingForCampaign).toBe(0);
      expect(result.campaignStatus).toBe("sent");
    }
    expect(updateEmailCampaignStatus).toHaveBeenCalledWith("camp-1", "sent", expect.anything());
    expect(logEmailInteraction).toHaveBeenCalledTimes(2);
  });

  it("caps the batch to the sender's remaining quota", async () => {
    getRemainingDailyQuota.mockResolvedValue(1); // only room for one more today
    dbResults = [
      [campaign],
      [
        { id: "s1", campaignId: "camp-1", companyId: "c1", partnerId: "p1", recipientEmail: "a@acme.com", status: "queued" },
      ], // worker should have asked for limit(1); we hand back one
      [], // mark sending
      [{ id: "s2" }], // remaining still queued → stays 'sending'
    ];
    const result = await processNextBatch(new Date("2026-05-20T22:00:00Z"));
    expect(gmailSend).toHaveBeenCalledTimes(1);
    expect(result.kind).toBe("processed");
    if (result.kind === "processed") {
      expect(result.sent).toBe(1);
      expect(result.remainingForCampaign).toBe(1);
      expect(result.campaignStatus).toBe("sending");
    }
  });
});
