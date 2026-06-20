import { randomUUID } from "node:crypto";
import { cache } from "react";
import { and, asc, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
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
  usersYears,
  years,
  type NewSponsor,
} from "@/lib/db/schema";
import type {
  AddCompanyEventRoleInput,
  AddPartnerEventRoleInput,
  CompanyDirectoryRecord,
  CompanyInteractionRecord,
  CompanyKind,
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
  CrmYear,
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
  PaginatedResult,
  PaginationOptions,
  PartnerAccount,
  PartnerContact,
  PartnerDirectoryRecord,
  PipelineDeal,
  TouchpointRecord,
  TouchpointSubject,
  UpdateCompanyInput,
  UpdateCompanyInteractionInput,
  UpdateContactInput,
  UpdateDirectorInput,
  UpdateEmailTemplateInput,
  UpdateEventInput,
  UpdateMeetingLogInput,
  UpdateSponsorshipInput,
} from "./types";
import { isTouchpointSubject } from "./types";

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

function toUserSummary(
  row: typeof users.$inferSelect,
  yearIds: string[] = [],
): CrmUserSummary {
  const name = `${row.first_name} ${row.last_name}`.trim();
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    name,
    email: row.email,
    role: row.role,
    team: row.team,
    yearIds,
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

function validateTouchpointSubject(value: unknown): TouchpointSubject {
  if (isTouchpointSubject(value)) return value;
  throw new Error("Subject must be one of the standard outreach stages.");
}

function coerceTouchpointSubject(value: string | null): TouchpointSubject {
  return isTouchpointSubject(value) ? value : "initial_interest";
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

export async function listYears(): Promise<CrmYear[]> {
  const rows = await db.select().from(years).orderBy(asc(years.label));
  return rows.map((row) => ({ id: row.id, label: row.label }));
}

async function loadYearIdsByUser(): Promise<Map<string, string[]>> {
  const rows = await db
    .select({ userId: usersYears.userId, yearId: usersYears.yearId, label: years.label })
    .from(usersYears)
    .innerJoin(years, eq(usersYears.yearId, years.id))
    .orderBy(asc(years.label));
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.userId);
    if (list) list.push(row.yearId);
    else map.set(row.userId, [row.yearId]);
  }
  return map;
}

export async function listUsers(): Promise<CrmUserSummary[]> {
  const [rows, yearIdsByUser] = await Promise.all([
    db.select().from(users).orderBy(asc(users.first_name), asc(users.last_name)),
    loadYearIdsByUser(),
  ]);
  return rows.map((row) => toUserSummary(row, yearIdsByUser.get(row.id) ?? []));
}

async function syncDirectorYears(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  yearIds: string[] | undefined,
) {
  if (!yearIds) return;
  const uniqueYearIds = Array.from(new Set(yearIds.filter(Boolean)));
  await tx.delete(usersYears).where(eq(usersYears.userId, userId));
  if (uniqueYearIds.length) {
    await tx
      .insert(usersYears)
      .values(uniqueYearIds.map((yearId) => ({ userId, yearId })))
      .onConflictDoNothing();
  }
}

export async function createDirector(input: CreateDirectorInput) {
  const id = randomUUID();
  const director = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(users)
      .values({
        id,
        ...normalizeDirectorInput(input),
      })
      .returning();
    await syncDirectorYears(tx, row.id, input.yearIds);
    return row;
  });
  return toUserSummary(director, Array.from(new Set((input.yearIds ?? []).filter(Boolean))));
}

export async function updateDirector(input: UpdateDirectorInput) {
  const director = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(users)
      .set(normalizeDirectorInput(input))
      .where(eq(users.id, input.id))
      .returning();
    if (!row) throw new Error("BizTech Director was not found.");
    await syncDirectorYears(tx, row.id, input.yearIds);
    return row;
  });
  const yearIds = input.yearIds
    ? Array.from(new Set(input.yearIds.filter(Boolean)))
    : (await loadYearIdsByUser()).get(director.id) ?? [];
  return toUserSummary(director, yearIds);
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

function groupBy<T, K>(rows: readonly T[], key: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = map.get(k);
    if (bucket) bucket.push(row);
    else map.set(k, [row]);
  }
  return map;
}

// Base-query loaders wrapped in React cache() so that the multiple cached
// repository functions invoked on a single board page (e.g. /pipeline) share
// one execution of each heavy query per request instead of re-scanning.
const loadDealRows = cache((includeArchived = false) =>
  db
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
    .where(includeArchived ? undefined : eq(sponsors.archived, false))
    .orderBy(desc(sponsors.updatedAt)),
);

