import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EmailCampaignRecord, EmailRecipientRecord, CrmUserSummary } from "../types";

// ---------------------------------------------------------------------------
// Mock dependencies before importing the module under test
// ---------------------------------------------------------------------------

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/auth/crm-user", () => ({
  displayNameFromAuthUser: vi.fn(() => "Test User"),
  resolveCrmUserForAuthUser: vi.fn(),
}));

vi.mock("@/lib/google/client", () => ({
  getAuthedClient: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
  contactActivities: { id: "contact_activities.id", createdBy: "contact_activities.created_by" },
}));

vi.mock("../repository", () => ({
  // Used by sendEmailCampaignAction:
  listEmailCampaigns: vi.fn(),
  listEmailRecipients: vi.fn(),
  listEvents: vi.fn(),
  listUsers: vi.fn(),
  buildMergeValues: vi.fn(),
  renderMergeTemplate: vi.fn((template: string) => template),
  updateEmailCampaignStatus: vi.fn(),
  updateEmailSendResult: vi.fn(),
  logEmailInteraction: vi.fn(),
  // Other repo functions imported by actions.ts (unused by these tests but must exist):
  addCompanyEventRole: vi.fn(),
  addPartnerEventRole: vi.fn(),
  archivePartnerAccount: vi.fn(),
  archiveEmailTemplate: vi.fn(),
  createCompanyInteraction: vi.fn(),
  updateCompanyInteraction: vi.fn(),
  createCompany: vi.fn(),
  createContact: vi.fn(),
  createDirector: vi.fn(),
  createCrmEvent: vi.fn(),
  createEmailCampaignDraft: vi.fn(),
  createEmailTemplate: vi.fn(),
  createMeetingLog: vi.fn(),
  createPartnerAccount: vi.fn(),
  createPartnerDocument: vi.fn(),
  createSponsorship: vi.fn(),
  deleteCompanyInteraction: vi.fn(),
  deleteMeetingLog: vi.fn(),
  deletePartnerDocument: vi.fn(),
  linkContactToCompany: vi.fn(),
  logEventPartnerResponse: vi.fn(),
  removeCompanyEventRole: vi.fn(),
  removePartnerEventRole: vi.fn(),
  updateCompany: vi.fn(),
  updateCompanyEventStatus: vi.fn(),
  updateContact: vi.fn(),
  updateDirector: vi.fn(),
  updateCrmEvent: vi.fn(),
  updateEmailTemplate: vi.fn(),
  updatePartnerEventStatus: vi.fn(),
  updateMeetingLog: vi.fn(),
  updateSponsorship: vi.fn(),
}));

vi.mock("../cached", () => ({
  CRM_DATA_TAG: "crm-data",
}));

import { sendEmailCampaignAction } from "../actions";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { resolveCrmUserForAuthUser } from "@/lib/auth/crm-user";
import { getAuthedClient } from "@/lib/google/client";
import {
  buildMergeValues,
  listEmailCampaigns,
  listEmailRecipients,
  listEvents,
  listUsers,
  logEmailInteraction,
  updateEmailCampaignStatus,
  updateEmailSendResult,
} from "../repository";

const mockCreateClient = vi.mocked(createSupabaseClient);
const mockResolveCrmUser = vi.mocked(resolveCrmUserForAuthUser);
const mockGetAuthedClient = vi.mocked(getAuthedClient);
const mockListCampaigns = vi.mocked(listEmailCampaigns);
const mockListRecipients = vi.mocked(listEmailRecipients);
const mockListEvents = vi.mocked(listEvents);
const mockListUsers = vi.mocked(listUsers);
const mockBuildMergeValues = vi.mocked(buildMergeValues);
const mockUpdateCampaignStatus = vi.mocked(updateEmailCampaignStatus);
const mockUpdateSendResult = vi.mocked(updateEmailSendResult);
const mockLogEmailInteraction = vi.mocked(logEmailInteraction);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const AUTH_USER = {
  id: "auth-user-1",
  email: "jess@biztech.org",
  user_metadata: { full_name: "Jess Park" },
};

const CRM_USER: CrmUserSummary = {
  id: "auth-user-1",
  firstName: "Jess",
  lastName: "Park",
  name: "Jess Park",
  email: "jess@biztech.org",
  role: "member",
  team: "partnerships",
};

const RECIPIENT: EmailRecipientRecord = {
  id: "partner-1",
  companyId: "company-1",
  companyName: "Initech",
  contactName: "Ada Lovelace",
  email: "ada@initech.com",
  latestStatus: null,
};

