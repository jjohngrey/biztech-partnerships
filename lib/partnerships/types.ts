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

export type EventRole =
  | "booth"
  | "speaker"
  | "workshop"
  | "sponsor"
  | "judge"
  | "mentor"
  | "student";

export type EventAttendanceStatus =
  | "asked"
  | "interested"
  | "form_sent"
  | "form_submitted"
  | "confirmed"
  | "declined"
  | "attended";

export type PartnerContact = {
  id: string;
  firstName: string;
  lastName: string | null;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  notes: string | null;
  isPrimary: boolean;
  archived: boolean;
};

export type CrmUserSummary = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  role: CrmUserRole;
  team: CrmUserTeam;
};

export type CrmUserRole = "admin" | "member";
export type CrmUserTeam = "partnerships" | "experiences" | "mmd" | "internal" | "dev";

export type CreateDirectorInput = {
  firstName: string;
  lastName?: string;
  email: string;
  role?: CrmUserRole;
  team?: CrmUserTeam;
};

export type UpdateDirectorInput = CreateDirectorInput & {
  id: string;
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
  outreachStartDate: string | null;
  sponsorshipGoal: number | null;
  confirmedPartnerGoal: number | null;
  notes: string | null;
  archived: boolean;
  securedValue: number;
  pipelineValue: number;
  sponsorCount: number;
  confirmedPartnerCount: number;
  partnerResponses: EventPartnerResponse[];
};

export type EventPartnerResponse = {
  partnerId: string;
  partnerName: string;
  companyName: string;
  eventRole: EventRole;
  eventStatus: EventAttendanceStatus;
};

export type PartnerEventAttendance = {
  eventId: string;
  eventName: string;
  eventRole: EventRole;
  eventStatus: EventAttendanceStatus;
};

export type PipelineDeal = {
  id: string;
  partnerId: string;
  partnerName: string;
  eventId: string | null;
  eventName: string | null;
  primaryContactId: string | null;
  primaryContactName: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  amount: number | null;
  tier: string | null;
  status: CrmStatus;
  role: string | null;
  followUpDate: string | null;
  notes: string | null;
  updatedAt: Date;
};

export type CurrentPipelineRecord = Omit<PipelineDeal, "updatedAt"> & {
  updatedAtIso: string;
};

export type MeetingLogRecord = {
  id: string;
  title: string;
  meetingDateIso: string;
  source: string;
  content: string;
  summary: string | null;
  companies: Array<{ id: string; name: string }>;
  partners: Array<{ id: string; name: string }>;
  events: Array<{ id: string; name: string }>;
  attendees: CrmUserSummary[];
};

export type PartnerDocumentRecord = {
  id: string;
  companyId: string;
  partnerId: string | null;
  partnerName: string | null;
  eventId: string | null;
  eventName: string | null;
  title: string;
  type: string;
  status: string;
  url: string;
  fileName: string | null;
  notes: string | null;
  updatedAtIso: string;
};

export type CompanyInteractionRecord = {
  id: string;
  companyId: string;
  companyName?: string;
  partnerId: string | null;
  partnerName: string | null;
  userId: string;
  userName: string;
  type: "meeting" | "call" | "email" | "linkedin" | "in_person" | "other";
  direction: "inbound" | "outbound" | null;
  subject: string | null;
  notes: string | null;
  contactedAtIso: string;
  followUpDate: string | null;
};

export type CreateMeetingLogInput = {
  title: string;
  meetingDate: string;
  content: string;
  summary?: string;
  companyId?: string;
  companyName?: string;
  partnerId?: string;
  eventId?: string;
  partnerFirstName?: string;
  partnerLastName?: string;
  partnerEmail?: string;
  partnerLinkedin?: string;
  attendeeUserIds?: string[];
  createConversation?: boolean;
  conversationStatus?: CrmStatus;
  conversationTier?: string;
  conversationAmount?: number;
  conversationFollowUpDate?: string;
  conversationRole?: string;
  conversationOwnerUserId?: string;
};

export type UpdateMeetingLogInput = {
  id: string;
  title: string;
  meetingDate: string;
  content: string;
  summary?: string;
  companyId?: string;
  companyName?: string;
  partnerId?: string;
  eventId?: string;
  partnerFirstName?: string;
  partnerLastName?: string;
  partnerEmail?: string;
  partnerLinkedin?: string;
  attendeeUserIds?: string[];
};

export type CreatePartnerDocumentInput = {
  companyId: string;
  partnerId?: string;
  eventId?: string;
  title: string;
  type?: string;
  status?: string;
  url: string;
  fileName?: string;
  notes?: string;
};

export type CreateCompanyInteractionInput = {
  companyId?: string;
  companyName?: string;
  partnerId?: string;
  partnerFirstName?: string;
  partnerLastName?: string;
  partnerRole?: string;
  partnerEmail?: string;
  partnerLinkedin?: string;
  userId: string;
  type: CompanyInteractionRecord["type"];
  direction?: CompanyInteractionRecord["direction"];
  subject?: string;
  notes?: string;
  contactedAt: string;
  followUpDate?: string;
};