const loadCompaniesRaw = cache((includeArchived = false) =>
  db
    .select()
    .from(companies)
    .where(includeArchived ? undefined : eq(companies.archived, false))
    .orderBy(asc(companies.name)),
);

const loadPartnersRaw = cache((includeArchived = false) =>
  db
    .select()
    .from(partners)
    .where(includeArchived ? undefined : eq(partners.archived, false))
    .orderBy(desc(partners.isPrimary), asc(partners.firstName)),
);

const loadSponsorsRaw = cache(() =>
  db.select().from(sponsors).where(eq(sponsors.archived, false)),
);

const loadEventRows = cache((includeArchived = false) =>
  db
    .select()
    .from(events)
    .where(includeArchived ? undefined : eq(events.archived, false))
    .orderBy(desc(events.startDate)),
);

export async function listPartnerAccounts(options?: {
  includeArchived?: boolean;
  search?: string;
}): Promise<PartnerAccount[]> {
  const includeArchived = options?.includeArchived ?? false;
  const [allCompanies, allContacts, allSponsorships] = await Promise.all([
    loadCompaniesRaw(includeArchived),
    loadPartnersRaw(includeArchived),
    loadSponsorsRaw(),
  ]);
  const search = options?.search?.trim().toLowerCase();

  const contactsByCompany = groupBy(allContacts, (contact) => contact.companyId);
  const sponsorshipsByCompany = groupBy(allSponsorships, (sponsor) => sponsor.companyId);

  return allCompanies
    .map((company) => {
      const contacts = (contactsByCompany.get(company.id) ?? []).map(toContact);
      const companySponsorships = sponsorshipsByCompany.get(company.id) ?? [];
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
  const includeArchived = options?.includeArchived ?? false;
  const [eventRows, sponsorRows, partnerRoleRows, sponsorContactRows, directorRows] = await Promise.all([
    loadEventRows(includeArchived),
    loadSponsorsRaw(),
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

  const sponsorsByEvent = groupBy(sponsorRows, (sponsor) => sponsor.eventId);
  const partnerRolesByEvent = groupBy(partnerRoleRows, (role) => role.eventId);
  const sponsorContactsByEvent = groupBy(sponsorContactRows, (row) => row.eventId);
  const directorsByEvent = groupBy(directorRows, (row) => row.eventId);

  return eventRows
    .map((event) => {
      const eventSponsors = sponsorsByEvent.get(event.id) ?? [];
      const eventPartnerRoles = (partnerRolesByEvent.get(event.id) ?? []).filter(
        (role) => includeArchived || (!role.partnerArchived && !role.companyArchived),
      );
      const eventSponsorContacts = (sponsorContactsByEvent.get(event.id) ?? []).filter(
        (row) => includeArchived || (!row.sponsorArchived && !row.partnerArchived && !row.companyArchived),
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
      const eventDirectors = (directorsByEvent.get(event.id) ?? []).map((row) =>
        toUserSummary(row.user),
      );

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
  const rows = await loadDealRows(options?.includeArchived ?? false);

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
      subject: coerceTouchpointSubject(activity.subject),
      notes: activity.notes,
      contactedAtIso: activity.occurredAt.toISOString(),
      followUpDate: activity.followUpDate,
      source: activity.source,
      createdAtIso: activity.createdAt.toISOString(),
      externalThreadId: activity.externalThreadId,
      createdBy: activity.createdBy,
    }));
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

  const dealsByCompany = groupBy(deals, (deal) => deal.partnerId);
  const attendanceByCompany = groupBy(attendanceRows, (row) => row.companyId);
  const documentsByCompany = groupBy(documentRows, (row) => row.document.companyId);
  const communicationsByCompany = groupBy(communicationRows, (row) => row.activity.primaryCompanyId);

  return accounts.map((account) => {
    const { updatedAt, ...clientAccount } = account;
    const activeDeals = (dealsByCompany.get(account.id) ?? []).map((deal) => ({
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
      eventAttendances: (attendanceByCompany.get(account.id) ?? [])
        .filter((row) => !row.eventArchived)
        .map((row) => ({
          eventId: row.eventId,
          eventName: row.eventName,
          eventRole: row.eventRole as CompanyDirectoryRecord["eventAttendances"][number]["eventRole"],
          eventStatus: row.eventStatus as CompanyDirectoryRecord["eventAttendances"][number]["eventStatus"],
        })),
      documents: (documentsByCompany.get(account.id) ?? [])
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
      communications: (communicationsByCompany.get(account.id) ?? [])
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
    loadCompaniesRaw(),
    loadPartnersRaw(),
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
  const dealsByCompany = groupBy(dealRows, (deal) => deal.partnerId);
  const attendanceByPartner = groupBy(attendanceRows, (row) => row.partnerId);
  const directorsByPartner = groupBy(directorRows, (row) => row.partnerId);

  return contactRows
    .filter((contact) => companyMap.has(contact.companyId))
    .map((contact) => {
    const company = companyMap.get(contact.companyId);
    const companyDeals = dealsByCompany.get(contact.companyId) ?? [];
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
      eventAttendances: (attendanceByPartner.get(contact.id) ?? [])
        .filter((row) => !row.eventArchived)
        .map((row) => ({
          eventId: row.eventId,
          eventName: row.eventName,
          eventRole: row.eventRole as PartnerDirectoryRecord["eventAttendances"][number]["eventRole"],
          eventStatus: row.eventStatus as PartnerDirectoryRecord["eventAttendances"][number]["eventStatus"],
        })),
      directors: (directorsByPartner.get(contact.id) ?? []).map((row) =>
        toUserSummary(row.user),
      ),
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
    const [activity] = await tx
      .insert(contactActivities)
      .values({
        type: input.type,
        direction: input.direction || null,
        subject: validateTouchpointSubject(input.subject),
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
    const [activity] = await tx
      .update(contactActivities)
      .set({
        type: input.type,
        direction: input.direction || null,
        subject: validateTouchpointSubject(input.subject),
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






const IN_KIND_TAG = "in-kind";
const PREVIOUS_TAG = "previous-sponsor";

export async function listCompanyDirectoryPage(
  opts: PaginationOptions & { kind?: CompanyKind } = {},
): Promise<PaginatedResult<CompanyDirectoryRecord> & { kindCounts: { sponsors: number; inKind: number; previous: number } }> {
  const { page = 1, pageSize = 25, search = "", kind } = opts;
  const offset = (page - 1) * pageSize;

  const kindFilter =
    kind === "in_kind"
      ? sql`${companies.tags} @> ARRAY[${IN_KIND_TAG}]::text[]`
      : kind === "previous"
        ? sql`${companies.tags} @> ARRAY[${PREVIOUS_TAG}]::text[]`
        : kind === "sponsors"
          ? and(
              sql`NOT (${companies.tags} @> ARRAY[${IN_KIND_TAG}]::text[])`,
              sql`NOT (${companies.tags} @> ARRAY[${PREVIOUS_TAG}]::text[])`,
            )
          : undefined;

  const baseWhere = and(eq(companies.archived, false), search ? ilike(companies.name, `%${search}%`) : undefined);
  const pageWhere = and(baseWhere, kindFilter);

  const [kindCountsResult, countResult, paginatedRows] = await Promise.all([
    db
      .select({
        sponsors: sql<number>`COUNT(CASE WHEN NOT (${companies.tags} @> ARRAY[${IN_KIND_TAG}]::text[]) AND NOT (${companies.tags} @> ARRAY[${PREVIOUS_TAG}]::text[]) THEN 1 END)::int`,
        inKind: sql<number>`COUNT(CASE WHEN ${companies.tags} @> ARRAY[${IN_KIND_TAG}]::text[] THEN 1 END)::int`,
        previous: sql<number>`COUNT(CASE WHEN ${companies.tags} @> ARRAY[${PREVIOUS_TAG}]::text[] THEN 1 END)::int`,
      })
      .from(companies)
      .where(baseWhere),
    db.select({ count: sql<number>`count(*)::int` }).from(companies).where(pageWhere),
    db.select().from(companies).where(pageWhere).orderBy(asc(companies.name)).limit(pageSize).offset(offset),
  ]);

  const total = countResult[0]?.count ?? 0;
  const companyIds = paginatedRows.map((r) => r.id);
  const kindCounts = {
    sponsors: kindCountsResult[0]?.sponsors ?? 0,
    inKind: kindCountsResult[0]?.inKind ?? 0,
    previous: kindCountsResult[0]?.previous ?? 0,
  };

  if (companyIds.length === 0) {
    return { data: [], total, page, pageSize, totalPages: Math.ceil(total / pageSize), kindCounts };
  }

  const [allContacts, allSponsorships, attendanceRows, documentRows, communicationRows, dealRows] = await Promise.all([
    db.select().from(partners).where(inArray(partners.companyId, companyIds)).orderBy(desc(partners.isPrimary), asc(partners.firstName)),
    db.select().from(sponsors).where(and(inArray(sponsors.companyId, companyIds), eq(sponsors.archived, false))),
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
      .where(inArray(companyEvents.companyId, companyIds))
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
      .where(inArray(partnerDocuments.companyId, companyIds))
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
      .where(inArray(contactActivities.primaryCompanyId, companyIds))
      .orderBy(desc(contactActivities.occurredAt)),
    db
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
      .where(and(inArray(sponsors.companyId, companyIds), eq(sponsors.archived, false)))
      .orderBy(desc(sponsors.updatedAt)),
  ]);

  const data = paginatedRows.map((company) => {
    const contacts = allContacts.filter((c) => c.companyId === company.id).map(toContact);
    const companySponsorships = allSponsorships.filter((s) => s.companyId === company.id);
    const primaryContact =
      contacts.find((c) => c.isPrimary && !c.archived) ?? contacts.find((c) => !c.archived) ?? null;
    const latest = [...companySponsorships].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    const openRows = companySponsorships.filter((row) => openStatuses.has(row.status as CrmStatus));
    const securedRows = companySponsorships.filter((row) => securedStatuses.has(row.status as CrmStatus));

    const activeDeals = dealRows
      .filter(({ company: c, event: e }) => c.id === company.id && !e?.archived)
      .map(({ sponsor: s, event: e, contact: c, owner: o }) => ({
        id: s.id,
        eventName: e?.name ?? null,
        status: s.status as CrmStatus,
        amount: s.amount,
        followUpDate: s.followUpDate,
        primaryContactName: c ? [c.firstName, c.lastName].filter(Boolean).join(" ") : null,
      }));

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
        companySponsorships.map((r) => r.followUpDate).filter((v): v is string => Boolean(v)).sort()[0] ?? null,
      activeContactsCount: contacts.filter((c) => !c.archived).length,
      activeDeals,
      eventAttendances: attendanceRows
        .filter((row) => row.companyId === company.id && !row.eventArchived)
        .map((row) => ({
          eventId: row.eventId,
          eventName: row.eventName,
          eventRole: row.eventRole as CompanyDirectoryRecord["eventAttendances"][number]["eventRole"],
          eventStatus: row.eventStatus as CompanyDirectoryRecord["eventAttendances"][number]["eventStatus"],
        })),
      documents: documentRows
        .filter((row) => row.document.companyId === company.id)
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
        .filter((row) => row.activity.primaryCompanyId === company.id)
        .map((row) => ({
          id: row.activity.id,
          companyId: row.activity.primaryCompanyId ?? company.id,
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
      updatedAtIso: company.updatedAt.toISOString(),
    } satisfies CompanyDirectoryRecord;
  });

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize), kindCounts };
}

export async function listPartnerDirectoryPage(
  opts: PaginationOptions = {},
): Promise<PaginatedResult<PartnerDirectoryRecord>> {
  const { page = 1, pageSize = 25, search = "" } = opts;
  const offset = (page - 1) * pageSize;

  const searchFilter = search
    ? or(
        ilike(partners.firstName, `%${search}%`),
        ilike(partners.lastName, `%${search}%`),
        ilike(partners.email, `%${search}%`),
        ilike(companies.name, `%${search}%`),
      )
    : undefined;

  const baseFilter = and(eq(partners.archived, false), eq(companies.archived, false), searchFilter);

  const [countResult, paginatedContactRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(partners).innerJoin(companies, eq(partners.companyId, companies.id)).where(baseFilter),
    db
      .select({ partner: partners, company: companies })
      .from(partners)
      .innerJoin(companies, eq(partners.companyId, companies.id))
      .where(baseFilter)
      .orderBy(asc(partners.firstName), asc(partners.lastName))
      .limit(pageSize)
      .offset(offset),
  ]);

  const total = countResult[0]?.count ?? 0;
  const contactIds = paginatedContactRows.map((r) => r.partner.id);
  const companyIds = [...new Set(paginatedContactRows.map((r) => r.partner.companyId))];

  if (contactIds.length === 0) {
    return { data: [], total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  const [dealRows, attendanceRows, directorRows] = await Promise.all([
    db
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
      .where(and(inArray(sponsors.companyId, companyIds), eq(sponsors.archived, false)))
      .orderBy(desc(sponsors.updatedAt)),
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
      .where(inArray(partnersEvents.partnerId, contactIds))
      .orderBy(desc(events.startDate), asc(partnersEvents.eventRole)),
    db
      .select({ partnerId: usersPartners.partnerId, user: users })
      .from(usersPartners)
      .innerJoin(users, eq(usersPartners.userId, users.id))
      .where(inArray(usersPartners.partnerId, contactIds))
      .orderBy(asc(users.first_name), asc(users.last_name)),
  ]);

  const data = paginatedContactRows.map(({ partner: contact, company }) => {
    const companyDeals = dealRows
      .filter(({ company: c, event: e }) => c.id === contact.companyId && !e?.archived)
      .map(({ sponsor: s, event: e, contact: c, owner: o }) => ({
        id: s.id,
        partnerId: s.companyId,
        partnerName: company.name,
        eventId: s.eventId ?? null,
        eventName: e?.name ?? null,
        primaryContactId: s.primaryContactId,
        primaryContactName: c ? [c.firstName, c.lastName].filter(Boolean).join(" ") : null,
        ownerUserId: s.ownerUserId,
        ownerName: o ? toUserSummary(o).name : null,
        amount: s.amount,
        tier: s.tier,
        status: s.status as CrmStatus,
        role: s.role,
        followUpDate: s.followUpDate,
        notes: s.notes,
        updatedAt: s.updatedAt,
      }));
    const latest = companyDeals[0];
    const nextFollowUpDate =
      companyDeals
        .map((d) => d.followUpDate)
        .filter((v): v is string => Boolean(v))
        .sort()[0] ?? null;

    return {
      ...toContact(contact),
      companyId: contact.companyId,
      companyName: company.name,
      companyTier: company.tier ?? null,
      companyArchived: company.archived,
      latestStatus: latest?.status ?? null,
      nextFollowUpDate,
      eventAttendances: attendanceRows
        .filter((row) => row.partnerId === contact.id && !row.eventArchived)
        .map((row) => ({
          eventId: row.eventId,
          eventName: row.eventName,
          eventRole: row.eventRole as PartnerDirectoryRecord["eventAttendances"][number]["eventRole"],
          eventStatus: row.eventStatus as PartnerDirectoryRecord["eventAttendances"][number]["eventStatus"],
        })),
      directors: directorRows.filter((row) => row.partnerId === contact.id).map((row) => toUserSummary(row.user)),
      updatedAtIso: contact.updatedAt.toISOString(),
    } satisfies PartnerDirectoryRecord;
  });

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}






/**
 * Flip a campaign into the worker queue. Idempotent for callers that hit
 * "Send" twice — re-queuing a queued/sending campaign is a no-op except for
 * refreshing queued_at and (optionally) the schedule.
 */





export async function getCompanyLastContact(companyId: string): Promise<{
  occurredAt: Date;
  createdByName: string | null;
} | null> {
  const [row] = await db
    .select({ occurredAt: contactActivities.occurredAt, firstName: users.first_name, lastName: users.last_name })
    .from(contactActivities)
    .leftJoin(users, eq(contactActivities.createdBy, users.id))
    .where(eq(contactActivities.primaryCompanyId, companyId))
    .orderBy(desc(contactActivities.occurredAt))
    .limit(1);
  if (!row) return null;
  const createdByName = [row.firstName, row.lastName].filter(Boolean).join(" ") || null;
  return { occurredAt: row.occurredAt, createdByName };
}

export async function getCompanyByName(name: string): Promise<{
  id: string;
  name: string;
  lastActivity: { occurredAt: Date; createdByName: string | null } | null;
} | null> {
  const [company] = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(and(ilike(companies.name, name), eq(companies.archived, false)))
    .limit(1);
  if (!company) return null;

  const lastActivity = await getCompanyLastContact(company.id);
  return { ...company, lastActivity };
}

export async function getPartnerByEmail(email: string): Promise<{
  id: string;
  firstName: string;
  lastName: string | null;
  companyId: string;
  companyName: string;
  lastActivity: { occurredAt: Date; createdByName: string | null } | null;
} | null> {
  const [partner] = await db
    .select({
      id: partners.id,
      firstName: partners.firstName,
      lastName: partners.lastName,
      companyId: companies.id,
      companyName: companies.name,
    })
    .from(partners)
    .innerJoin(companies, eq(partners.companyId, companies.id))
    .where(and(eq(partners.email, email), eq(partners.archived, false)))
    .limit(1);
  if (!partner) return null;

  const [activity] = await db
    .select({ occurredAt: contactActivities.occurredAt, firstName: users.first_name, lastName: users.last_name })
    .from(contactActivities)
    .leftJoin(users, eq(contactActivities.createdBy, users.id))
    .where(eq(contactActivities.primaryPartnerId, partner.id))
    .orderBy(desc(contactActivities.occurredAt))
    .limit(1);

  const createdByName = activity
    ? [activity.firstName, activity.lastName].filter(Boolean).join(" ") || null
    : null;

  return {
    ...partner,
    lastActivity: activity ? { occurredAt: activity.occurredAt, createdByName } : null,
  };
}
