import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  companies,
  companyEvents,
  contactActivities,
  contactActivityAttendees,
  contactActivityCompanies,
  contactActivityEvents,
  contactActivityPartners,
  emailCampaigns,
  emailSends,
  emailTemplates,
  events,
  interactions,
  meetingNotes,
  meetingNoteAttendees,
  meetingNoteEvents,
  meetingNotePartners,
  partnerDocuments,
  partners,
  partnersEvents,
  sponsors,
  users,
  usersEvents,
  usersPartners,
  type NewSponsor,
} from "@/lib/db/schema";
import type {
  AddCompanyEventRoleInput,
  AddPartnerEventRoleInput,
  CompanyDirectoryRecord,
  CompanyInteractionRecord,
  CreateCompanyInteractionInput,
  CreateMeetingLogInput,
  CreateCompanyInput,
  CreateDirectorInput,
  CreateContactInput,
  CreateEmailCampaignDraftInput,
  CreateEmailTemplateInput,
  CreateEventInput,
  CreatePartnerDocumentInput,
  CreatePartnerInput,
  CreateSponsorshipInput,
  CrmUserSummary,
  CrmUserRole,
  CrmUserTeam,
  CrmDashboard,
  CrmEventSummary,
  CrmStatus,
  CurrentPipelineRecord,
  EmailCampaignRecord,
  EmailRecipientRecord,
  EmailSyncSummary,
  EmailTemplateRecord,
  EventAttendanceStatus,
  LogEventPartnerResponseInput,
  MeetingLogRecord,
  MeetingNoteDetail,
  MeetingNotePartnerOption,
  MyContactPartner,
  PartnerAccount,
  PartnerContact,
  PartnerDirectoryRecord,
  PipelineDeal,
  TouchpointRecord,
  UpdateCompanyInput,
  UpdateCompanyInteractionInput,
  UpdateContactInput,
  UpdateDirectorInput,
  UpdateEmailTemplateInput,
  UpdateEventInput,
  UpdateMeetingLogInput,
  UpdateSponsorshipInput,
} from "./types";

const securedStatuses = new Set<CrmStatus>(["confirmed", "paid"]);
const confirmedEventStatuses = new Set<EventAttendanceStatus>(["confirmed", "attended"]);
const openStatuses = new Set<CrmStatus>([
  "prospecting",
  "pitched",
  "reached_out",
  "shortlist",
  "in_conversation",
  "followed_up",
]);

function sponsorshipStatusToEventStatus(status: CrmStatus): EventAttendanceStatus {
  if (status === "confirmed" || status === "paid") return "confirmed";
  if (status === "declined" || status === "backed_out") return "declined";
  if (status === "in_conversation" || status === "followed_up") return "interested";
  return "asked";
}

function toContact(row: typeof partners.$inferSelect): PartnerContact {
  const lastName = row.lastName?.trim() || null;
  const name = [row.firstName, lastName].filter(Boolean).join(" ");

  return {
    id: row.id,
    firstName: row.firstName,
    lastName,
    name,
    role: row.role,
    email: row.email,
    phone: row.phone,
    linkedin: row.linkedin,
    notes: row.notes,
    isPrimary: row.isPrimary,
    archived: row.archived,
  };
}

function toUserSummary(row: typeof users.$inferSelect): CrmUserSummary {
  const name = `${row.first_name} ${row.last_name}`.trim();
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    name,
    email: row.email,
    role: row.role,
    team: row.team,
  };
}

const directorRoles = new Set<CrmUserRole>(["admin", "member"]);
const directorTeams = new Set<CrmUserTeam>(["partnerships", "experiences", "mmd", "internal", "dev"]);

function normalizeDirectorRole(value: string | undefined): CrmUserRole {
  return value && directorRoles.has(value as CrmUserRole) ? (value as CrmUserRole) : "member";
}

function normalizeDirectorTeam(value: string | undefined): CrmUserTeam {
  return value && directorTeams.has(value as CrmUserTeam) ? (value as CrmUserTeam) : "partnerships";
}

function normalizeDirectorInput(input: CreateDirectorInput) {
  const firstName = input.firstName.trim();
  const lastName = input.lastName?.trim() ?? "";
  const email = input.email.trim().toLowerCase();
  if (!firstName) throw new Error("First name is required.");
  if (!email) throw new Error("Email is required.");

  return {
    first_name: firstName,
    last_name: lastName,
    email,
    role: normalizeDirectorRole(input.role),
    team: normalizeDirectorTeam(input.team),
    updatedAt: new Date(),
  };
}

const mergeTokenPattern = /{{\s*([a-z0-9_]+)\s*}}/gi;

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
    fullName: parts.join(" "),
  };
}

export function renderMergeTemplate(template: string, values: Record<string, string>) {
  mergeTokenPattern.lastIndex = 0;
  return template.replace(mergeTokenPattern, (_, rawToken) => {
    const token = String(rawToken ?? "").toLowerCase();
    return values[token] ?? "";
  });
}

function emailTemplateRecord(row: typeof emailTemplates.$inferSelect): EmailTemplateRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    subjectTemplate: row.subjectTemplate,
    bodyTemplate: row.bodyTemplate,
    archived: row.archived,
    updatedAtIso: row.updatedAt.toISOString(),
    lastUsedAtIso: row.lastUsedAt?.toISOString() ?? null,
  };
}

function sumAmounts(rows: Array<{ amount: number | null }>) {
  return rows.reduce((total, row) => total + (row.amount ?? 0), 0);
}

function parseTags(value: string[] | undefined) {
  return (value ?? []).map((tag) => tag.trim()).filter(Boolean);
}

function contactActivityTypeToInteractionType(
  type: typeof contactActivities.$inferSelect.type,
): CompanyInteractionRecord["type"] {
  return type === "note" ? "other" : (type as CompanyInteractionRecord["type"]);
}

function contactActivityIsMeetingLog(activity: typeof contactActivities.$inferSelect) {
  return activity.type === "meeting" && Boolean(activity.content || activity.legacyMeetingNoteId);
}

function contactActivitySubject(input: {
  subject?: string | null;
  type: CompanyInteractionRecord["type"];
  partnerName?: string | null;
}) {
  const subject = input.subject?.trim();
  if (subject) return subject;
  const typeLabel = input.type.replace("_", " ");
  return input.partnerName ? `${typeLabel} with ${input.partnerName}` : typeLabel;
}

async function findOrCreateCompanyByName(nameValue: string) {
  const name = nameValue.trim();
  if (!name) throw new Error("Company name is required.");

  const [existing] = await db
    .select()
    .from(companies)
    .where(eq(companies.name, name))
    .limit(1);

  if (existing) return existing;

  const [company] = await db.insert(companies).values({ name }).returning();
  return company;
}

export async function listUsers(): Promise<CrmUserSummary[]> {
  const rows = await db.select().from(users).orderBy(asc(users.first_name), asc(users.last_name));
  return rows.map(toUserSummary);
}

export async function createDirector(input: CreateDirectorInput) {
  const [director] = await db
    .insert(users)
    .values({
      id: randomUUID(),
      ...normalizeDirectorInput(input),
    })
    .returning();
  return toUserSummary(director);
}

export async function updateDirector(input: UpdateDirectorInput) {
  const [director] = await db
    .update(users)
    .set(normalizeDirectorInput(input))
    .where(eq(users.id, input.id))
    .returning();
  if (!director) throw new Error("BizTech Director was not found.");
  return toUserSummary(director);
}

async function syncPartnerDirectors(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  partnerId: string,
  userIds: string[] | undefined,
) {
  if (!userIds) return;
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  await tx.delete(usersPartners).where(eq(usersPartners.partnerId, partnerId));
  if (uniqueUserIds.length) {
    await tx
      .insert(usersPartners)
      .values(uniqueUserIds.map((userId) => ({ partnerId, userId })))
      .onConflictDoNothing();
  }
}

