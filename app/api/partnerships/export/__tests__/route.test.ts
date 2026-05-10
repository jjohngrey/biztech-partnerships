import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  CompanyDirectoryRecord,
  CurrentPipelineRecord,
  PartnerDirectoryRecord,
} from "@/lib/partnerships/types";

// ---------------------------------------------------------------------------
// Mocks must be declared before importing the route.
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/partnerships/repository", () => ({
  listCompanyDirectory: vi.fn(),
  listPartnerDirectory: vi.fn(),
  listCurrentPipeline: vi.fn(),
}));

import { GET } from "../route";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import {
  listCompanyDirectory,
  listPartnerDirectory,
  listCurrentPipeline,
} from "@/lib/partnerships/repository";

const mockCreateClient = vi.mocked(createSupabaseClient);
const mockListCompany = vi.mocked(listCompanyDirectory);
const mockListPartner = vi.mocked(listPartnerDirectory);
const mockListPipeline = vi.mocked(listCurrentPipeline);

function setSupabaseUser(user: { id: string } | null) {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  } as unknown as Awaited<ReturnType<typeof createSupabaseClient>>);
}

function makeCompany(
  overrides: Partial<CompanyDirectoryRecord> = {},
): CompanyDirectoryRecord {
  return {
    id: "company-1",
    name: "Initech",
    website: "https://initech.com",
    linkedin: null,
    tier: null,
    tags: [],
    notes: null,
    isAlumni: false,
    archived: false,
    primaryContact: null,
    contacts: [],
    sponsorshipCount: 0,
    pipelineValue: 0,
    securedValue: 0,
    latestStatus: null,
    nextFollowUpDate: null,
    activeContactsCount: 0,
    activeDeals: [],
    eventAttendances: [],
    documents: [],
    communications: [],
    updatedAtIso: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

function makePartner(
  overrides: Partial<PartnerDirectoryRecord> = {},
): PartnerDirectoryRecord {
  return {
    id: "partner-1",
    firstName: "Ada",
    lastName: "Lovelace",
    name: "Ada Lovelace",
    role: null,
    email: "ada@initech.com",
    phone: null,
    linkedin: null,
    notes: null,
    isPrimary: true,
    archived: false,
    companyId: "company-1",
    companyName: "Initech",
    companyTier: null,
    companyArchived: false,
    latestStatus: null,
    nextFollowUpDate: null,
    eventAttendances: [],
    directors: [],
    updatedAtIso: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeDeal(
  overrides: Partial<CurrentPipelineRecord> = {},
): CurrentPipelineRecord {
  return {
    id: "deal-1",
    partnerId: "company-1",
    partnerName: "Initech",
    eventId: "event-1",
    eventName: "Fall Showcase",
    primaryContactId: "partner-1",
    primaryContactName: "Ada Lovelace",
    ownerUserId: "user-1",
    ownerName: "Jess Park",
    amount: null,
    tier: "platinum",
    status: "in_conversation",
    role: null,
    followUpDate: "2026-06-01",
    notes: null,
    updatedAtIso: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/partnerships/export", () => {
  it("returns 401 when the caller is not signed in", async () => {
    setSupabaseUser(null);
    mockListCompany.mockResolvedValue([]);
    mockListPartner.mockResolvedValue([]);
    mockListPipeline.mockResolvedValue([]);

    const response = await GET();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Unauthorized" });
    // Should not bother fetching data if unauth.
    expect(mockListCompany).not.toHaveBeenCalled();
  });

  it("returns CSV with the documented header and content-disposition", async () => {
    setSupabaseUser({ id: "user-1" });
    mockListCompany.mockResolvedValue([]);
    mockListPartner.mockResolvedValue([]);
    mockListPipeline.mockResolvedValue([]);

    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toContain(
      'attachment; filename="partnerships-crm-export.csv"',
    );

    const text = await response.text();
    const lines = text.split("\n");
    expect(lines[0]).toBe(
      [
        '"record_type"',
        '"company"',
        '"partner"',
        '"email"',
        '"website"',
        '"event"',
        '"status"',
        '"sponsorship_package"',
        '"next_outreach"',
        '"biztech_director"',
        '"notes"',
      ].join(","),
    );
  });

  it("emits a row per company / partner / pipeline deal in that order", async () => {
    setSupabaseUser({ id: "user-1" });
    mockListCompany.mockResolvedValue([makeCompany()]);
    mockListPartner.mockResolvedValue([makePartner()]);
    mockListPipeline.mockResolvedValue([makeDeal()]);

    const response = await GET();
    const text = await response.text();
    const lines = text.split("\n");
    expect(lines).toHaveLength(4); // header + 3 rows
    expect(lines[1]).toContain('"company"');
    expect(lines[1]).toContain('"Initech"');
    expect(lines[2]).toContain('"partner"');
    expect(lines[2]).toContain('"ada@initech.com"');
    expect(lines[3]).toContain('"conversation"');
    expect(lines[3]).toContain('"Fall Showcase"');
    expect(lines[3]).toContain('"in_conversation"');
  });

  it("escapes embedded double-quotes by doubling them per RFC 4180", async () => {
    setSupabaseUser({ id: "user-1" });
    mockListCompany.mockResolvedValue([
      makeCompany({ name: 'Acme "Industries"', notes: 'has "quotes" in notes' }),
    ]);
    mockListPartner.mockResolvedValue([]);
    mockListPipeline.mockResolvedValue([]);

    const response = await GET();
    const text = await response.text();
    const companyLine = text.split("\n")[1];
    expect(companyLine).toContain('"Acme ""Industries"""');
    expect(companyLine).toContain('"has ""quotes"" in notes"');
  });

  it("emits empty quoted cells for null fields rather than literal 'null'", async () => {
    setSupabaseUser({ id: "user-1" });
    mockListCompany.mockResolvedValue([
      makeCompany({
        website: null,
        notes: null,
        latestStatus: null,
        nextFollowUpDate: null,
      }),
    ]);
    mockListPartner.mockResolvedValue([]);
    mockListPipeline.mockResolvedValue([]);

    const response = await GET();
    const text = await response.text();
    expect(text).not.toMatch(/\bnull\b/);
    // Each empty cell appears as "" (a pair of double-quotes).
    expect(text.split("\n")[1].split(",")).toContain('""');
  });

  it("joins event attendances into a single semicolon-separated cell", async () => {
    setSupabaseUser({ id: "user-1" });
    mockListCompany.mockResolvedValue([
      makeCompany({
        eventAttendances: [
          {
            eventId: "e1",
            eventName: "Fall Showcase",
            eventRole: "sponsor",
            eventStatus: "confirmed",
          },
          {
            eventId: "e2",
            eventName: "Spring Demo",
            eventRole: "speaker",
            eventStatus: "asked",
          },
        ],
      }),
    ]);
    mockListPartner.mockResolvedValue([]);
    mockListPipeline.mockResolvedValue([]);

    const response = await GET();
    const text = await response.text();
    expect(text).toContain(
      '"Fall Showcase (sponsor, confirmed); Spring Demo (speaker, asked)"',
    );
  });
});
