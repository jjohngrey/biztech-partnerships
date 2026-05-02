import { db } from "@/lib/db";
import {
  meetingNotes,
  meetingNotePartners,
  meetingNoteAttendees,
  meetingNoteEvents,
  partners,
  companies,
  users,
  events,
} from "@/lib/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";

export interface MeetingNoteFilters {
  companyId?: string;
  partnerId?: string;
  biztechAttendeeId?: string;
  eventId?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: "date" | "company";
}

// ---------------------------------------------------------------------------
// List query
// ---------------------------------------------------------------------------
export async function getMeetingNotes(filters: MeetingNoteFilters = {}) {
  const {
    companyId,
    partnerId,
    biztechAttendeeId,
    eventId,
    dateFrom,
    dateTo,
    sort = "date",
  } = filters;

  // We need to build a query that returns one row per meeting note with
  // aggregated names for companies, partners, attendees, and events.
  // Strategy: fetch notes + join rows, then aggregate in application code.

  // Step 1: get filtered note IDs (apply all filters via subqueries)
  const conditions = [];

  if (dateFrom) {
    conditions.push(gte(meetingNotes.meetingDate, new Date(dateFrom)));
  }
  if (dateTo) {
    conditions.push(lte(meetingNotes.meetingDate, new Date(dateTo)));
  }

  // Company / partner filter: note must have at least one partner from that company/partner
  if (companyId || partnerId) {
    const partnerSubConditions = [];
    if (companyId) partnerSubConditions.push(eq(companies.id, companyId));
    if (partnerId) partnerSubConditions.push(eq(partners.id, partnerId));

    const partnerSubquery = db
      .select({ meetingNoteId: meetingNotePartners.meetingNoteId })
      .from(meetingNotePartners)
      .innerJoin(partners, eq(meetingNotePartners.partnerId, partners.id))
      .innerJoin(companies, eq(partners.companyId, companies.id))
      .where(and(...partnerSubConditions));

    conditions.push(
      sql`${meetingNotes.id} IN (${partnerSubquery})`
    );
  }

  if (biztechAttendeeId) {
    const attendeeSubquery = db
      .select({ meetingNoteId: meetingNoteAttendees.meetingNoteId })
      .from(meetingNoteAttendees)
      .where(eq(meetingNoteAttendees.userId, biztechAttendeeId));

    conditions.push(sql`${meetingNotes.id} IN (${attendeeSubquery})`);
  }

  if (eventId) {
    const eventSubquery = db
      .select({ meetingNoteId: meetingNoteEvents.meetingNoteId })
      .from(meetingNoteEvents)
      .where(eq(meetingNoteEvents.eventId, eventId));

    conditions.push(sql`${meetingNotes.id} IN (${eventSubquery})`);
  }

  // Step 2: fetch notes
  const notesQuery = db
    .select({
      id: meetingNotes.id,
      title: meetingNotes.title,
      meetingDate: meetingNotes.meetingDate,
      source: meetingNotes.source,
      createdAt: meetingNotes.createdAt,
    })
    .from(meetingNotes)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(200);

  const noteRows = await notesQuery;

  if (noteRows.length === 0) return [];

  const noteIds = noteRows.map((n) => n.id);

  // Step 3: fetch partner + company data for those notes
  const partnerRows = await db
    .select({
      meetingNoteId: meetingNotePartners.meetingNoteId,
      partnerId: partners.id,
      partnerFirstName: partners.first_name,
      partnerLastName: partners.last_name,
      companyId: companies.id,
      companyName: companies.name,
    })
    .from(meetingNotePartners)
    .innerJoin(partners, eq(meetingNotePartners.partnerId, partners.id))
    .leftJoin(companies, eq(partners.companyId, companies.id))
    .where(sql`${meetingNotePartners.meetingNoteId} = ANY(${sql.raw(`ARRAY[${noteIds.map((id) => `'${id}'`).join(",")}]::uuid[]`)})`)

  // Step 4: fetch attendees
  const attendeeRows = await db
    .select({
      meetingNoteId: meetingNoteAttendees.meetingNoteId,
      userId: users.id,
      firstName: users.first_name,
      lastName: users.last_name,
    })
    .from(meetingNoteAttendees)
    .innerJoin(users, eq(meetingNoteAttendees.userId, users.id))
    .where(sql`${meetingNoteAttendees.meetingNoteId} = ANY(${sql.raw(`ARRAY[${noteIds.map((id) => `'${id}'`).join(",")}]::uuid[]`)})`)

  // Step 5: fetch events
  const eventRows = await db
    .select({
      meetingNoteId: meetingNoteEvents.meetingNoteId,
      eventId: events.id,
      eventName: events.name,
    })
    .from(meetingNoteEvents)
    .innerJoin(events, eq(meetingNoteEvents.eventId, events.id))
    .where(sql`${meetingNoteEvents.meetingNoteId} = ANY(${sql.raw(`ARRAY[${noteIds.map((id) => `'${id}'`).join(",")}]::uuid[]`)})`)

  // Step 6: assemble
  type NoteRow = {
    id: string;
    title: string;
    meetingDate: Date;
    source: string;
    createdAt: Date;
    companies: { id: string; name: string }[];
    partners: { id: string; firstName: string; lastName: string }[];
    attendees: { id: string; firstName: string; lastName: string }[];
    events: { id: string; name: string }[];
  };

  const noteMap = new Map<string, NoteRow>();
  for (const note of noteRows) {
    noteMap.set(note.id, {
      ...note,
      companies: [],
      partners: [],
      attendees: [],
      events: [],
    });
  }

  for (const row of partnerRows) {
    const note = noteMap.get(row.meetingNoteId);
    if (!note) continue;
    note.partners.push({
      id: row.partnerId,
      firstName: row.partnerFirstName,
      lastName: row.partnerLastName,
    });
    if (row.companyId && row.companyName) {
      if (!note.companies.some((c) => c.id === row.companyId)) {
        note.companies.push({ id: row.companyId!, name: row.companyName! });
      }
    }
  }

  for (const row of attendeeRows) {
    const note = noteMap.get(row.meetingNoteId);
    if (!note) continue;
    note.attendees.push({ id: row.userId, firstName: row.firstName, lastName: row.lastName });
  }

  for (const row of eventRows) {
    const note = noteMap.get(row.meetingNoteId);
    if (!note) continue;
    note.events.push({ id: row.eventId, name: row.eventName });
  }

  const result = Array.from(noteMap.values());

  // Sort
  if (sort === "company") {
    result.sort((a, b) => {
      const aName = a.companies[0]?.name ?? "zzz";
      const bName = b.companies[0]?.name ?? "zzz";
      return aName.localeCompare(bName);
    });
  } else {
    result.sort((a, b) => b.meetingDate.getTime() - a.meetingDate.getTime());
  }

  return result;
}