export async function listPartnerAccounts(options?: {
  includeArchived?: boolean;
  search?: string;
}): Promise<PartnerAccount[]> {
  const allCompanies = await db
    .select()
    .from(companies)
    .orderBy(asc(companies.name));

  const allContacts = await db
    .select()
    .from(partners)
    .orderBy(desc(partners.isPrimary), asc(partners.firstName));

  const allSponsorships = await db.select().from(sponsors);
  const search = options?.search?.trim().toLowerCase();

  return allCompanies
    .filter((company) => options?.includeArchived || !company.archived)
    .map((company) => {
      const contacts = allContacts
        .filter((contact) => contact.companyId === company.id)
        .filter((contact) => options?.includeArchived || !contact.archived)
        .map(toContact);
      const companySponsorships = allSponsorships.filter(
        (sponsor) => sponsor.companyId === company.id && !sponsor.archived,
      );
      const primaryContact =
        contacts.find((contact) => contact.isPrimary && !contact.archived) ??
        contacts.find((contact) => !contact.archived) ??
        null;
      const latest = [...companySponsorships].sort(
        (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
      )[0];
      const openRows = companySponsorships.filter((row) =>
        openStatuses.has(row.status as CrmStatus),
      );
      const securedRows = companySponsorships.filter((row) =>
        securedStatuses.has(row.status as CrmStatus),
      );

      return {
        id: company.id,
        name: company.name,
        website: company.website,
        linkedin: company.linkedin,
        tier: company.tier,
        tags: company.tags,
        notes: company.notes,
        isAlumni: company.isAlumni,
        archived: company.archived,
        primaryContact,
        contacts,
        sponsorshipCount: companySponsorships.length,
        pipelineValue: sumAmounts(openRows),
        securedValue: sumAmounts(securedRows),
        latestStatus: (latest?.status as CrmStatus | undefined) ?? null,
        nextFollowUpDate:
          companySponsorships
            .map((row) => row.followUpDate)
            .filter((value): value is string => Boolean(value))
            .sort()[0] ?? null,
        updatedAt: company.updatedAt,
      } satisfies PartnerAccount;
    })
    .filter((partner) => {
      if (!search) return true;
      const haystack = [
        partner.name,
        partner.primaryContact?.name,
        partner.primaryContact?.email,
        partner.tier,
        partner.tags.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
}

export async function listEvents(options?: { includeArchived?: boolean }): Promise<CrmEventSummary[]> {
  const [eventRows, sponsorRows, partnerRoleRows, sponsorContactRows, directorRows] = await Promise.all([
    db.select().from(events).orderBy(desc(events.startDate)),
    db.select().from(sponsors),
    db
      .select({
        eventId: partnersEvents.eventId,
        eventRole: partnersEvents.eventRole,
        eventStatus: partnersEvents.eventStatus,
        partnerId: partners.id,
        partnerFirstName: partners.firstName,
        partnerLastName: partners.lastName,
        partnerArchived: partners.archived,
        companyName: companies.name,
        companyArchived: companies.archived,
      })
      .from(partnersEvents)
      .innerJoin(partners, eq(partnersEvents.partnerId, partners.id))
      .innerJoin(companies, eq(partners.companyId, companies.id))
      .orderBy(asc(partners.firstName), asc(partners.lastName), asc(partnersEvents.eventRole)),
    db
      .select({
        eventId: sponsors.eventId,
        sponsorStatus: sponsors.status,
        sponsorArchived: sponsors.archived,
        partnerId: partners.id,
        partnerFirstName: partners.firstName,
        partnerLastName: partners.lastName,
        partnerArchived: partners.archived,
        companyName: companies.name,
        companyArchived: companies.archived,
      })
      .from(sponsors)
      .innerJoin(partners, eq(sponsors.primaryContactId, partners.id))
      .innerJoin(companies, eq(partners.companyId, companies.id))
      .orderBy(asc(partners.firstName), asc(partners.lastName)),
    db
      .select({ eventId: usersEvents.eventId, user: users })
      .from(usersEvents)
      .innerJoin(users, eq(usersEvents.userId, users.id))
      .orderBy(asc(users.first_name), asc(users.last_name)),
  ]);

  return eventRows
    .filter((event) => options?.includeArchived || !event.archived)
    .map((event) => {
      const eventSponsors = sponsorRows.filter(
        (sponsor) => sponsor.eventId === event.id && !sponsor.archived,
      );
      const eventPartnerRoles = partnerRoleRows.filter(
        (role) =>
          role.eventId === event.id &&
          (options?.includeArchived || (!role.partnerArchived && !role.companyArchived)),
      );
      const eventSponsorContacts = sponsorContactRows.filter(
        (row) =>
          row.eventId === event.id &&
          (options?.includeArchived || (!row.sponsorArchived && !row.partnerArchived && !row.companyArchived)),
      );
      const peopleByKey = new Map<string, CrmEventSummary["partnerResponses"][number]>();

      eventPartnerRoles.forEach((role) => {
        peopleByKey.set(`${role.partnerId}:${role.eventRole}`, {
          partnerId: role.partnerId,
          partnerName: [role.partnerFirstName, role.partnerLastName].filter(Boolean).join(" "),
          companyName: role.companyName,
          eventRole: role.eventRole as CrmEventSummary["partnerResponses"][number]["eventRole"],
          eventStatus: role.eventStatus as CrmEventSummary["partnerResponses"][number]["eventStatus"],
        });
      });

      eventSponsorContacts.forEach((contact) => {
        const key = `${contact.partnerId}:sponsor`;
        if (peopleByKey.has(key)) return;
        peopleByKey.set(key, {
          partnerId: contact.partnerId,
          partnerName: [contact.partnerFirstName, contact.partnerLastName].filter(Boolean).join(" "),
          companyName: contact.companyName,
          eventRole: "sponsor",
          eventStatus: sponsorshipStatusToEventStatus(contact.sponsorStatus as CrmStatus),
        });
      });

      const eventPeople = Array.from(peopleByKey.values());
      const eventDirectors = directorRows
        .filter((row) => row.eventId === event.id)
        .map((row) => toUserSummary(row.user));

      return {
        id: event.id,
        name: event.name,
        year: event.year,
        startDate: event.startDate,
        endDate: event.endDate,
        outreachStartDate: event.outreachStartDate,
        sponsorshipGoal: event.sponsorshipGoal,
        confirmedPartnerGoal: event.confirmedPartnerGoal,
        tierConfigs: event.tierConfigs ?? [],
        notes: event.notes,
        archived: event.archived,
        securedValue: sumAmounts(
          eventSponsors.filter((sponsor) =>
            securedStatuses.has(sponsor.status as CrmStatus),
          ),
        ),
        pipelineValue: sumAmounts(
          eventSponsors.filter((sponsor) =>
            openStatuses.has(sponsor.status as CrmStatus),
          ),
        ),
        sponsorCount: eventSponsors.length,
        confirmedPartnerCount: new Set(
          eventPeople
            .filter((person) => confirmedEventStatuses.has(person.eventStatus))
            .map((person) => person.partnerId),
        ).size,
        partnerResponses: eventPeople,
        directors: eventDirectors,
      };
    });
}

export async function listPipelineDeals(options?: {
  includeArchived?: boolean;
}): Promise<PipelineDeal[]> {
  const rows = await db
    .select({
      sponsor: sponsors,
      company: companies,
      event: events,
      contact: partners,
      owner: users,
    })
    .from(sponsors)
    .innerJoin(companies, eq(sponsors.companyId, companies.id))
    .leftJoin(events, eq(sponsors.eventId, events.id))
    .leftJoin(partners, eq(sponsors.primaryContactId, partners.id))
    .leftJoin(users, eq(sponsors.ownerUserId, users.id))
    .where(options?.includeArchived ? undefined : eq(sponsors.archived, false))
    .orderBy(desc(sponsors.updatedAt));

  return rows
    .filter(({ company, event }) => options?.includeArchived || (!company.archived && !event?.archived))
    .map(({ sponsor, company, event, contact, owner }) => ({
    id: sponsor.id,
    partnerId: company.id,
    partnerName: company.name,
    eventId: sponsor.eventId ?? null,
    eventName: event?.name ?? null,
    primaryContactId: sponsor.primaryContactId,
    primaryContactName: contact
      ? [contact.firstName, contact.lastName].filter(Boolean).join(" ")
      : null,
    ownerUserId: sponsor.ownerUserId,
    ownerName: owner ? toUserSummary(owner).name : null,
    amount: sponsor.amount,
    tier: sponsor.tier,
    status: sponsor.status as CrmStatus,
    role: sponsor.role,
    followUpDate: sponsor.followUpDate,
    notes: sponsor.notes,
    updatedAt: sponsor.updatedAt,
  }));
}

export async function listCurrentPipeline(): Promise<CurrentPipelineRecord[]> {
  const deals = await listPipelineDeals();
  return deals.map(({ updatedAt, ...deal }) => ({
    ...deal,
    updatedAtIso: updatedAt.toISOString(),
  }));
}

export async function listMeetingLogs(): Promise<MeetingLogRecord[]> {
  const [activityRows, companyLinks, partnerLinks, eventLinks, attendeeLinks] = await Promise.all([
    db.select().from(contactActivities).orderBy(desc(contactActivities.occurredAt)),
    db
      .select({
        activityId: contactActivityCompanies.activityId,
        companyId: companies.id,
        companyName: companies.name,
        companyArchived: companies.archived,
      })
      .from(contactActivityCompanies)
      .innerJoin(companies, eq(contactActivityCompanies.companyId, companies.id)),
    db
      .select({
        activityId: contactActivityPartners.activityId,
        partnerId: partners.id,
        firstName: partners.firstName,
        lastName: partners.lastName,
        partnerArchived: partners.archived,
        companyArchived: companies.archived,
      })
      .from(contactActivityPartners)
      .innerJoin(partners, eq(contactActivityPartners.partnerId, partners.id))
      .innerJoin(companies, eq(partners.companyId, companies.id)),
    db
      .select({
        activityId: contactActivityEvents.activityId,
        eventId: events.id,
        eventName: events.name,
        eventArchived: events.archived,
      })
      .from(contactActivityEvents)
      .innerJoin(events, eq(contactActivityEvents.eventId, events.id)),
    db
      .select({
        activityId: contactActivityAttendees.activityId,
        user: users,
      })
      .from(contactActivityAttendees)
      .innerJoin(users, eq(contactActivityAttendees.userId, users.id)),
  ]);

  return activityRows.filter(contactActivityIsMeetingLog).map((activity) => ({
    id: activity.id,
    title: activity.subject,
    meetingDateIso: activity.occurredAt.toISOString(),
    source: activity.source,
    content: activity.content ?? "",
    summary: activity.summary,
    companies: companyLinks
      .filter((link) => link.activityId === activity.id)
      .filter((link) => !link.companyArchived)
      .map((link) => ({ id: link.companyId, name: link.companyName })),
    partners: partnerLinks
      .filter((link) => link.activityId === activity.id)
      .filter((link) => !link.partnerArchived && !link.companyArchived)
      .map((link) => ({
        id: link.partnerId,
        name: [link.firstName, link.lastName].filter(Boolean).join(" "),
      })),
    events: eventLinks
      .filter((link) => link.activityId === activity.id)
      .filter((link) => !link.eventArchived)
      .map((link) => ({ id: link.eventId, name: link.eventName })),
    attendees: attendeeLinks
      .filter((link) => link.activityId === activity.id)
      .map((link) => toUserSummary(link.user)),
  }));
}

export async function getMeetingNoteById(id: string): Promise<MeetingNoteDetail | null> {
  const [note] = await db
    .select({
      id: meetingNotes.id,
      title: meetingNotes.title,
      meetingDate: meetingNotes.meetingDate,
      source: meetingNotes.source,
      originalFilename: meetingNotes.originalFilename,
      content: meetingNotes.content,
      summary: meetingNotes.summary,
      createdBy: meetingNotes.createdBy,
      createdAt: meetingNotes.createdAt,
      updatedAt: meetingNotes.updatedAt,
    })
    .from(meetingNotes)
    .where(eq(meetingNotes.id, id));

  if (!note) return null;

  const [partnerRows, attendeeRows, eventRows, creatorRows] = await Promise.all([
    db
      .select({
        partnerId: partners.id,
        partnerFirstName: partners.firstName,
        partnerLastName: partners.lastName,
        companyId: companies.id,
        companyName: companies.name,
      })
      .from(meetingNotePartners)
      .innerJoin(partners, eq(meetingNotePartners.partnerId, partners.id))
      .leftJoin(companies, eq(partners.companyId, companies.id))
      .where(eq(meetingNotePartners.meetingNoteId, id)),
    db
      .select({
        userId: users.id,
        firstName: users.first_name,
        lastName: users.last_name,
      })
      .from(meetingNoteAttendees)
      .innerJoin(users, eq(meetingNoteAttendees.userId, users.id))
      .where(eq(meetingNoteAttendees.meetingNoteId, id)),
    db
      .select({
        eventId: events.id,
        eventName: events.name,
      })
      .from(meetingNoteEvents)
      .innerJoin(events, eq(meetingNoteEvents.eventId, events.id))
      .where(eq(meetingNoteEvents.meetingNoteId, id)),
    note.createdBy
      ? db
          .select({ firstName: users.first_name, lastName: users.last_name })
          .from(users)
          .where(eq(users.id, note.createdBy))
      : Promise.resolve([] as Array<{ firstName: string; lastName: string }>),
  ]);

  const companyMap = new Map<
    string,
    { id: string; name: string; partners: Array<{ id: string; firstName: string; lastName: string | null }> }
  >();
  const noCompanyPartners: Array<{ id: string; firstName: string; lastName: string | null }> = [];

  for (const row of partnerRows) {
    const partnerEntry = {
      id: row.partnerId,
      firstName: row.partnerFirstName,
      lastName: row.partnerLastName,
    };
    if (row.companyId && row.companyName) {
      if (!companyMap.has(row.companyId)) {
        companyMap.set(row.companyId, { id: row.companyId, name: row.companyName, partners: [] });
      }
      companyMap.get(row.companyId)!.partners.push(partnerEntry);
    } else {
      noCompanyPartners.push(partnerEntry);
    }
  }

  return {
    ...note,
    source: note.source as "upload" | "paste",
    partnersByCompany: Array.from(companyMap.values()),
    noCompanyPartners,
    attendees: attendeeRows,
    events: eventRows,
    creator: creatorRows[0] ?? null,
  };
}

export async function getMeetingNoteForEdit(
  id: string,
  userId: string,
): Promise<MeetingNoteDetail | null> {
  const note = await getMeetingNoteById(id);
  if (!note) return null;
  if (note.createdBy !== userId) return null;
  return note;
}

export async function listMeetingNotePartners(): Promise<MeetingNotePartnerOption[]> {
  const rows = await db
    .select({
      id: partners.id,
      firstName: partners.firstName,
      lastName: partners.lastName,
      companyId: companies.id,
      companyName: companies.name,
    })
    .from(partners)
    .leftJoin(companies, eq(partners.companyId, companies.id))
    .orderBy(asc(companies.name), asc(partners.lastName));

  return rows.map((row) => ({
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    companyId: row.companyId,
    companyName: row.companyName,
  }));
}

export async function listMyAssignedEventIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ eventId: usersEvents.eventId })
    .from(usersEvents)
    .where(eq(usersEvents.userId, userId));
  return rows.map((row) => row.eventId);
}

export async function listMyContactPartners(userId: string): Promise<MyContactPartner[]> {
  const [primaryActivities, attendeeActivities] = await Promise.all([
    db
      .select({
        id: contactActivities.id,
        occurredAt: contactActivities.occurredAt,
        primaryPartnerId: contactActivities.primaryPartnerId,
      })
      .from(contactActivities)
      .where(eq(contactActivities.primaryUserId, userId)),
    db
      .select({
        id: contactActivities.id,
        occurredAt: contactActivities.occurredAt,
        primaryPartnerId: contactActivities.primaryPartnerId,
      })
      .from(contactActivities)
      .innerJoin(
        contactActivityAttendees,
        eq(contactActivityAttendees.activityId, contactActivities.id),
      )
      .where(eq(contactActivityAttendees.userId, userId)),
  ]);

  const activityById = new Map<string, { occurredAt: Date; primaryPartnerId: string | null }>();
  for (const row of [...primaryActivities, ...attendeeActivities]) {
    activityById.set(row.id, { occurredAt: row.occurredAt, primaryPartnerId: row.primaryPartnerId });
  }
  if (activityById.size === 0) return [];

  const partnerLinks = await db
    .select({
      activityId: contactActivityPartners.activityId,
      partnerId: contactActivityPartners.partnerId,
    })
    .from(contactActivityPartners)
    .where(inArray(contactActivityPartners.activityId, Array.from(activityById.keys())));

  const partnerLatest = new Map<string, Date>();
  for (const [, activity] of activityById) {
    if (!activity.primaryPartnerId) continue;
    const cur = partnerLatest.get(activity.primaryPartnerId);
    if (!cur || cur < activity.occurredAt) partnerLatest.set(activity.primaryPartnerId, activity.occurredAt);
  }
  for (const link of partnerLinks) {
    const activity = activityById.get(link.activityId);
    if (!activity) continue;
    const cur = partnerLatest.get(link.partnerId);
    if (!cur || cur < activity.occurredAt) partnerLatest.set(link.partnerId, activity.occurredAt);
  }
  if (partnerLatest.size === 0) return [];

  const partnerRows = await db
    .select({
      partner: partners,
      company: companies,
    })
    .from(partners)
    .innerJoin(companies, eq(partners.companyId, companies.id))
    .where(
      and(
        inArray(partners.id, Array.from(partnerLatest.keys())),
        eq(partners.archived, false),
        eq(companies.archived, false),
      ),
    );

  return partnerRows
    .map(({ partner, company }) => ({
      partnerId: partner.id,
      partnerName: [partner.firstName, partner.lastName].filter(Boolean).join(" "),
      companyId: company.id,
      companyName: company.name,
      lastContactedAt: partnerLatest.get(partner.id)!.toISOString(),
    }))
    .sort((a, b) => b.lastContactedAt.localeCompare(a.lastContactedAt));
}

export async function listTouchpoints(): Promise<TouchpointRecord[]> {
  const [rows, partnerLinks, attendeeLinks] = await Promise.all([
    db
      .select({
        activity: contactActivities,
        company: companies,
        partner: partners,
        user: users,
      })
      .from(contactActivities)
      .innerJoin(companies, eq(contactActivities.primaryCompanyId, companies.id))
      .leftJoin(users, eq(contactActivities.primaryUserId, users.id))
      .leftJoin(partners, eq(contactActivities.primaryPartnerId, partners.id))
      .where(eq(companies.archived, false))
      .orderBy(desc(contactActivities.occurredAt), desc(contactActivities.createdAt)),
    db
      .select({
        activityId: contactActivityPartners.activityId,
        partnerId: partners.id,
        firstName: partners.firstName,
        lastName: partners.lastName,
        partnerArchived: partners.archived,
      })
      .from(contactActivityPartners)
      .innerJoin(partners, eq(contactActivityPartners.partnerId, partners.id)),
    // 1. Fetch attendee links
    db
      .select({
        activityId: contactActivityAttendees.activityId,
        user: users,
      })
      .from(contactActivityAttendees)
      .innerJoin(users, eq(contactActivityAttendees.userId, users.id)),
  ]);

  return rows
    .filter(({ activity }) => !contactActivityIsMeetingLog(activity))
    .map(({ activity, company, partner, user }) => ({
      id: activity.id,
      companyId: activity.primaryCompanyId ?? company.id,
      companyName: company.name,
      partnerId: activity.primaryPartnerId,
      partnerName: partner
        ? [partner.firstName, partner.lastName].filter(Boolean).join(" ")
        : null,
      partners: partnerLinks
        .filter((link) => link.activityId === activity.id && !link.partnerArchived)
        .map((link) => ({
          id: link.partnerId,
          name: [link.firstName, link.lastName].filter(Boolean).join(" "),
        })),
      // 2. Map the attendees property required by TouchpointRecord
      attendees: attendeeLinks
        .filter((link) => link.activityId === activity.id)
        .map((link) => toUserSummary(link.user)),
      userId: activity.primaryUserId ?? activity.createdBy ?? "",
      userName: user ? toUserSummary(user).name : "No director",
      type: contactActivityTypeToInteractionType(activity.type),
      direction: activity.direction as CompanyInteractionRecord["direction"],
      subject: activity.subject,
      notes: activity.notes,
      contactedAtIso: activity.occurredAt.toISOString(),
      followUpDate: activity.followUpDate,
      source: activity.source,
      createdAtIso: activity.createdAt.toISOString(),
      externalThreadId: activity.externalThreadId,
      createdBy: activity.createdBy,
    }));
}

export async function getDashboard(): Promise<CrmDashboard> {
  const [partnerRows, eventRows, dealRows] = await Promise.all([
    listPartnerAccounts(),
    listEvents(),
    listPipelineDeals(),
  ]);

  const securedValue = dealRows
    .filter((deal) => securedStatuses.has(deal.status))
    .reduce((total, deal) => total + (deal.amount ?? 0), 0);
  const openPipelineValue = dealRows
    .filter((deal) => openStatuses.has(deal.status))
    .reduce((total, deal) => total + (deal.amount ?? 0), 0);
  const annualGoal = eventRows.reduce(
    (total, event) => total + (event.sponsorshipGoal ?? 0),
    0,
  );
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const pipelineMap = new Map<CrmStatus, { count: number; value: number }>();
  for (const deal of dealRows) {
    const current = pipelineMap.get(deal.status) ?? { count: 0, value: 0 };
    pipelineMap.set(deal.status, {
      count: current.count + 1,
      value: current.value + (deal.amount ?? 0),
    });
  }

  const upcomingFollowUps = dealRows
    .filter((deal) => {
      if (!deal.followUpDate) return false;
      const due = new Date(`${deal.followUpDate}T00:00:00`);
      return due <= sevenDaysFromNow;
    })
    .sort((left, right) =>
      String(left.followUpDate).localeCompare(String(right.followUpDate)),
    )
    .slice(0, 8);

  return {
    securedValue,
    openPipelineValue,
    annualGoal,
    annualProgressPct: annualGoal > 0 ? (securedValue / annualGoal) * 100 : 0,
    followUpsDueCount: upcomingFollowUps.length,
    partnerCount: partnerRows.length,
    eventCount: eventRows.filter((event) => !event.archived).length,
    events: eventRows,
    pipelineByStatus: Array.from(pipelineMap.entries()).map(
      ([status, value]) => ({
        status,
        ...value,
      }),
    ),
    upcomingFollowUps,
  };
}

export async function createPartnerAccount(input: CreatePartnerInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Partner name is required.");

  const [company] = await db
    .insert(companies)
    .values({
      name,
      website: input.website?.trim() || null,
      linkedin: input.linkedin?.trim() || null,
      tier: input.tier?.trim() || null,
      tags: input.tags ?? [],
      notes: input.notes?.trim() || null,
      isAlumni: input.isAlumni ?? false,
    })
    .returning();

  if (input.primaryContact?.firstName.trim()) {
    await db.insert(partners).values({
      companyId: company.id,
      firstName: input.primaryContact.firstName.trim(),
      lastName: input.primaryContact.lastName?.trim() || null,
      role: input.primaryContact.role?.trim() || null,
      email: input.primaryContact.email?.trim() || null,
      phone: input.primaryContact.phone?.trim() || null,
      linkedin: input.primaryContact.linkedin?.trim() || null,
      isPrimary: true,
    });
  }

  return company;
}

export async function listCompanyDirectory(): Promise<CompanyDirectoryRecord[]> {
  const [accounts, deals, attendanceRows, documentRows, communicationRows] = await Promise.all([
    listPartnerAccounts(),
    listPipelineDeals(),
    db
      .select({
        companyId: companyEvents.companyId,
        eventId: companyEvents.eventId,
        eventRole: companyEvents.eventRole,
        eventStatus: companyEvents.eventStatus,
        eventName: events.name,
        eventArchived: events.archived,
      })
      .from(companyEvents)
      .innerJoin(events, eq(companyEvents.eventId, events.id))
      .orderBy(desc(events.startDate), asc(companyEvents.eventRole)),
    db
      .select({
        document: partnerDocuments,
        eventName: events.name,
        partnerFirstName: partners.firstName,
        partnerLastName: partners.lastName,
      })
      .from(partnerDocuments)
      .leftJoin(events, eq(partnerDocuments.eventId, events.id))
      .leftJoin(partners, eq(partnerDocuments.partnerId, partners.id))
      .orderBy(desc(partnerDocuments.updatedAt)),
    db
      .select({
        activity: contactActivities,
        user: users,
        partnerFirstName: partners.firstName,
        partnerLastName: partners.lastName,
      })
      .from(contactActivities)
      .leftJoin(users, eq(contactActivities.primaryUserId, users.id))
      .leftJoin(partners, eq(contactActivities.primaryPartnerId, partners.id))
      .orderBy(desc(contactActivities.occurredAt)),
  ]);

  return accounts.map((account) => {
    const { updatedAt, ...clientAccount } = account;
    const activeDeals = deals
      .filter((deal) => deal.partnerId === account.id)
      .map((deal) => ({
        id: deal.id,
        eventName: deal.eventName,
        status: deal.status,
        amount: deal.amount,
        followUpDate: deal.followUpDate,
        primaryContactName: deal.primaryContactName,
      }));

    return {
      ...clientAccount,
      activeContactsCount: account.contacts.filter((contact) => !contact.archived).length,
      activeDeals,
      eventAttendances: attendanceRows
        .filter((row) => row.companyId === account.id)
        .filter((row) => !row.eventArchived)
        .map((row) => ({
          eventId: row.eventId,
          eventName: row.eventName,
          eventRole: row.eventRole as CompanyDirectoryRecord["eventAttendances"][number]["eventRole"],
          eventStatus: row.eventStatus as CompanyDirectoryRecord["eventAttendances"][number]["eventStatus"],
        })),
      documents: documentRows
        .filter((row) => row.document.companyId === account.id)
        .map((row) => ({
          id: row.document.id,
          companyId: row.document.companyId,
          partnerId: row.document.partnerId,
          partnerName: [row.partnerFirstName, row.partnerLastName].filter(Boolean).join(" ") || null,
          eventId: row.document.eventId,
          eventName: row.eventName,
          title: row.document.title,
          type: row.document.type,
          status: row.document.status,
          url: row.document.url,
          fileName: row.document.fileName,
          notes: row.document.notes,
          updatedAtIso: row.document.updatedAt.toISOString(),
        })),
      communications: communicationRows
        .filter((row) => row.activity.primaryCompanyId === account.id)
        .map((row) => ({
          id: row.activity.id,
          companyId: row.activity.primaryCompanyId ?? account.id,
          partnerId: row.activity.primaryPartnerId,
          partnerName: [row.partnerFirstName, row.partnerLastName].filter(Boolean).join(" ") || null,
          userId: row.activity.primaryUserId ?? row.activity.createdBy ?? "",
          userName: row.user ? toUserSummary(row.user).name : "No director",
          type: contactActivityTypeToInteractionType(row.activity.type),
          direction: row.activity.direction as CompanyInteractionRecord["direction"],
          subject: row.activity.subject,
          notes: row.activity.notes ?? row.activity.summary,
          contactedAtIso: row.activity.occurredAt.toISOString(),
          followUpDate: row.activity.followUpDate,
        })),
      updatedAtIso: updatedAt.toISOString(),
    };
  });
}

export async function listPartnerDirectory(): Promise<PartnerDirectoryRecord[]> {
  const [companyRows, contactRows, dealRows, attendanceRows, directorRows] = await Promise.all([
    db.select().from(companies).orderBy(asc(companies.name)),
    db.select().from(partners).orderBy(desc(partners.isPrimary), asc(partners.firstName)),
    listPipelineDeals(),
    db
      .select({
        partnerId: partnersEvents.partnerId,
        eventId: partnersEvents.eventId,
        eventRole: partnersEvents.eventRole,
        eventStatus: partnersEvents.eventStatus,
        eventName: events.name,
        eventArchived: events.archived,
      })
      .from(partnersEvents)
      .innerJoin(events, eq(partnersEvents.eventId, events.id))
      .orderBy(desc(events.startDate), asc(partnersEvents.eventRole)),
    db
      .select({
        partnerId: usersPartners.partnerId,
        user: users,
      })
      .from(usersPartners)
      .innerJoin(users, eq(usersPartners.userId, users.id))
      .orderBy(asc(users.first_name), asc(users.last_name)),
  ]);

  const companyMap = new Map(companyRows.map((company) => [company.id, company]));

  return contactRows
    .filter((contact) => !contact.archived)
    .filter((contact) => {
      const company = companyMap.get(contact.companyId);
      return company ? !company.archived : false;
    })
    .map((contact) => {
    const company = companyMap.get(contact.companyId);
    const companyDeals = dealRows.filter((deal) => deal.partnerId === contact.companyId);
    const latest = companyDeals[0];
    const nextFollowUpDate =
      companyDeals
        .map((deal) => deal.followUpDate)
        .filter((value): value is string => Boolean(value))
        .sort()[0] ?? null;

    return {
      ...toContact(contact),
      companyId: contact.companyId,
      companyName: company?.name ?? "Unknown company",
      companyTier: company?.tier ?? null,
      companyArchived: company?.archived ?? false,
      latestStatus: latest?.status ?? null,
      nextFollowUpDate,
      eventAttendances: attendanceRows
        .filter((row) => row.partnerId === contact.id)
        .filter((row) => !row.eventArchived)
        .map((row) => ({
          eventId: row.eventId,
          eventName: row.eventName,
          eventRole: row.eventRole as PartnerDirectoryRecord["eventAttendances"][number]["eventRole"],
          eventStatus: row.eventStatus as PartnerDirectoryRecord["eventAttendances"][number]["eventStatus"],
        })),
      directors: directorRows
        .filter((row) => row.partnerId === contact.id)
        .map((row) => toUserSummary(row.user)),
      updatedAtIso: contact.updatedAt.toISOString(),
    };
  });
}

export async function createCompany(input: CreateCompanyInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Company name is required.");

  const [company] = await db
    .insert(companies)
    .values({
      name,
      website: input.website?.trim() || null,
      linkedin: input.linkedin?.trim() || null,
      tier: input.tier?.trim() || null,
      tags: parseTags(input.tags),
      notes: input.notes?.trim() || null,
      isAlumni: input.isAlumni ?? false,
    })
    .returning();

  return company;
}

export async function updateCompany(input: UpdateCompanyInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Company name is required.");

  const [company] = await db
    .update(companies)
    .set({
      name,
      website: input.website?.trim() || null,
      linkedin: input.linkedin?.trim() || null,
      tier: input.tier?.trim() || null,
      tags: parseTags(input.tags),
      notes: input.notes?.trim() || null,
      isAlumni: input.isAlumni ?? false,
      archived: input.archived ?? false,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, input.id))
    .returning();

  return company;
}

export async function createContact(input: CreateContactInput) {
  const firstName = input.firstName.trim();
  if (!firstName) throw new Error("Partner first name is required.");
  if (!input.email?.trim() && !input.linkedin?.trim()) {
    throw new Error("Partner needs either an email or LinkedIn.");
  }

  const companyId =
    input.companyId ||
    (input.companyName ? (await findOrCreateCompanyByName(input.companyName)).id : null);

  if (!companyId) throw new Error("Company is required.");

  return db.transaction(async (tx) => {
    if (input.isPrimary) {
      await tx
        .update(partners)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(eq(partners.companyId, companyId));
    }

    const [contact] = await tx
      .insert(partners)
      .values({
        companyId,
        firstName,
        lastName: input.lastName?.trim() || null,
        role: input.role?.trim() || null,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        linkedin: input.linkedin?.trim() || null,
        notes: input.notes?.trim() || null,
        isPrimary: input.isPrimary ?? false,
      })
      .returning();

    await syncPartnerDirectors(tx, contact.id, input.directorUserIds);
    return contact;
  });
}

export async function updateContact(input: UpdateContactInput) {
  const firstName = input.firstName.trim();
  if (!firstName) throw new Error("Partner first name is required.");
  if (!input.email?.trim() && !input.linkedin?.trim()) {
    throw new Error("Partner needs either an email or LinkedIn.");
  }

  const companyId =
    input.companyId ||
    (input.companyName ? (await findOrCreateCompanyByName(input.companyName)).id : null);

  if (!companyId) throw new Error("Company is required.");

  return db.transaction(async (tx) => {
    if (input.isPrimary) {
      await tx
        .update(partners)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(and(eq(partners.companyId, companyId), ne(partners.id, input.id)));
    }

    const [contact] = await tx
      .update(partners)
      .set({
        companyId,
        firstName,
        lastName: input.lastName?.trim() || null,
        role: input.role?.trim() || null,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        linkedin: input.linkedin?.trim() || null,
        notes: input.notes?.trim() || null,
        isPrimary: input.isPrimary ?? false,
        archived: input.archived ?? false,
        updatedAt: new Date(),
      })
      .where(eq(partners.id, input.id))
      .returning();

    await syncPartnerDirectors(tx, contact.id, input.directorUserIds);
    return contact;
  });
}

export async function linkContactToCompany(input: { partnerId: string; companyId: string }) {
  if (!input.partnerId) throw new Error("Partner is required.");
  if (!input.companyId) throw new Error("Company is required.");

  const [contact] = await db
    .update(partners)
    .set({
      companyId: input.companyId,
      isPrimary: false,
      updatedAt: new Date(),
    })
    .where(eq(partners.id, input.partnerId))
    .returning();

  return contact;
}

export async function addPartnerEventRole(input: AddPartnerEventRoleInput) {
  const eventStatus = input.eventStatus ?? "asked";
  const insert = db
    .insert(partnersEvents)
    .values({
      partnerId: input.partnerId,
      eventId: input.eventId,
      eventRole: input.eventRole,
      eventStatus,
    });

  if (input.eventStatus) {
    await insert.onConflictDoUpdate({
      target: [partnersEvents.partnerId, partnersEvents.eventId, partnersEvents.eventRole],
      set: { eventStatus },
    });
    return;
  }

  await insert.onConflictDoNothing();
}

export async function updatePartnerEventStatus(input: AddPartnerEventRoleInput & { eventStatus: EventAttendanceStatus }) {
  await db
    .update(partnersEvents)
    .set({ eventStatus: input.eventStatus })
    .where(
      and(
        eq(partnersEvents.partnerId, input.partnerId),
        eq(partnersEvents.eventId, input.eventId),
        eq(partnersEvents.eventRole, input.eventRole),
      ),
    );
}

export async function logEventPartnerResponse(input: LogEventPartnerResponseInput) {
  if (!input.eventId) throw new Error("Event is required.");
  if (!input.eventRole) throw new Error("Response role is required.");

  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.id, input.eventId))
    .limit(1);
  if (!event) throw new Error("Event could not be found.");

  let partnerId = input.partnerId?.trim();
  if (!partnerId) {
    const firstName = input.firstName?.trim() ?? "";
    if (!firstName) throw new Error("New person first name is required.");
    if (!input.email?.trim() && !input.linkedin?.trim()) {
      throw new Error("New person needs either an email or LinkedIn.");
    }

    const contact = await createContact({
      firstName,
      lastName: input.lastName?.trim() || undefined,
      companyId: input.companyId,
      companyName: input.companyName,
      role: input.role,
      email: input.email,
      linkedin: input.linkedin,
    });
    partnerId = contact.id;
  }

  await addPartnerEventRole({
    partnerId,
    eventId: input.eventId,
    eventRole: input.eventRole,
    eventStatus: input.eventStatus ?? "asked",
  });

  return { partnerId };
}

