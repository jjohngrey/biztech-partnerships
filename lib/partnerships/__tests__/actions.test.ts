import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CrmUserSummary, EmailCampaignRecord } from "../types";

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
  listEmailCampaigns: vi.fn(),
  enqueueEmailCampaign: vi.fn(),
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

import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { resolveCrmUserForAuthUser } from "@/lib/auth/crm-user";
import { getAuthedClient } from "@/lib/google/client";
import { enqueueEmailCampaignAction } from "../actions";
import { enqueueEmailCampaign, listEmailCampaigns } from "../repository";

const mockCreateClient = vi.mocked(createSupabaseClient);
const mockResolveCrmUser = vi.mocked(resolveCrmUserForAuthUser);
const mockGetAuthedClient = vi.mocked(getAuthedClient);
const mockListCampaigns = vi.mocked(listEmailCampaigns);
const mockEnqueueEmailCampaign = vi.mocked(enqueueEmailCampaign);

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

function makeCampaign(overrides: Partial<EmailCampaignRecord> = {}): EmailCampaignRecord {
  return {
    id: "campaign-1",
    templateId: null,
    eventId: null,
    eventName: null,
    senderUserId: CRM_USER.id,
    senderName: CRM_USER.name,
    subject: "Hello",
    body: "Hi",
    status: "draft",
    createdAtIso: "2026-05-01T00:00:00.000Z",
    queuedAtIso: null,
    scheduledAtIso: null,
    lastAttemptedAtIso: null,
    sentAtIso: null,
    sends: [
      {
        id: "send-1",
        companyId: "company-1",
        partnerId: "partner-1",
        recipientEmail: "ada@initech.com",
        status: "queued",
        error: null,
        sentAtIso: null,
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
});

describe("enqueueEmailCampaignAction", () => {
  it("throws when the caller is not signed in", async () => {
    setSupabaseUser(null);
    await expect(enqueueEmailCampaignAction({ campaignId: "campaign-1" })).rejects.toThrow(/sign in/i);
  });

  it("returns needs-consent when Google client lacks scope", async () => {
    setSupabaseUser(AUTH_USER);
    mockResolveCrmUser.mockResolvedValue(CRM_USER);
    mockGetAuthedClient.mockResolvedValue({
      kind: "needs-consent",
      consentUrl: "https://accounts.google.com/consent",
    } as Awaited<ReturnType<typeof getAuthedClient>>);

    const result = await enqueueEmailCampaignAction({ campaignId: "campaign-1" });
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

    await expect(enqueueEmailCampaignAction({ campaignId: "missing" })).rejects.toThrow(/draft was not found/i);
  });

  it("throws when the campaign has no queued sends", async () => {
    setSupabaseUser(AUTH_USER);
    mockResolveCrmUser.mockResolvedValue(CRM_USER);
    mockGetAuthedClient.mockResolvedValue({
      gmail: { users: { messages: { send: vi.fn() } } },
    } as unknown as Awaited<ReturnType<typeof getAuthedClient>>);
    mockListCampaigns.mockResolvedValue([makeCampaign({ sends: [] })]);

    await expect(enqueueEmailCampaignAction({ campaignId: "campaign-1" })).rejects.toThrow(/no queued recipients/i);
  });

  it("queues campaign with parsed schedule and returns queue metadata", async () => {
    setSupabaseUser(AUTH_USER);
    mockResolveCrmUser.mockResolvedValue(CRM_USER);
    mockGetAuthedClient.mockResolvedValue({
      gmail: { users: { messages: { send: vi.fn() } } },
    } as unknown as Awaited<ReturnType<typeof getAuthedClient>>);
    mockListCampaigns.mockResolvedValue([makeCampaign()]);
    const scheduledAt = new Date("2026-07-10T16:30:00.000Z");
    mockEnqueueEmailCampaign.mockResolvedValue({
      id: "campaign-1",
      scheduledAt,
    } as Awaited<ReturnType<typeof enqueueEmailCampaign>>);

    const result = await enqueueEmailCampaignAction({
      campaignId: "campaign-1",
      scheduledAtIso: "2026-07-10T16:30:00.000Z",
    });

    expect(mockEnqueueEmailCampaign).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      scheduledAt,
    });
    expect(result).toEqual({
      kind: "queued",
      campaignId: "campaign-1",
      queuedRecipientCount: 1,
      scheduledAtIso: "2026-07-10T16:30:00.000Z",
    });
  });

  it("rejects invalid scheduled timestamp", async () => {
    setSupabaseUser(AUTH_USER);
    mockResolveCrmUser.mockResolvedValue(CRM_USER);
    mockGetAuthedClient.mockResolvedValue({
      gmail: { users: { messages: { send: vi.fn() } } },
    } as unknown as Awaited<ReturnType<typeof getAuthedClient>>);
    mockListCampaigns.mockResolvedValue([makeCampaign()]);

    await expect(
      enqueueEmailCampaignAction({
        campaignId: "campaign-1",
        scheduledAtIso: "not-a-date",
      }),
    ).rejects.toThrow(/not a valid date/i);
  });
});
