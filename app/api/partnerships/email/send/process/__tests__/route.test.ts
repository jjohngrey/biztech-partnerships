import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/partnerships/email-worker", () => ({
  processNextBatch: vi.fn(),
}));

import { processNextBatch } from "@/lib/partnerships/email-worker";
import { POST } from "../route";

const mockProcessNextBatch = vi.mocked(processNextBatch);

function makeRequest(url = "https://example.com/api/partnerships/email/send/process") {
  return new Request(url, { method: "POST" }) as unknown as import("next/server").NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PARTNERSHIPS_EMAIL_WORKER_SECRET = "worker-secret";
});

describe("POST /api/partnerships/email/send/process", () => {
  it("returns 503 when worker secret is not configured", async () => {
    delete process.env.PARTNERSHIPS_EMAIL_WORKER_SECRET;
    const response = await POST(makeRequest());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "PARTNERSHIPS_EMAIL_WORKER_SECRET is not configured.",
    });
  });

  it("returns 401 when supplied secret is invalid", async () => {
    const request = makeRequest("https://example.com/api/partnerships/email/send/process?secret=wrong");
    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mockProcessNextBatch).not.toHaveBeenCalled();
  });

  it("returns worker result when authorized", async () => {
    mockProcessNextBatch.mockResolvedValue({
      kind: "processed",
      campaignId: "campaign-1",
      attempted: 3,
      sent: 2,
      failed: 1,
      skipped: 0,
      remainingForCampaign: 4,
      campaignStatus: "sending",
    });

    const request = makeRequest("https://example.com/api/partnerships/email/send/process?secret=worker-secret");
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      kind: "processed",
      campaignId: "campaign-1",
      attempted: 3,
      sent: 2,
      failed: 1,
      skipped: 0,
      remainingForCampaign: 4,
      campaignStatus: "sending",
    });
  });
});