export async function removePartnerEventRole(input: AddPartnerEventRoleInput) {
  await db
    .delete(partnersEvents)
    .where(
      and(
        eq(partnersEvents.partnerId, input.partnerId),
        eq(partnersEvents.eventId, input.eventId),
        eq(partnersEvents.eventRole, input.eventRole),
      ),
    );
}

export async function addCompanyEventRole(input: AddCompanyEventRoleInput) {
  const eventStatus = input.eventStatus ?? "asked";
  const insert = db
    .insert(companyEvents)
    .values({
      companyId: input.companyId,
      eventId: input.eventId,
      eventRole: input.eventRole,
      eventStatus,
    });

  if (input.eventStatus) {
    await insert.onConflictDoUpdate({
      target: [companyEvents.companyId, companyEvents.eventId, companyEvents.eventRole],
      set: { eventStatus },
    });
    return;
  }

  await insert.onConflictDoNothing();
}

export async function updateCompanyEventStatus(input: AddCompanyEventRoleInput & { eventStatus: EventAttendanceStatus }) {
  await db
    .update(companyEvents)
    .set({ eventStatus: input.eventStatus })
    .where(
      and(
        eq(companyEvents.companyId, input.companyId),
        eq(companyEvents.eventId, input.eventId),
        eq(companyEvents.eventRole, input.eventRole),
      ),
    );
}