function makeCampaign(
  overrides: Partial<EmailCampaignRecord> = {},
): EmailCampaignRecord {
  return {
    id: "campaign-1",
    templateId: null,
    eventId: null,
    eventName: null,
    senderUserId: CRM_USER.id,
    senderName: CRM_USER.name,
    subject: "Hello {{contact_name}}",
    body: "Hi {{recipient_first_name}}",
    status: "draft",
    createdAtIso: "2026-05-01T00:00:00.000Z",
    sentAtIso: null,
    sends: [
      {
        id: "send-1",
        companyId: "company-1",
        partnerId: "partner-1",
        recipientEmail: "ada@initech.com",
        status: "queued",
        error: null,
      },
    ],
    ...overrides,
  };
}

function setSupabaseUser(user: typeof AUTH_USER | null) {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  } as unknown as Awaited<ReturnType<typeof createSupabaseClient>>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockBuildMergeValues.mockResolvedValue({
    company_name: RECIPIENT.companyName,
    contact_name: RECIPIENT.contactName,
    recipient_first_name: "Ada",
    recipient_last_name: "Lovelace",
    recipient_full_name: "Ada Lovelace",
    recipient_email: RECIPIENT.email,
    sender_first_name: CRM_USER.firstName,
    sender_last_name: CRM_USER.lastName,
    sender_full_name: CRM_USER.name,
    sender_email: CRM_USER.email,
    event_name: "",
    event_year: "",
  });
});

