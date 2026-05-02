import Link from "next/link";
import { Suspense } from "react";
import {
  getMeetingNotes,
  getAllCompanies,
  getAllPartners,
  getAllUsers,
  getAllEvents,
  type MeetingNoteFilters,
} from "@/lib/db/queries/meeting-notes";
import { FilterBar } from "@/components/meetings/filter-bar";

interface SearchParams {
  companyId?: string;
  partnerId?: string;
  biztechAttendeeId?: string;
  eventId?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function truncateList(items: string[], max = 2) {
  if (items.length <= max) return items.join(", ");
  return `${items.slice(0, max).join(", ")} +${items.length - max} more`;
}

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const filters: MeetingNoteFilters = {
    companyId: params.companyId,
    partnerId: params.partnerId,
    biztechAttendeeId: params.biztechAttendeeId,
    eventId: params.eventId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    sort: params.sort === "company" ? "company" : "date",
  };

  const isFiltered =
    filters.companyId ||
    filters.partnerId ||
    filters.biztechAttendeeId ||
    filters.eventId ||
    filters.dateFrom ||
    filters.dateTo;

  const [notes, companies, allPartners, users, events] = await Promise.all([
    getMeetingNotes(filters),
    getAllCompanies(),
    getAllPartners(),
    getAllUsers(),
    getAllEvents(),
  ]);

  const hitCap = notes.length === 200;

  const filterPartners = allPartners.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    companyId: p.companyId ?? null,
  }));

  const filterEvents = events.map((e) => ({
    id: e.id,
    name: e.name,
    archived: e.archived,
  }));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Meeting Notes</h1>
        <Link
          href="/meetings/new"
          className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
        >
          New meeting note
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <Suspense>
          <FilterBar
            companies={companies}
            partners={filterPartners}
            users={users}
            events={filterEvents}
          />
        </Suspense>
      </div>

      {/* Cap banner */}
      {hitCap && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Showing first 200 notes — use filters to narrow results.
        </div>
      )}

      {/* Empty states */}
      {notes.length === 0 && !isFiltered && (
        <div className="flex flex-col items-center gap-3 py-20 text-neutral-500">
          <p>No meeting notes yet.</p>
          <Link
            href="/meetings/new"
            className="text-sm font-medium text-neutral-900 underline underline-offset-2"
          >
            Add the first one
          </Link>
        </div>
      )}

      {notes.length === 0 && isFiltered && (
        <div className="flex flex-col items-center gap-3 py-20 text-neutral-500">
          <p>No notes match these filters.</p>
          <Link
            href="/meetings"
            className="text-sm font-medium text-neutral-900 underline underline-offset-2"
          >
            Clear all filters
          </Link>
        </div>
      )}

      {/* Table */}
      {notes.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-neutral-600">Title</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-600">Meeting Date</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-600">Companies</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-600">Partner Attendees</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-600">BizTech Team</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-600">Events</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-600">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {notes.map((note) => (
                <tr key={note.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/meetings/${note.id}`}
                      className="font-medium text-neutral-900 hover:underline"
                    >
                      {note.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {formatDate(note.meetingDate)}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {note.companies.length > 0
                      ? truncateList(note.companies.map((c) => c.name))
                      : <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {note.partners.length > 0
                      ? truncateList(note.partners.map((p) => `${p.firstName} ${p.lastName}`))
                      : <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {note.attendees.length > 0
                      ? truncateList(note.attendees.map((a) => `${a.firstName} ${a.lastName}`))
                      : <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {note.events.length > 0
                      ? truncateList(note.events.map((e) => e.name))
                      : <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                      {note.source === "upload" ? "Upload" : "Paste"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
