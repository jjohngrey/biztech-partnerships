export type CrmStatus =
  | "prospecting"
  | "pitched"
  | "reached_out"
  | "shortlist"
  | "in_conversation"
  | "followed_up"
  | "confirmed"
  | "paid"
  | "declined"
  | "backed_out";

export type PartnerContact = {
  id: string;
  firstName: string;
  lastName: string | null;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  isPrimary: boolean;
  archived: boolean;
};

export type PartnerAccount = {
  id: string;
  name: string;
  website: string | null;
  linkedin: string | null;
  tier: string | null;
  tags: string[];
  notes: string | null;
  isAlumni: boolean;
  archived: boolean;
  primaryContact: PartnerContact | null;
  contacts: PartnerContact[];
  sponsorshipCount: number;
  pipelineValue: number;
  securedValue: number;
  latestStatus: CrmStatus | null;
  nextFollowUpDate: string | null;
  updatedAt: Date;
};

export type CrmEventSummary = {
  id: string;
  name: string;
  year: number | null;
  startDate: string;
  endDate: string | null;
  sponsorshipGoal: number | null;
  archived: boolean;
  securedValue: number;
  pipelineValue: number;
  sponsorCount: number;
};

export type PipelineDeal = {
  id: string;
  partnerId: string;
  partnerName: string;
  eventId: string;
  eventName: string;
  primaryContactName: string | null;
  ownerName: string | null;
  amount: number | null;
  tier: string | null;
  status: CrmStatus;
  role: string | null;
  followUpDate: string | null;
  notes: string | null;
  updatedAt: Date;
};

export type CrmDashboard = {
  securedValue: number;
  openPipelineValue: number;
  annualGoal: number;
  annualProgressPct: number;
  followUpsDueCount: number;
  partnerCount: number;
  eventCount: number;
  events: CrmEventSummary[];
  pipelineByStatus: Array<{
    status: CrmStatus;
    count: number;
    value: number;
  }>;
  upcomingFollowUps: PipelineDeal[];
};

export type CreatePartnerInput = {
  name: string;
  website?: string;
  linkedin?: string;
  tier?: string;
  tags?: string[];
  notes?: string;
  isAlumni?: boolean;
  primaryContact?: {
    firstName: string;
    lastName?: string;
    role?: string;
    email?: string;
    phone?: string;
    linkedin?: string;
  };
};

export type CreateEventInput = {
  name: string;
  year?: number;
  startDate: string;
  endDate?: string;
  outreachStartDate?: string;
  sponsorshipGoal?: number;
  notes?: string;
  tierConfigs?: Array<{ id: string; label: string; amount: number | null }>;
};

export type CreateSponsorshipInput = {
  companyId: string;
  eventId: string;
  primaryContactId?: string;
  ownerUserId?: string;
  amount?: number;
  tier?: string;
  status?: CrmStatus;
  role?: string;
  followUpDate?: string;
  notes?: string;
};