describe("sendEmailCampaignAction", () => {
  it("throws when the caller is not signed in", async () => {
    setSupabaseUser(null);
    await expect(sendEmailCampaignAction("campaign-1")).rejects.toThrow(
      /sign in/i,
    );
  });

  it("returns needs-consent when Google client lacks scope", async () => {
    setSupabaseUser(AUTH_USER);
    mockResolveCrmUser.mockResolvedValue(CRM_USER);
    mockGetAuthedClient.mockResolvedValue({
      kind: "needs-consent",
      consentUrl: "https://accounts.google.com/consent",
    } as Awaited<ReturnType<typeof getAuthedClient>>);

    const result = await sendEmailCampaignAction("campaign-1");
    expect(result).toEqual({
      kind: "needs-consent",
      consentUrl: "https://accounts.google.com/consent",
    });
    expect(mockListCampaigns).not.toHaveBeenCalled();
  });

  it("throws when the campaign cannot be found", async () => {
    setSupabaseUser(AUTH_USER);
    mockResolveCrmUser.mockResolvedValue(CRM_USER);
    mockGetAuthedClient.mockResolvedValue({
      gmail: { users: { messages: { send: vi.fn() } } },
    } as unknown as Awaited<ReturnType<typeof getAuthedClient>>);
    mockListCampaigns.mockResolvedValue([]);
    mockListRecipients.mockResolvedValue([]);
    mockListEvents.mockResolvedValue([]);
    mockListUsers.mockResolvedValue([]);

    await expect(sendEmailCampaignAction("missing")).rejects.toThrow(
      /draft was not found/i,
    );
  });

  it("throws when the campaign has no queued sends", async () => {
    setSupabaseUser(AUTH_USER);
    mockResolveCrmUser.mockResolvedValue(CRM_USER);
    mockGetAuthedClient.mockResolvedValue({
      gmail: { users: { messages: { send: vi.fn() } } },
    } as unknown as Awaited<ReturnType<typeof getAuthedClient>>);
    mockListCampaigns.mockResolvedValue([
      makeCampaign({ sends: [] }),
    ]);
    mockListRecipients.mockResolvedValue([]);
    mockListEvents.mockResolvedValue([]);
    mockListUsers.mockResolvedValue([]);

    await expect(sendEmailCampaignAction("campaign-1")).rejects.toThrow(
      /no queued recipients/i,
    );
  });

  it("sends a queued message, records the result, and logs an interaction", async () => {
    setSupabaseUser(AUTH_USER);
    mockResolveCrmUser.mockResolvedValue(CRM_USER);
    const sendMessage = vi.fn().mockResolvedValue({
      data: { id: "gmail-message-id-abc" },
    });
    mockGetAuthedClient.mockResolvedValue({
      gmail: { users: { messages: { send: sendMessage } } },
    } as unknown as Awaited<ReturnType<typeof getAuthedClient>>);

    const campaign = makeCampaign();
    mockListCampaigns.mockResolvedValue([campaign]);
    mockListRecipients.mockResolvedValue([RECIPIENT]);
    mockListEvents.mockResolvedValue([]);
    mockListUsers.mockResolvedValue([CRM_USER]);

    const result = await sendEmailCampaignAction(campaign.id);

    // Status transitions: sending -> sent
    expect(mockUpdateCampaignStatus).toHaveBeenNthCalledWith(1, campaign.id, "sending");
    expect(mockUpdateCampaignStatus).toHaveBeenLastCalledWith(campaign.id, "sent");

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const sendArgs = sendMessage.mock.calls[0][0];
    expect(sendArgs.userId).toBe("me");
    expect(sendArgs.requestBody).toHaveProperty("raw");
    // Verify the raw payload encodes the recipient address.
    const decoded = Buffer.from(sendArgs.requestBody.raw, "base64url").toString("utf8");
    expect(decoded).toContain(`To: ${RECIPIENT.email}`);
    expect(decoded).toContain('Content-Type: text/plain; charset="UTF-8"');

    expect(mockUpdateSendResult).toHaveBeenCalledWith({
      sendId: "send-1",
      status: "sent",
      externalMessageId: "gmail-message-id-abc",
    });

    // logEmailInteraction is only called when there is a senderUserId AND companyId.
    expect(mockLogEmailInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        partnerId: "partner-1",
        userId: CRM_USER.id,
      }),
    );

    expect(result).toMatchObject({
      kind: "sent",
      sentCount: 1,
      failedCount: 0,
      skippedCount: 0,
    });
  });

  it("skips a queued send when the partner is no longer an eligible recipient", async () => {
    setSupabaseUser(AUTH_USER);
    mockResolveCrmUser.mockResolvedValue(CRM_USER);
    const sendMessage = vi.fn();
    mockGetAuthedClient.mockResolvedValue({
      gmail: { users: { messages: { send: sendMessage } } },
    } as unknown as Awaited<ReturnType<typeof getAuthedClient>>);

    mockListCampaigns.mockResolvedValue([makeCampaign()]);
    // Recipient list is empty — the partner referenced by the send is gone.
    mockListRecipients.mockResolvedValue([]);
    mockListEvents.mockResolvedValue([]);
    mockListUsers.mockResolvedValue([CRM_USER]);

    const result = await sendEmailCampaignAction("campaign-1");

    expect(sendMessage).not.toHaveBeenCalled();
    expect(mockUpdateSendResult).toHaveBeenCalledWith(
      expect.objectContaining({ sendId: "send-1", status: "skipped" }),
    );
    expect(result.kind).toBe("sent");
    expect(result).toMatchObject({ sentCount: 0, skippedCount: 1, failedCount: 0 });
  });

  it("marks a send as failed and the campaign as failed when Gmail rejects", async () => {
    setSupabaseUser(AUTH_USER);
    mockResolveCrmUser.mockResolvedValue(CRM_USER);
    const sendMessage = vi.fn().mockRejectedValue(new Error("Quota exceeded"));
    mockGetAuthedClient.mockResolvedValue({
      gmail: { users: { messages: { send: sendMessage } } },
    } as unknown as Awaited<ReturnType<typeof getAuthedClient>>);

    mockListCampaigns.mockResolvedValue([makeCampaign()]);
    mockListRecipients.mockResolvedValue([RECIPIENT]);
    mockListEvents.mockResolvedValue([]);
    mockListUsers.mockResolvedValue([CRM_USER]);

    const result = await sendEmailCampaignAction("campaign-1");

    expect(mockUpdateSendResult).toHaveBeenCalledWith({
      sendId: "send-1",
      status: "failed",
      error: "Quota exceeded",
    });
    // Final campaign state is "failed" when any send fails.
    expect(mockUpdateCampaignStatus).toHaveBeenLastCalledWith("campaign-1", "failed");
    expect(mockLogEmailInteraction).not.toHaveBeenCalled();
    expect(result).toMatchObject({ failedCount: 1, sentCount: 0, skippedCount: 0 });
    expect(result.results[0]).toMatchObject({ status: "failed", message: "Quota exceeded" });
  });

  it("does not log a contact-log interaction when the campaign has no senderUserId", async () => {
    setSupabaseUser(AUTH_USER);
    mockResolveCrmUser.mockResolvedValue(CRM_USER);
    const sendMessage = vi.fn().mockResolvedValue({ data: { id: "gmail-id" } });
    mockGetAuthedClient.mockResolvedValue({
      gmail: { users: { messages: { send: sendMessage } } },
    } as unknown as Awaited<ReturnType<typeof getAuthedClient>>);

    mockListCampaigns.mockResolvedValue([makeCampaign({ senderUserId: null })]);
    mockListRecipients.mockResolvedValue([RECIPIENT]);
    mockListEvents.mockResolvedValue([]);
    mockListUsers.mockResolvedValue([CRM_USER]);

    await sendEmailCampaignAction("campaign-1");

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(mockUpdateSendResult).toHaveBeenCalledWith(
      expect.objectContaining({ status: "sent" }),
    );
    expect(mockLogEmailInteraction).not.toHaveBeenCalled();
  });
});
