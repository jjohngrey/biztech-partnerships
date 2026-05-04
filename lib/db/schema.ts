import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  date,
  primaryKey,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// users
// Mirrors auth.users; populated via a Supabase post-login trigger/hook.
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // FK to auth.users.id — enforced in Supabase
  email: text("email").notNull().unique(),
  first_name: text("first_name").notNull(),
  last_name: text("last_name").notNull(),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  team: text("team", { enum: ["partnerships", "experiences", "mmd", "internal", "dev"] }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// companies - sponsor/account records
// ---------------------------------------------------------------------------
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  website: text("website"),
  linkedin: text("linkedin"),
  tier: text("tier"),
  tags: text("tags").array().notNull().default([]),
  notes: text("notes"),
  isAlumni: boolean("is_alumni").notNull().default(false),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// partners - people/contacts at sponsor companies
// A company may have many contacts; one can be marked primary.
// ---------------------------------------------------------------------------
export const partners = pgTable("partners", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  role: text("role"),
  email: text("email").unique(),
  linkedin: text("linkedin"),
  phone: text("phone"),
  notes: text("notes"),
  isPrimary: boolean("is_primary").notNull().default(false),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// events
// ---------------------------------------------------------------------------
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  year: integer("year"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  outreachStartDate: date("outreach_start_date"),
  sponsorshipGoal: integer("sponsorship_goal"), // in cents
  confirmedPartnerGoal: integer("confirmed_partner_goal"),
  tierConfigs: jsonb("tier_configs")
    .$type<Array<{ id: string; label: string; amount: number | null }>>()
    .notNull()
    .default([]),
  description: text("description"),
  notes: text("notes"),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// sponsors - company-level sponsorship deals for events
// Optional contact links let the same sponsorship be owned by both a company
// and one or more people at that company.
// ---------------------------------------------------------------------------
export const sponsors = pgTable("sponsors", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  primaryContactId: uuid("primary_contact_id").references(() => partners.id, {
    onDelete: "set null",
  }),
  ownerUserId: uuid("owner_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  amount: integer("amount"), // in cents
  tier: text("tier"),
  status: text("status", {
    enum: [
      "prospecting",
      "pitched",
      "reached_out",
      "shortlist",
      "in_conversation",
      "followed_up",
      "confirmed",
      "paid",
      "declined",
      "backed_out",
    ],
  }).notNull().default("prospecting"),
  role: text("role"),
  followUpDate: date("follow_up_date"),
  notes: text("notes"),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sponsorshipContacts = pgTable(
  "sponsorship_contacts",
  {
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsors.id, { onDelete: "cascade" }),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    notes: text("notes"),
  },
  (t) => [primaryKey({ columns: [t.sponsorId, t.partnerId] })],
);

// ---------------------------------------------------------------------------
// in_kind_sponsors - company-level goods/services instead of cash
// ---------------------------------------------------------------------------
export const inKindSponsors = pgTable("in_kind_sponsors", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  primaryContactId: uuid("primary_contact_id").references(() => partners.id, {
    onDelete: "set null",
  }),
  description: text("description").notNull(), // e.g. "catering for 200 people"
  estimatedValue: integer("estimated_value"), // in cents
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// meeting_notes
// ---------------------------------------------------------------------------
export const meetingNotes = pgTable("meeting_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  meetingDate: timestamp("meeting_date", { withTimezone: true }).notNull(),
  source: text("source", { enum: ["manual", "upload", "granola", "google_doc", "other"] }).notNull(),
  sourceUrl: text("source_url"),
  originalFilename: text("original_filename"),
  content: text("content").notNull(),
  summary: text("summary"),
  createdBy: uuid("created_by")
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// join tables
// ---------------------------------------------------------------------------
export const partnersEvents = pgTable(
  "partners_events",
  {
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    eventRole: text("event_role", { enum: ["booth", "speaker", "workshop", "sponsor", "judge", "mentor", "student"] }).notNull(),
    eventStatus: text("event_status", {
      enum: ["asked", "interested", "form_sent", "form_submitted", "confirmed", "declined", "attended"],
    }).notNull().default("asked"),
  },
  (t) => [primaryKey({ columns: [t.partnerId, t.eventId, t.eventRole] })],
);

export const companyEvents = pgTable(
  "company_events",
  {
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    eventRole: text("event_role", { enum: ["booth", "speaker", "workshop", "sponsor", "judge", "mentor", "student"] }).notNull(),
    eventStatus: text("event_status", {
      enum: ["asked", "interested", "form_sent", "form_submitted", "confirmed", "declined", "attended"],
    }).notNull().default("asked"),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.eventId, t.eventRole] })],
);

export const usersEvents = pgTable(
  "users_events",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.eventId] })],
);