export async function removeCompanyEventRole(input: AddCompanyEventRoleInput) {
  await db
    .delete(companyEvents)
    .where(
      and(
        eq(companyEvents.companyId, input.companyId),
        eq(companyEvents.eventId, input.eventId),
        eq(companyEvents.eventRole, input.eventRole),
      ),
    );
}

export async function archivePartnerAccount(companyId: string, archived = true) {
  const [company] = await db
    .update(companies)
    .set({ archived, updatedAt: new Date() })
    .where(eq(companies.id, companyId))
    .returning();
  return company;
}

async function syncEventDirectors(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  eventId: string,
  userIds: string[] | undefined,
) {
  if (!userIds) return;
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  await tx.delete(usersEvents).where(eq(usersEvents.eventId, eventId));
  if (uniqueUserIds.length) {
    await tx
      .insert(usersEvents)
      .values(uniqueUserIds.map((userId) => ({ eventId, userId })))
      .onConflictDoNothing();
  }
}

export async function createCrmEvent(input: CreateEventInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Event name is required.");

  return db.transaction(async (tx) => {
    const [event] = await tx
      .insert(events)
      .values({
        name,
        year: input.year ?? null,
        startDate: input.startDate,
        endDate: input.endDate || null,
        outreachStartDate: input.outreachStartDate || null,
        sponsorshipGoal: input.sponsorshipGoal ?? null,
        confirmedPartnerGoal: input.confirmedPartnerGoal ?? null,
        tierConfigs: input.tierConfigs ?? [],
        notes: input.notes?.trim() || null,
      })
      .returning();

    await syncEventDirectors(tx, event.id, input.directorUserIds);
    return event;
  });
}