export type MeetingNoteListItem = Awaited<ReturnType<typeof getMeetingNotes>>[number];

// ---------------------------------------------------------------------------
// Detail query
// ---------------------------------------------------------------------------
export async function getMeetingNoteById(id: string) {
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
        partnerFirstName: partners.first_name,
        partnerLastName: partners.last_name,
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
      : Promise.resolve([]),
  ]);

  // Group partners by company
  const companyMap = new Map<string, { id: string; name: string; partners: { id: string; firstName: string; lastName: string }[] }>();
  const noCompanyPartners: { id: string; firstName: string; lastName: string }[] = [];

  for (const row of partnerRows) {
    const p = { id: row.partnerId, firstName: row.partnerFirstName, lastName: row.partnerLastName };
    if (row.companyId && row.companyName) {
      if (!companyMap.has(row.companyId)) {
        companyMap.set(row.companyId, { id: row.companyId, name: row.companyName, partners: [] });
      }
      companyMap.get(row.companyId)!.partners.push(p);
    } else {
      noCompanyPartners.push(p);
    }
  }

  const creator = creatorRows[0] ?? null;

  return {
    ...note,
    partnersByCompany: Array.from(companyMap.values()),
    noCompanyPartners,
    attendees: attendeeRows,
    events: eventRows,
    creator,
  };
}

export type MeetingNoteDetail = NonNullable<Awaited<ReturnType<typeof getMeetingNoteById>>>;

// getMeetingNoteForEdit — same as getMeetingNoteById but verifies ownership
export async function getMeetingNoteForEdit(id: string, userId: string) {
  const note = await getMeetingNoteById(id);
  if (!note) return null;
  if (note.createdBy !== userId) return null;
  return note;
}

// ---------------------------------------------------------------------------
// Picker data helpers
// ---------------------------------------------------------------------------
export async function getAllPartners() {
  return db
    .select({
      id: partners.id,
      firstName: partners.first_name,
      lastName: partners.last_name,
      companyId: companies.id,
      companyName: companies.name,
    })
    .from(partners)
    .leftJoin(companies, eq(partners.companyId, companies.id))
    .orderBy(companies.name, partners.last_name);
}

export async function getAllUsers() {
  return db
    .select({
      id: users.id,
      firstName: users.first_name,
      lastName: users.last_name,
    })
    .from(users)
    .orderBy(users.first_name);
}

export async function getAllEvents() {
  return db
    .select({
      id: events.id,
      name: events.name,
      startDate: events.startDate,
      archived: events.archived,
    })
    .from(events)
    .orderBy(events.archived, sql`${events.startDate} DESC`);
}

export async function getAllCompanies() {
  return db
    .selectDistinct({
      id: companies.id,
      name: companies.name,
    })
    .from(companies)
    .innerJoin(partners, eq(partners.companyId, companies.id))
    .innerJoin(meetingNotePartners, eq(meetingNotePartners.partnerId, partners.id))
    .orderBy(companies.name);
}
