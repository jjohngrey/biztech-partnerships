import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  date,
  primaryKey,
  integer,
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
// partners - people we work with
// ---------------------------------------------------------------------------
export const partners = pgTable("partners", {
  id: uuid("id").primaryKey().defaultRandom(),
  first_name: text("first_name").notNull(),
  last_name: text("last_name").notNull(),
  companyId: uuid("company_id").references(() => companies.id),
  role: text("role").notNull(),
  email: text("email").notNull().unique(),
  linkedin: text("linkedin"),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// sponsor - companies that give us cash
// ---------------------------------------------------------------------------
export const sponsors = pgTable("sponsors", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  partnerId: uuid("partner_id")
    .notNull()
    .references(() => partners.id, { onDelete: "set null" }),
  amount: integer("amount").notNull(), // in cents
  tier: text("tier", { enum: ["title", "platinum", "gold", "silver", "bronze"] }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// in_kind_sponsors - companies that give us goods/services instead of cash
// ---------------------------------------------------------------------------
export const inKindSponsors = pgTable("in_kind_sponsors", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  partnerId: uuid("partner_id")
    .notNull()
    .references(() => partners.id, { onDelete: "set null" }),
  description: text("description").notNull(), // what they're providing e.g. "catering for 200 people"
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// companies
// ---------------------------------------------------------------------------
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// events
// ---------------------------------------------------------------------------
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  description: text("description"),
  archived: boolean("archived").notNull().default(false),
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
  source: text("source", { enum: ["granola", "manual"] }).notNull(),
  sourceUrl: text("source_url"),
  content: text("content").notNull(),
  summary: text("summary"),
  createdBy: uuid("created_by")
    .notNull()
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
  },
  (t) => [primaryKey({ columns: [t.partnerId, t.eventId, t.eventRole] })],
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

// ---------------------------------------------------------------------------
// interactions — CRM activity log per user+partner
// Lighter than meeting_notes: quick calls, emails, LinkedIn messages, etc.
// ---------------------------------------------------------------------------
export const interactions = pgTable("interactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  partnerId: uuid("partner_id")
    .notNull()
    .references(() => partners.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["call", "email", "linkedin", "in_person", "other"] }).notNull(),
  notes: text("notes"),
  contactedAt: timestamp("contacted_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
// inferred types — import these instead of writing types by hand
// ---------------------------------------------------------------------------
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Partner = typeof partners.$inferSelect;
export type NewPartner = typeof partners.$inferInsert;

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

export type MeetingNote = typeof meetingNotes.$inferSelect;
export type NewMeetingNote = typeof meetingNotes.$inferInsert;

export type Sponsor = typeof sponsors.$inferSelect;
export type NewSponsor = typeof sponsors.$inferInsert;

export type PartnersEvent = typeof partnersEvents.$inferSelect;
export type NewPartnersEvent = typeof partnersEvents.$inferInsert;

export type UsersEvent = typeof usersEvents.$inferSelect;
export type NewUsersEvent = typeof usersEvents.$inferInsert;

export type UsersPartner = typeof usersPartners.$inferSelect;
export type NewUsersPartner = typeof usersPartners.$inferInsert;

export type Interaction = typeof interactions.$inferSelect;
export type NewInteraction = typeof interactions.$inferInsert;

export type InKindSponsor = typeof inKindSponsors.$inferSelect;
export type NewInKindSponsor = typeof inKindSponsors.$inferInsert;

export type GoogleOauthToken = typeof googleOauthTokens.$inferSelect;
export type NewGoogleOauthToken = typeof googleOauthTokens.$inferInsert;