export async function updateCrmEvent(input: UpdateEventInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Event name is required.");

  return db.transaction(async (tx) => {
    const [event] = await tx
      .update(events)
      .set({
        name,
        year: input.year ?? null,
        startDate: input.startDate,
        endDate: input.endDate || null,
        outreachStartDate: input.outreachStartDate || null,
        sponsorshipGoal: input.sponsorshipGoal ?? null,
        confirmedPartnerGoal: input.confirmedPartnerGoal ?? null,
        tierConfigs: input.tierConfigs ?? [],
        notes: input.notes?.trim() || null,
        archived: input.archived ?? false,
        updatedAt: new Date(),
      })
      .where(eq(events.id, input.id))
      .returning();

    await syncEventDirectors(tx, event.id, input.directorUserIds);
    return event;
  });
}

export async function createMeetingLog(input: CreateMeetingLogInput) {
  const title = input.title.trim();
  const content = input.content.trim();
  const meetingDate = input.meetingDate.trim();
  if (!title) throw new Error("Meeting title is required.");
  if (!content) throw new Error("Contact notes are required.");
  if (!meetingDate) throw new Error("Meeting date is required.");

  return db.transaction(async (tx) => {
    const attendeeUserIds = Array.from(new Set(input.attendeeUserIds?.filter(Boolean) ?? []));
    let companyId = input.companyId || null;
    if (!companyId && input.companyName?.trim()) {
      const [existingCompany] = await tx
        .select()
        .from(companies)
        .where(eq(companies.name, input.companyName.trim()))
        .limit(1);
      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        const [company] = await tx
          .insert(companies)
          .values({ name: input.companyName.trim() })
          .returning();
        companyId = company.id;
      }
    }

    let partnerId = input.partnerId || null;
    if (!partnerId && input.partnerFirstName?.trim()) {
      if (!companyId) throw new Error("A company is required to create a new partner.");
      if (!input.partnerEmail?.trim() && !input.partnerLinkedin?.trim()) {
        throw new Error("A new partner needs either an email or LinkedIn.");
      }
      const [partner] = await tx
        .insert(partners)
        .values({
          companyId,
          firstName: input.partnerFirstName.trim(),
          lastName: input.partnerLastName?.trim() || null,
          email: input.partnerEmail?.trim() || null,
          linkedin: input.partnerLinkedin?.trim() || null,
        })
        .returning();
      partnerId = partner.id;
      await syncPartnerDirectors(tx, partner.id, attendeeUserIds);
    }
    if (partnerId && !companyId) {
      const [linkedPartner] = await tx
        .select({ companyId: partners.companyId })
        .from(partners)
        .where(eq(partners.id, partnerId))
        .limit(1);
      companyId = linkedPartner?.companyId ?? null;
    }

    const [activity] = await tx
      .insert(contactActivities)
      .values({
        type: "meeting",
        subject: title,
        occurredAt: new Date(`${meetingDate}T12:00:00`),
        source: "paste",
        content,
        summary: input.summary?.trim() || null,
        primaryCompanyId: companyId,
        primaryPartnerId: partnerId,
        primaryUserId: attendeeUserIds[0] ?? null,
        createdBy: attendeeUserIds[0] ?? null,
      })
      .returning();

    if (companyId) {
      await tx.insert(contactActivityCompanies).values({
        activityId: activity.id,
        companyId,
      }).onConflictDoNothing();
    }
    if (partnerId) {
      await tx.insert(contactActivityPartners).values({
        activityId: activity.id,
        partnerId,
      }).onConflictDoNothing();
    }
    if (input.eventId) {
      await tx.insert(contactActivityEvents).values({
        activityId: activity.id,
        eventId: input.eventId,
      }).onConflictDoNothing();
    }
    if (attendeeUserIds.length) {
      await tx
        .insert(contactActivityAttendees)
        .values(attendeeUserIds.map((userId) => ({ activityId: activity.id, userId })))
        .onConflictDoNothing();
    }

    if (input.createConversation) {
      if (!companyId) throw new Error("A company is required to create a pipeline conversation.");

      await tx.insert(sponsors).values({
        companyId,
        eventId: input.eventId || null,
        primaryContactId: partnerId,
        ownerUserId: input.conversationOwnerUserId || null,
        amount: input.conversationAmount ?? null,
        tier: input.conversationTier?.trim() || null,
        status: input.conversationStatus ?? "in_conversation",
        role: input.conversationRole?.trim() || null,
        followUpDate: input.conversationFollowUpDate || null,
        notes: input.summary?.trim() || content.slice(0, 600),
      });
    }

    return activity;
  });
}

