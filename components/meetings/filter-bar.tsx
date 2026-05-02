"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface Company {
  id: string;
  name: string;
}

interface Partner {
  id: string;
  firstName: string;
  lastName: string;
  companyId: string | null;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
}

interface Event {
  id: string;
  name: string;
  archived: boolean;
}

interface FilterBarProps {
  companies: Company[];
  partners: Partner[];
  users: User[];
  events: Event[];
}

export function FilterBar({ companies, partners, users, events }: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const companyId = searchParams.get("companyId") ?? "";
  const partnerId = searchParams.get("partnerId") ?? "";
  const biztechAttendeeId = searchParams.get("biztechAttendeeId") ?? "";
  const eventId = searchParams.get("eventId") ?? "";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const sort = searchParams.get("sort") ?? "";

  const isActive = companyId || partnerId || biztechAttendeeId || eventId || dateFrom || dateTo;

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Reset partner filter when company changes
      if (key === "companyId") params.delete("partnerId");
      router.push(`/meetings?${params.toString()}`);
    },
    [router, searchParams]
  );

  const clearAll = () => router.push("/meetings");

  // Filter partners by active company
  const visiblePartners = companyId
    ? partners.filter((p) => p.companyId === companyId)
    : partners;

  const activeEvents = events.filter((e) => !e.archived);
  const archivedEvents = events.filter((e) => e.archived);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      {/* Company */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-neutral-500">Company</label>
        <select
          value={companyId}
          onChange={(e) => update("companyId", e.target.value)}
          className="h-8 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
        >
          <option value="">All companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Partner */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-neutral-500">Partner</label>
        <select
          value={partnerId}
          onChange={(e) => update("partnerId", e.target.value)}
          className="h-8 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
        >
          <option value="">All partners</option>
          {visiblePartners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </option>
          ))}
        </select>
      </div>

      {/* BizTech Attendee */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-neutral-500">BizTech Attendee</label>
        <select
          value={biztechAttendeeId}
          onChange={(e) => update("biztechAttendeeId", e.target.value)}
          className="h-8 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
        >
          <option value="">All members</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.firstName} {u.lastName}
            </option>
          ))}
        </select>
      </div>

      {/* Event */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-neutral-500">Event</label>
        <select
          value={eventId}
          onChange={(e) => update("eventId", e.target.value)}
          className="h-8 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
        >
          <option value="">All events</option>
          {activeEvents.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
          {archivedEvents.length > 0 && (
            <optgroup label="Archived">
              {archivedEvents.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Date From */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-neutral-500">From</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => update("dateFrom", e.target.value)}
          className="h-8 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
        />
      </div>

      {/* Date To */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-neutral-500">To</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => update("dateTo", e.target.value)}
          className="h-8 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
        />
      </div>

      {/* Sort */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-neutral-500">Sort by</label>
        <select
          value={sort}
          onChange={(e) => update("sort", e.target.value)}
          className="h-8 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
        >
          <option value="">Date (newest first)</option>
          <option value="company">Company (A–Z)</option>
        </select>
      </div>

      {/* Clear all */}
      {isActive && (
        <button
          onClick={clearAll}
          className="h-8 self-end text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-900"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