export const usersPartners = pgTable(
  "users_partners",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.partnerId] })],
);

export const usersCompanies = pgTable(
  "users_companies",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.companyId] })],
);

// ---------------------------------------------------------------------------
// interactions — CRM activity log per user+partner
// Lighter than meeting_notes: quick calls, emails, LinkedIn messages, etc.
// ---------------------------------------------------------------------------
export const interactions = pgTable("interactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  partnerId: uuid("partner_id").references(() => partners.id, {
    onDelete: "set null",
  }),
  sponsorId: uuid("sponsor_id").references(() => sponsors.id, {
    onDelete: "set null",
  }),
  type: text("type", { enum: ["meeting", "call", "email", "linkedin", "in_person", "other"] }).notNull(),
  direction: text("direction", { enum: ["inbound", "outbound"] }),
  subject: text("subject"),
  notes: text("notes"),
  contactedAt: timestamp("contacted_at", { withTimezone: true }).notNull(),
  followUpDate: date("follow_up_date"),
  source: text("source"),
  externalMessageId: text("external_message_id"),
  externalThreadId: text("external_thread_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// contact_activities
// Canonical contact timeline record. Legacy interactions and meeting notes
// backfill into this table, then the app reads/writes here.
// ---------------------------------------------------------------------------
export const contactActivities = pgTable("contact_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  legacyInteractionId: uuid("legacy_interaction_id").unique().references(() => interactions.id, {
    onDelete: "set null",
  }),
  legacyMeetingNoteId: uuid("legacy_meeting_note_id").unique().references(() => meetingNotes.id, {
    onDelete: "set null",
  }),
  type: text("type", { enum: ["meeting", "call", "email", "linkedin", "in_person", "note", "other"] }).notNull(),
  direction: text("direction", { enum: ["inbound", "outbound"] }),
  subject: text("subject").notNull(),
  content: text("content"),
  summary: text("summary"),
  notes: text("notes"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  followUpDate: date("follow_up_date"),
  source: text("source").notNull().default("manual"),
  sourceUrl: text("source_url"),
  originalFilename: text("original_filename"),
  externalMessageId: text("external_message_id"),
  externalThreadId: text("external_thread_id"),
  primaryCompanyId: uuid("primary_company_id").references(() => companies.id, {
    onDelete: "set null",
  }),
  primaryPartnerId: uuid("primary_partner_id").references(() => partners.id, {
    onDelete: "set null",
  }),
  primaryUserId: uuid("primary_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  sponsorId: uuid("sponsor_id").references(() => sponsors.id, {
    onDelete: "set null",
  }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contactActivityCompanies = pgTable(
  "contact_activity_companies",
  {
    activityId: uuid("activity_id")
      .notNull()
      .references(() => contactActivities.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.activityId, t.companyId] })],
);

export const contactActivityPartners = pgTable(
  "contact_activity_partners",
  {
    activityId: uuid("activity_id")
      .notNull()
      .references(() => contactActivities.id, { onDelete: "cascade" }),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.activityId, t.partnerId] })],
);

export const contactActivityEvents = pgTable(
  "contact_activity_events",
  {
    activityId: uuid("activity_id")
      .notNull()
      .references(() => contactActivities.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.activityId, t.eventId] })],
);

export const contactActivityAttendees = pgTable(
  "contact_activity_attendees",
  {
    activityId: uuid("activity_id")
      .notNull()
      .references(() => contactActivities.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.activityId, t.userId] })],
);

// ---------------------------------------------------------------------------
// partner_documents - link-only document metadata for v1
// ---------------------------------------------------------------------------
export const partnerDocuments = pgTable("partner_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  partnerId: uuid("partner_id").references(() => partners.id, {
    onDelete: "set null",
  }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  sponsorId: uuid("sponsor_id").references(() => sponsors.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  type: text("type").notNull().default("general"),
  status: text("status").notNull().default("draft"),
  url: text("url").notNull(),
  fileName: text("file_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const meetingNotePartners = pgTable(
  "meeting_note_partners",
  {
    meetingNoteId: uuid("meeting_note_id")
      .notNull()
      .references(() => meetingNotes.id, { onDelete: "cascade" }),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.meetingNoteId, t.partnerId] })],
);