export async function updateMeetingLog(input: UpdateMeetingLogInput) {
  const title = input.title.trim();
  const content = input.content.trim();
  const meetingDate = input.meetingDate.trim();
  if (!input.id) throw new Error("Meeting is required.");
  if (!title) throw new Error("Meeting title is required.");
  if (!content) throw new Error("Contact notes are required.");
  if (!meetingDate) throw new Error("Meeting date is required.");

  return db.transaction(async (tx) => {
    const attendeeUserIds = Array.from(new Set(input.attendeeUserIds?.filter(Boolean) ?? []));
    let companyId = input.companyId || null;
    if (!companyId && input.companyName?.trim()) {
      const [existingCompany] = await tx
        .select()
        .from(companies)
        .where(eq(companies.name, input.companyName.trim()))
        .limit(1);
      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        const [company] = await tx
          .insert(companies)
          .values({ name: input.companyName.trim() })
          .returning();
        companyId = company.id;
      }
    }

    let partnerId = input.partnerId || null;
    if (!partnerId && input.partnerFirstName?.trim()) {
      if (!companyId) throw new Error("A company is required to create a new partner.");
      if (!input.partnerEmail?.trim() && !input.partnerLinkedin?.trim()) {
        throw new Error("A new partner needs either an email or LinkedIn.");
      }
      const [partner] = await tx
        .insert(partners)
        .values({
          companyId,
          firstName: input.partnerFirstName.trim(),
          lastName: input.partnerLastName?.trim() || null,
          email: input.partnerEmail?.trim() || null,
          linkedin: input.partnerLinkedin?.trim() || null,
        })
        .returning();
      partnerId = partner.id;
      await syncPartnerDirectors(tx, partner.id, attendeeUserIds);
    }
    if (partnerId && !companyId) {
      const [linkedPartner] = await tx
        .select({ companyId: partners.companyId })
        .from(partners)
        .where(eq(partners.id, partnerId))
        .limit(1);
      companyId = linkedPartner?.companyId ?? null;
    }

    const [activity] = await tx
      .update(contactActivities)
      .set({
        type: "meeting",
        subject: title,
        occurredAt: new Date(`${meetingDate}T12:00:00`),
        content,
        summary: input.summary?.trim() || null,
        primaryCompanyId: companyId,
        primaryPartnerId: partnerId,
        primaryUserId: attendeeUserIds[0] ?? null,
        createdBy: attendeeUserIds[0] ?? null,
        source: "manual",
        updatedAt: new Date(),
      })
      .where(eq(contactActivities.id, input.id))
      .returning();

    if (!activity) throw new Error("Meeting was not found.");

    await tx.delete(contactActivityCompanies).where(eq(contactActivityCompanies.activityId, input.id));
    await tx.delete(contactActivityPartners).where(eq(contactActivityPartners.activityId, input.id));
    await tx.delete(contactActivityEvents).where(eq(contactActivityEvents.activityId, input.id));
    await tx.delete(contactActivityAttendees).where(eq(contactActivityAttendees.activityId, input.id));

    if (companyId) {
      await tx
        .insert(contactActivityCompanies)
        .values({
          activityId: activity.id,
          companyId,
        })
        .onConflictDoNothing();
    }
    if (partnerId) {
      await tx
        .insert(contactActivityPartners)
        .values({
          activityId: activity.id,
          partnerId,
        })
        .onConflictDoNothing();
    }
    if (input.eventId) {
      await tx
        .insert(contactActivityEvents)
        .values({
          activityId: activity.id,
          eventId: input.eventId,
        })
        .onConflictDoNothing();
    }
    if (attendeeUserIds.length) {
      await tx
        .insert(contactActivityAttendees)
        .values(attendeeUserIds.map((userId) => ({ activityId: activity.id, userId })))
        .onConflictDoNothing();
    }

    return activity;
  });
}