export type TouchpointRecord = CompanyInteractionRecord & {
  companyName: string;
  source: string | null;
  createdAtIso: string;
  externalThreadId: string | null;
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

export type CompanyDirectoryRecord = Omit<PartnerAccount, "updatedAt"> & {
  activeContactsCount: number;
  activeDeals: Array<{
    id: string;
    eventName: string | null;
    status: CrmStatus;
    amount: number | null;
    followUpDate: string | null;
    primaryContactName: string | null;
  }>;
  eventAttendances: PartnerEventAttendance[];
  documents: PartnerDocumentRecord[];
  communications: CompanyInteractionRecord[];
  updatedAtIso: string;
};

export type PartnerDirectoryRecord = PartnerContact & {
  companyId: string;
  companyName: string;
  companyTier: string | null;
  companyArchived: boolean;
  latestStatus: CrmStatus | null;
  nextFollowUpDate: string | null;
  eventAttendances: PartnerEventAttendance[];
  directors: CrmUserSummary[];
  updatedAtIso: string;
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

export type CreateCompanyInput = {
  name: string;
  website?: string;
  linkedin?: string;
  tier?: string;
  tags?: string[];
  notes?: string;
  isAlumni?: boolean;
};

export type UpdateCompanyInput = CreateCompanyInput & {
  id: string;
  archived?: boolean;
};

export type CreateContactInput = {
  firstName: string;
  lastName?: string;
  companyId?: string;
  companyName?: string;
  role?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  notes?: string;
  isPrimary?: boolean;
  directorUserIds?: string[];
};

export type UpdateContactInput = CreateContactInput & {
  id: string;
  archived?: boolean;
};

export type AddPartnerEventRoleInput = {
  partnerId: string;
  eventId: string;
  eventRole: EventRole;
  eventStatus?: EventAttendanceStatus;
};

export type AddCompanyEventRoleInput = {
  companyId: string;
  eventId: string;
  eventRole: EventRole;
  eventStatus?: EventAttendanceStatus;
};

export type CreateEventInput = {
  name: string;
  year?: number;
  startDate: string;
  endDate?: string;
  outreachStartDate?: string;
  sponsorshipGoal?: number;
  confirmedPartnerGoal?: number;
  notes?: string;
  tierConfigs?: Array<{ id: string; label: string; amount: number | null }>;
};

export type UpdateEventInput = CreateEventInput & {
  id: string;
  archived?: boolean;
};

export type CreateSponsorshipInput = {
  companyId?: string;
  companyName?: string;
  eventId?: string;
  primaryContactId?: string;
  ownerUserId?: string;
  amount?: number;
  tier?: string;
  status?: CrmStatus;
  role?: string;
  followUpDate?: string;
  notes?: string;
};

export type LogEventPartnerResponseInput = {
  eventId: string;
  eventRole: EventRole;
  eventStatus?: EventAttendanceStatus;
  partnerId?: string;
  firstName?: string;
  lastName?: string;
  companyId?: string;
  companyName?: string;
  role?: string;
  email?: string;
  linkedin?: string;
};

export type UpdateSponsorshipInput = {
  id: string;
  companyId?: string;
  companyName?: string;
  eventId?: string | null;
  primaryContactId?: string;
  ownerUserId?: string;
  amount?: number;
  tier?: string;
  status: CrmStatus;
  role?: string;
  followUpDate?: string;
  notes?: string;
  archived?: boolean;
};

export type EmailTemplateRecord = {
  id: string;
  name: string;
  description: string | null;
  subjectTemplate: string;
  bodyTemplate: string;
  archived: boolean;
  updatedAtIso: string;
  lastUsedAtIso: string | null;
};

export type EmailRecipientRecord = {
  id: string;
  companyId: string;
  companyName: string;
  contactName: string;
  email: string;
  latestStatus: CrmStatus | null;
};

export type EmailCampaignRecord = {
  id: string;
  templateId: string | null;
  eventId: string | null;
  eventName: string | null;
  senderUserId: string | null;
  senderName: string | null;
  subject: string;
  body: string;
  status: "draft" | "sending" | "sent" | "failed";
  createdAtIso: string;
  sentAtIso: string | null;
  sends: Array<{
    id: string;
    companyId: string | null;
    partnerId: string | null;
    recipientEmail: string;
    status: "queued" | "sent" | "skipped" | "failed";
    error: string | null;
  }>;
};

export type EmailSyncSummary = {
  lastSyncedAtIso: string | null;
  syncedMessageCount: number;
  linkedCompanyCount: number;
  linkedPartnerCount: number;
};

export type CreateEmailTemplateInput = {
  name: string;
  description?: string;
  subjectTemplate: string;
  bodyTemplate: string;
  createdBy?: string;
};

export type UpdateEmailTemplateInput = CreateEmailTemplateInput & {
  id: string;
  archived?: boolean;
};

export type CreateEmailCampaignDraftInput = {
  templateId?: string;
  eventId?: string;
  senderUserId?: string;
  subject: string;
  body: string;
  recipientIds: string[];
};