export const meetingNoteCompanies = pgTable(
  "meeting_note_companies",
  {
    meetingNoteId: uuid("meeting_note_id")
      .notNull()
      .references(() => meetingNotes.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.meetingNoteId, t.companyId] })],
);

export const meetingNoteEvents = pgTable(
  "meeting_note_events",
  {
    meetingNoteId: uuid("meeting_note_id")
      .notNull()
      .references(() => meetingNotes.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.meetingNoteId, t.eventId] })],
);

export const meetingNoteAttendees = pgTable(
  "meeting_note_attendees",
  {
    meetingNoteId: uuid("meeting_note_id")
      .notNull()
      .references(() => meetingNotes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.meetingNoteId, t.userId] })],
);

// ---------------------------------------------------------------------------
// google_oauth_tokens
// One row per user who has connected their Workspace Google account.
// The refresh token is encrypted at rest; see lib/google/tokens.ts.
// ---------------------------------------------------------------------------
export const googleOauthTokens = pgTable("google_oauth_tokens", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(),
  refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
  scopes: text("scopes").array().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// email ops
// ---------------------------------------------------------------------------
export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  subjectTemplate: text("subject_template").notNull(),
  bodyTemplate: text("body_template").notNull(),
  archived: boolean("archived").notNull().default(false),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const emailCampaigns = pgTable("email_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id").references(() => emailTemplates.id, {
    onDelete: "set null",
  }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  senderUserId: uuid("sender_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status", { enum: ["draft", "sending", "sent", "failed"] }).notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

export const emailSends = pgTable("email_sends", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => emailCampaigns.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").references(() => companies.id, {
    onDelete: "set null",
  }),
  partnerId: uuid("partner_id").references(() => partners.id, {
    onDelete: "set null",
  }),
  recipientEmail: text("recipient_email").notNull(),
  status: text("status", { enum: ["queued", "sent", "skipped", "failed"] }).notNull(),
  error: text("error"),
  externalMessageId: text("external_message_id"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// inferred types — import these instead of writing types by hand
// ---------------------------------------------------------------------------
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Partner = typeof partners.$inferSelect;
export type NewPartner = typeof partners.$inferInsert;

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

export type MeetingNote = typeof meetingNotes.$inferSelect;
export type NewMeetingNote = typeof meetingNotes.$inferInsert;

export type Sponsor = typeof sponsors.$inferSelect;
export type NewSponsor = typeof sponsors.$inferInsert;

export type SponsorshipContact = typeof sponsorshipContacts.$inferSelect;
export type NewSponsorshipContact = typeof sponsorshipContacts.$inferInsert;

export type PartnersEvent = typeof partnersEvents.$inferSelect;
export type NewPartnersEvent = typeof partnersEvents.$inferInsert;

export type UsersEvent = typeof usersEvents.$inferSelect;
export type NewUsersEvent = typeof usersEvents.$inferInsert;

export type UsersPartner = typeof usersPartners.$inferSelect;
export type NewUsersPartner = typeof usersPartners.$inferInsert;

export type UsersCompany = typeof usersCompanies.$inferSelect;
export type NewUsersCompany = typeof usersCompanies.$inferInsert;

export type Interaction = typeof interactions.$inferSelect;
export type NewInteraction = typeof interactions.$inferInsert;

export type ContactActivity = typeof contactActivities.$inferSelect;
export type NewContactActivity = typeof contactActivities.$inferInsert;

export type PartnerDocument = typeof partnerDocuments.$inferSelect;
export type NewPartnerDocument = typeof partnerDocuments.$inferInsert;

export type InKindSponsor = typeof inKindSponsors.$inferSelect;
export type NewInKindSponsor = typeof inKindSponsors.$inferInsert;

export type GoogleOauthToken = typeof googleOauthTokens.$inferSelect;
export type NewGoogleOauthToken = typeof googleOauthTokens.$inferInsert;

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type NewEmailTemplate = typeof emailTemplates.$inferInsert;

export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type NewEmailCampaign = typeof emailCampaigns.$inferInsert;

export type EmailSend = typeof emailSends.$inferSelect;
export type NewEmailSend = typeof emailSends.$inferInsert;