export async function createSponsorship(input: CreateSponsorshipInput) {
  const companyId =
    input.companyId ||
    (input.companyName ? (await findOrCreateCompanyByName(input.companyName)).id : null);

  if (!companyId) throw new Error("Company is required.");

  const [sponsorship] = await db
    .insert(sponsors)
    .values({
      companyId,
      eventId: input.eventId || null,
      primaryContactId: input.primaryContactId || null,
      ownerUserId: input.ownerUserId || null,
      amount: input.amount ?? null,
      tier: input.tier?.trim() || null,
      status: input.status ?? "prospecting",
      role: input.role?.trim() || null,
      followUpDate: input.followUpDate || null,
      notes: input.notes?.trim() || null,
    })
    .returning();

  return sponsorship;
}

export async function updateSponsorship(input: UpdateSponsorshipInput) {
  const companyId =
    input.companyId ||
    (input.companyName ? (await findOrCreateCompanyByName(input.companyName)).id : null);

  const updateValues: Partial<NewSponsor> = {
    primaryContactId: input.primaryContactId || null,
    ownerUserId: input.ownerUserId || null,
    amount: input.amount ?? null,
    tier: input.tier?.trim() || null,
    status: input.status,
    role: input.role?.trim() || null,
    followUpDate: input.followUpDate || null,
    notes: input.notes?.trim() || null,
    archived: input.archived ?? false,
    updatedAt: new Date(),
  };

  if (companyId) updateValues.companyId = companyId;
  if (input.eventId !== undefined) updateValues.eventId = input.eventId || null;

  const [sponsorship] = await db
    .update(sponsors)
    .set(updateValues)
    .where(eq(sponsors.id, input.id))
    .returning();

  return sponsorship;
}

