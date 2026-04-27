import { and, asc, desc, eq, isNull, lte, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  companies,
  emailTemplates,
  events,
  interactions,
  partnerDocuments,
  partners,
  sponsors,
  users,
} from "@/lib/db/schema";
import type {
  CreateEventInput,
  CreatePartnerInput,
  CreateSponsorshipInput,
  CrmDashboard,
  CrmEventSummary,
  CrmStatus,
  PartnerAccount,
  PartnerContact,
  PipelineDeal,
} from "./types";

const securedStatuses = new Set<CrmStatus>(["confirmed", "paid"]);
const openStatuses = new Set<CrmStatus>([
  "prospecting",
  "pitched",
  "reached_out",
  "shortlist",
  "in_conversation",
  "followed_up",
]);

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
    isPrimary: row.isPrimary,
    archived: row.archived,
  };
}

function toDateString(value: string | Date | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function sumAmounts(rows: Array<{ amount: number | null }>) {
  return rows.reduce((total, row) => total + (row.amount ?? 0), 0);
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

export async function listEvents(): Promise<CrmEventSummary[]> {
  const eventRows = await db.select().from(events).orderBy(desc(events.startDate));
  const sponsorRows = await db.select().from(sponsors);

  return eventRows.map((event) => {
    const eventSponsors = sponsorRows.filter(
      (sponsor) => sponsor.eventId === event.id && !sponsor.archived,
    );
    return {
      id: event.id,
      name: event.name,
      year: event.year,
      startDate: event.startDate,
      endDate: event.endDate,
      sponsorshipGoal: event.sponsorshipGoal,
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
    .innerJoin(events, eq(sponsors.eventId, events.id))
    .leftJoin(partners, eq(sponsors.primaryContactId, partners.id))
    .leftJoin(users, eq(sponsors.ownerUserId, users.id))
    .where(options?.includeArchived ? undefined : eq(sponsors.archived, false))
    .orderBy(desc(sponsors.updatedAt));

  return rows.map(({ sponsor, company, event, contact, owner }) => ({
    id: sponsor.id,
    partnerId: company.id,
    partnerName: company.name,
    eventId: event.id,
    eventName: event.name,
    primaryContactName: contact
      ? [contact.firstName, contact.lastName].filter(Boolean).join(" ")
      : null,
    ownerName: owner ? `${owner.first_name} ${owner.last_name}` : null,
    amount: sponsor.amount,
    tier: sponsor.tier,
    status: sponsor.status as CrmStatus,
    role: sponsor.role,
    followUpDate: sponsor.followUpDate,
    notes: sponsor.notes,
    updatedAt: sponsor.updatedAt,
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

export async function archivePartnerAccount(companyId: string, archived = true) {
  const [company] = await db
    .update(companies)
    .set({ archived, updatedAt: new Date() })
    .where(eq(companies.id, companyId))
    .returning();
  return company;
}

export async function createCrmEvent(input: CreateEventInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Event name is required.");

  const [event] = await db
    .insert(events)
    .values({
      name,
      year: input.year ?? null,
      startDate: input.startDate,
      endDate: input.endDate || null,
      outreachStartDate: input.outreachStartDate || null,
      sponsorshipGoal: input.sponsorshipGoal ?? null,
      tierConfigs: input.tierConfigs ?? [],
      notes: input.notes?.trim() || null,
    })
    .returning();

  return event;
}

export async function createSponsorship(input: CreateSponsorshipInput) {
  const [sponsorship] = await db
    .insert(sponsors)
    .values({
      companyId: input.companyId,
      eventId: input.eventId,
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

export async function listPartnerDocuments(companyId: string) {
  return db
    .select()
    .from(partnerDocuments)
    .where(eq(partnerDocuments.companyId, companyId))
    .orderBy(desc(partnerDocuments.updatedAt));
}

export async function listPartnerCommunications(companyId: string) {
  return db
    .select()
    .from(interactions)
    .where(eq(interactions.companyId, companyId))
    .orderBy(desc(interactions.contactedAt));
}

export async function listEmailTemplates() {
  return db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.archived, false))
    .orderBy(desc(emailTemplates.updatedAt));
}