export async function createPartnerDocument(input: CreatePartnerDocumentInput) {
  if (!input.companyId) throw new Error("Company is required.");
  const title = input.title.trim();
  const url = input.url.trim();
  if (!title) throw new Error("Document title is required.");
  if (!url) throw new Error("Document URL is required.");

  const [document] = await db
    .insert(partnerDocuments)
    .values({
      companyId: input.companyId,
      partnerId: input.partnerId || null,
      eventId: input.eventId || null,
      title,
      type: input.type?.trim() || "general",
      status: input.status?.trim() || "draft",
      url,
      fileName: input.fileName?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .returning();
  return document;
}

export async function deletePartnerDocument(documentId: string) {
  await db.delete(partnerDocuments).where(eq(partnerDocuments.id, documentId));
}

export async function createCompanyInteraction(input: CreateCompanyInteractionInput) {
  const companyId = input.companyId || (input.companyName ? (await findOrCreateCompanyByName(input.companyName)).id : null);
  if (!companyId) throw new Error("Company is required.");
  if (!input.userId) throw new Error("BizTech Director is required.");
  const contactedAt = input.contactedAt.trim();
  if (!contactedAt) throw new Error("Contact date is required.");

  const partnerIds: string[] = [];
  for (const entry of input.contacts ?? []) {
    if (entry.partnerId) {
      partnerIds.push(entry.partnerId);
      continue;
    }
    if (!entry.firstName?.trim()) continue;
    const contact = await createContact({
      companyId,
      firstName: entry.firstName,
      lastName: entry.lastName,
      role: entry.role,
      email: entry.email,
      linkedin: entry.linkedin,
    });
    partnerIds.push(contact.id);
  }

  const uniquePartnerIds = Array.from(new Set(partnerIds));
  const primaryPartnerId = uniquePartnerIds[0] ?? null;

  return db.transaction(async (tx) => {
    const primaryPartner = primaryPartnerId
      ? (await tx.select().from(partners).where(eq(partners.id, primaryPartnerId)).limit(1))[0]
      : null;
    const [activity] = await tx
      .insert(contactActivities)
      .values({
        type: input.type,
        direction: input.direction || null,
        subject: contactActivitySubject({
          subject: input.subject,
          type: input.type,
          partnerName: primaryPartner
            ? [primaryPartner.firstName, primaryPartner.lastName].filter(Boolean).join(" ")
            : null,
        }),
        notes: input.notes?.trim() || null,
        occurredAt: new Date(contactedAt),
        followUpDate: input.followUpDate || null,
        source: "manual",
        primaryCompanyId: companyId,
        primaryPartnerId,
        primaryUserId: input.userId,
        createdBy: input.userId,
      })
      .returning();

    await tx
      .insert(contactActivityCompanies)
      .values({ activityId: activity.id, companyId })
      .onConflictDoNothing();
    if (uniquePartnerIds.length > 0) {
      await tx
        .insert(contactActivityPartners)
        .values(uniquePartnerIds.map((partnerId) => ({ activityId: activity.id, partnerId })))
        .onConflictDoNothing();
    }
    const attendeeIds = Array.from(new Set([input.userId, ...(input.attendeeUserIds ?? [])].filter(Boolean)));
    if (attendeeIds.length > 0) {
      await tx
        .insert(contactActivityAttendees)
        .values(attendeeIds.map((userId) => ({ activityId: activity.id, userId })))
        .onConflictDoNothing();
    }

    return activity;
  });
}

export async function updateCompanyInteraction(input: UpdateCompanyInteractionInput) {
  if (!input.id) throw new Error("Contact record is required.");
  if (!input.companyId) throw new Error("Company is required.");
  if (!input.userId) throw new Error("BizTech Director is required.");
  const contactedAt = input.contactedAt.trim();
  if (!contactedAt) throw new Error("Contact date is required.");

  let partnerId = input.partnerId || null;
  if (input.newContact?.firstName?.trim()) {
    const created = await createContact({
      companyId: input.companyId,
      firstName: input.newContact.firstName,
      lastName: input.newContact.lastName,
      role: input.newContact.role,
      email: input.newContact.email,
      linkedin: input.newContact.linkedin,
    });
    partnerId = created.id;
  }

  return db.transaction(async (tx) => {
    const primaryPartner = partnerId
      ? (await tx.select().from(partners).where(eq(partners.id, partnerId)).limit(1))[0]
      : null;

    const [activity] = await tx
      .update(contactActivities)
      .set({
        type: input.type,
        direction: input.direction || null,
        subject: contactActivitySubject({
          subject: input.subject,
          type: input.type,
          partnerName: primaryPartner
            ? [primaryPartner.firstName, primaryPartner.lastName].filter(Boolean).join(" ")
            : null,
        }),
        notes: input.notes?.trim() || null,
        occurredAt: new Date(contactedAt),
        followUpDate: input.followUpDate || null,
        primaryCompanyId: input.companyId,
        primaryPartnerId: partnerId,
        primaryUserId: input.userId,
        updatedAt: new Date(),
      })
      .where(eq(contactActivities.id, input.id))
      .returning();

    if (!activity) throw new Error("Contact record was not found.");

    await tx.delete(contactActivityCompanies).where(eq(contactActivityCompanies.activityId, input.id));
    await tx.delete(contactActivityPartners).where(eq(contactActivityPartners.activityId, input.id));
    await tx.delete(contactActivityAttendees).where(eq(contactActivityAttendees.activityId, input.id));

    await tx
      .insert(contactActivityCompanies)
      .values({ activityId: input.id, companyId: input.companyId })
      .onConflictDoNothing();
    if (partnerId) {
      await tx
        .insert(contactActivityPartners)
        .values({ activityId: input.id, partnerId })
        .onConflictDoNothing();
    }
    await tx
      .insert(contactActivityAttendees)
      .values({ activityId: input.id, userId: input.userId })
      .onConflictDoNothing();

    return activity;
  });
}

export async function deleteCompanyInteraction(interactionId: string) {
  await db
    .delete(contactActivities)
    .where(or(eq(contactActivities.id, interactionId), eq(contactActivities.legacyInteractionId, interactionId)));
  await db.delete(interactions).where(eq(interactions.id, interactionId));
}

export async function deleteMeetingLog(meetingLogId: string) {
  await db
    .delete(contactActivities)
    .where(or(eq(contactActivities.id, meetingLogId), eq(contactActivities.legacyMeetingNoteId, meetingLogId)));
  await db.delete(meetingNotes).where(eq(meetingNotes.id, meetingLogId));
}

export async function listEmailTemplates(options?: { includeArchived?: boolean }): Promise<EmailTemplateRecord[]> {
  const rows = await db
    .select()
    .from(emailTemplates)
    .orderBy(desc(emailTemplates.updatedAt));
  return rows
    .filter((template) => options?.includeArchived || !template.archived)
    .map(emailTemplateRecord);
}

export async function createEmailTemplate(input: CreateEmailTemplateInput) {
  const name = input.name.trim();
  const subjectTemplate = input.subjectTemplate.trim();
  const bodyTemplate = input.bodyTemplate.trim();
  if (!name) throw new Error("Template name is required.");
  if (!subjectTemplate) throw new Error("Template subject is required.");
  if (!bodyTemplate) throw new Error("Template body is required.");

  const [template] = await db
    .insert(emailTemplates)
    .values({
      name,
      description: input.description?.trim() || null,
      subjectTemplate,
      bodyTemplate,
      createdBy: input.createdBy || null,
    })
    .returning();
  return emailTemplateRecord(template);
}

export async function updateEmailTemplate(input: UpdateEmailTemplateInput) {
  const name = input.name.trim();
  const subjectTemplate = input.subjectTemplate.trim();
  const bodyTemplate = input.bodyTemplate.trim();
  if (!name) throw new Error("Template name is required.");
  if (!subjectTemplate) throw new Error("Template subject is required.");
  if (!bodyTemplate) throw new Error("Template body is required.");

  const [template] = await db
    .update(emailTemplates)
    .set({
      name,
      description: input.description?.trim() || null,
      subjectTemplate,
      bodyTemplate,
      archived: input.archived ?? false,
      updatedAt: new Date(),
    })
    .where(eq(emailTemplates.id, input.id))
    .returning();
  return emailTemplateRecord(template);
}

export async function archiveEmailTemplate(templateId: string, archived = true) {
  const [template] = await db
    .update(emailTemplates)
    .set({ archived, updatedAt: new Date() })
    .where(eq(emailTemplates.id, templateId))
    .returning();
  return emailTemplateRecord(template);
}

export async function listEmailRecipients(): Promise<EmailRecipientRecord[]> {
  const [companyRows, contactRows, deals] = await Promise.all([
    db.select().from(companies).orderBy(asc(companies.name)),
    db.select().from(partners).orderBy(asc(partners.firstName), asc(partners.lastName)),
    listPipelineDeals({ includeArchived: true }),
  ]);

  const companyMap = new Map(companyRows.map((company) => [company.id, company]));
  return contactRows
    .filter((contact) => !contact.archived && Boolean(contact.email?.trim()))
    .filter((contact) => {
      const company = companyMap.get(contact.companyId);
      return Boolean(company && !company.archived);
    })
    .map((contact) => {
      const company = companyMap.get(contact.companyId);
      const companyDeals = deals.filter((deal) => deal.partnerId === contact.companyId);
      return {
        id: contact.id,
        companyId: contact.companyId,
        companyName: company?.name ?? "Unknown company",
        contactName: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
        email: contact.email ?? "",
        latestStatus: companyDeals[0]?.status ?? null,
      };
    });
}

export async function listEmailCampaigns(): Promise<EmailCampaignRecord[]> {
  const [campaignRows, sendRows, eventRows, userRows] = await Promise.all([
    db.select().from(emailCampaigns).orderBy(desc(emailCampaigns.createdAt)),
    db.select().from(emailSends).orderBy(desc(emailSends.createdAt)),
    db.select().from(events),
    db.select().from(users),
  ]);
  const eventMap = new Map(eventRows.map((event) => [event.id, event]));
  const userMap = new Map(userRows.map((user) => [user.id, user]));

  return campaignRows.map((campaign) => {
    const event = campaign.eventId ? eventMap.get(campaign.eventId) : null;
    const sender = campaign.senderUserId ? userMap.get(campaign.senderUserId) : null;
    return {
      id: campaign.id,
      templateId: campaign.templateId,
      eventId: campaign.eventId,
      eventName: event?.name ?? null,
      senderUserId: campaign.senderUserId,
      senderName: sender ? toUserSummary(sender).name : null,
      subject: campaign.subject,
      body: campaign.body,
      status: campaign.status as EmailCampaignRecord["status"],
      createdAtIso: campaign.createdAt.toISOString(),
      sentAtIso: campaign.sentAt?.toISOString() ?? null,
      sends: sendRows
        .filter((send) => send.campaignId === campaign.id)
        .map((send) => ({
          id: send.id,
          companyId: send.companyId,
          partnerId: send.partnerId,
          recipientEmail: send.recipientEmail,
          status: send.status as EmailCampaignRecord["sends"][number]["status"],
          error: send.error,
        })),
    };
  });
}

export async function getEmailSyncSummary(): Promise<EmailSyncSummary> {
  const rows = await db
    .select({
      companyId: contactActivities.primaryCompanyId,
      partnerId: contactActivities.primaryPartnerId,
      contactedAt: contactActivities.occurredAt,
    })
    .from(contactActivities)
    .where(inArray(contactActivities.source, ["gmail", "gmail_sync"]))
    .orderBy(desc(contactActivities.occurredAt));

  return {
    lastSyncedAtIso: rows[0]?.contactedAt.toISOString() ?? null,
    syncedMessageCount: rows.length,
    linkedCompanyCount: new Set(rows.map((row) => row.companyId).filter(Boolean)).size,
    linkedPartnerCount: new Set(rows.map((row) => row.partnerId).filter(Boolean)).size,
  };
}

export async function createEmailCampaignDraft(input: CreateEmailCampaignDraftInput) {
  const subject = input.subject.trim();
  const body = input.body.trim();
  const recipientIds = Array.from(new Set(input.recipientIds.filter(Boolean)));
  if (!subject) throw new Error("Email subject is required.");
  if (!body) throw new Error("Email body is required.");
  if (!recipientIds.length) throw new Error("Select at least one recipient.");

  const recipientRows = await db
    .select({ contact: partners, company: companies })
    .from(partners)
    .innerJoin(companies, eq(partners.companyId, companies.id))
    .where(inArray(partners.id, recipientIds));
  const eligibleRecipients = recipientRows.filter((row) => row.contact.email?.trim());
  if (!eligibleRecipients.length) throw new Error("Selected recipients do not have email addresses.");

  return db.transaction(async (tx) => {
    const [campaign] = await tx
      .insert(emailCampaigns)
      .values({
        templateId: input.templateId || null,
        eventId: input.eventId || null,
        senderUserId: input.senderUserId || null,
        subject,
        body,
        status: "draft",
      })
      .returning();

    await tx.insert(emailSends).values(
      eligibleRecipients.map(({ contact, company }) => ({
        campaignId: campaign.id,
        companyId: company.id,
        partnerId: contact.id,
        recipientEmail: contact.email ?? "",
        status: "queued" as const,
      })),
    );

    if (input.templateId) {
      await tx
        .update(emailTemplates)
        .set({ lastUsedAt: new Date(), updatedAt: new Date() })
        .where(eq(emailTemplates.id, input.templateId));
    }

    return campaign;
  });
}

export async function updateEmailCampaignStatus(
  campaignId: string,
  status: EmailCampaignRecord["status"],
) {
  const [campaign] = await db
    .update(emailCampaigns)
    .set({
      status,
      sentAt: status === "sent" ? new Date() : null,
    })
    .where(eq(emailCampaigns.id, campaignId))
    .returning();
  return campaign;
}

export async function updateEmailSendResult(input: {
  sendId: string;
  status: EmailCampaignRecord["sends"][number]["status"];
  error?: string | null;
  externalMessageId?: string | null;
}) {
  const [send] = await db
    .update(emailSends)
    .set({
      status: input.status,
      error: input.error ?? null,
      externalMessageId: input.externalMessageId ?? null,
      sentAt: input.status === "sent" ? new Date() : null,
    })
    .where(eq(emailSends.id, input.sendId))
    .returning();
  return send;
}

export async function logEmailInteraction(input: {
  companyId: string;
  partnerId?: string | null;
  userId: string;
  subject: string;
  notes?: string;
  externalMessageId?: string | null;
}) {
  return db.transaction(async (tx) => {
    const [activity] = await tx
      .insert(contactActivities)
      .values({
        type: "email",
        direction: "outbound",
        subject: input.subject.trim() || "Email",
        notes: input.notes?.trim() || null,
        occurredAt: new Date(),
        source: "mail_merge",
        externalMessageId: input.externalMessageId ?? null,
        primaryCompanyId: input.companyId,
        primaryPartnerId: input.partnerId || null,
        primaryUserId: input.userId,
        createdBy: input.userId,
      })
      .returning();

    await tx
      .insert(contactActivityCompanies)
      .values({ activityId: activity.id, companyId: input.companyId })
      .onConflictDoNothing();
    if (input.partnerId) {
      await tx
        .insert(contactActivityPartners)
        .values({ activityId: activity.id, partnerId: input.partnerId })
        .onConflictDoNothing();
    }
    await tx
      .insert(contactActivityAttendees)
      .values({ activityId: activity.id, userId: input.userId })
      .onConflictDoNothing();

    return activity;
  });
}

export async function buildMergeValues(input: {
  recipient: EmailRecipientRecord;
  sender?: CrmUserSummary | null;
  event?: CrmEventSummary | null;
}) {
  const recipientName = splitName(input.recipient.contactName || input.recipient.email);
  const senderName = splitName(input.sender?.name ?? "");
  return {
    company_name: input.recipient.companyName,
    contact_name: input.recipient.contactName,
    recipient_first_name: recipientName.firstName,
    recipient_last_name: recipientName.lastName,
    recipient_full_name: recipientName.fullName,
    recipient_email: input.recipient.email,
    sender_first_name: senderName.firstName,
    sender_last_name: senderName.lastName,
    sender_full_name: senderName.fullName,
    sender_email: input.sender?.email ?? "",
    event_name: input.event?.name ?? "",
    event_year: input.event?.year ? String(input.event.year) : "",
  };
}
