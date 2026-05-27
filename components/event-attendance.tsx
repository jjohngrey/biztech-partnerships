"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import type {
  CrmEventSummary,
  EventAttendanceStatus,
  EventRole,
  PartnerEventAttendance,
} from "@/lib/partnerships/types";

// ── shared helpers ────────────────────────────────────────────────────────────

function inputClass(extra = "") {
  return [
    "h-9 w-full min-w-0 max-w-full rounded-md border border-white/9 bg-[#0d0e11] px-3 text-[13px] text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-400/70 focus:ring-2 focus:ring-zinc-400/15",
    extra,
  ].join(" ");
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 max-w-full gap-1.5 text-[12px] font-medium text-zinc-400">
      {label}
      {children}
    </label>
  );
}

export const eventRoles: Array<{ value: EventRole; label: string }> = [
  { value: "judge", label: "Judge" },
  { value: "mentor", label: "Mentor" },
  { value: "speaker", label: "Speaker / keynote" },
  { value: "workshop", label: "Workshop" },
  { value: "sponsor", label: "Sponsor" },
  { value: "booth", label: "Booth" },
  { value: "student", label: "Student" },
];

export const eventStatuses: Array<{ value: EventAttendanceStatus; label: string }> = [
  { value: "asked", label: "Asked" },
  { value: "interested", label: "Interested" },
  { value: "form_sent", label: "Waiting for form" },
  { value: "form_submitted", label: "Form submitted" },
  { value: "confirmed", label: "Confirmed" },
  { value: "declined", label: "Declined" },
  { value: "attended", label: "Attended" },
];

export function eventRoleLabel(value: EventRole) {
  return eventRoles.find((role) => role.value === value)?.label ?? value;
}

export function eventStatusLabel(value: EventAttendanceStatus) {
  return eventStatuses.find((status) => status.value === value)?.label ?? value;
}

export function eventSummary(items: PartnerEventAttendance[]) {
  if (!items.length) return "No events";
  return items
    .map((item) => `${item.eventName} (${eventRoleLabel(item.eventRole)} · ${eventStatusLabel(item.eventStatus)})`)
    .join(", ");
}

function getEventMatch(events: CrmEventSummary[], value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return events.find((event) => event.name.trim().toLowerCase() === normalized) ?? null;
}

// ── EventCombo ────────────────────────────────────────────────────────────────

export function EventCombo({
  events,
  value,
  onChange,
}: {
  events: CrmEventSummary[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const match = getEventMatch(events, value);
  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return events.slice(0, 6);
    return events.filter((event) => event.name.toLowerCase().includes(query)).slice(0, 6);
  }, [events, value]);

  return (
    <div className="relative">
      <input type="hidden" name="eventId" value={match?.id ?? ""} />
      <input
        name="eventName"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder="Search events"
        className={inputClass("w-full")}
      />
      {open && (
        <div className="absolute left-0 right-0 top-11 z-30 overflow-hidden rounded-md border border-white/10 bg-[#15161a] shadow-2xl shadow-black/40">
          {filtered.map((event) => (
            <button
              key={event.id}
              type="button"
              onMouseDown={(mouseEvent) => mouseEvent.preventDefault()}
              onClick={() => {
                onChange(event.name);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-white/5 cursor-pointer"
            >
              <span className="truncate text-[13px] font-medium text-zinc-100">{event.name}</span>
              <span className="shrink-0 text-[12px] text-zinc-500">{event.year ?? ""}</span>
            </button>
          ))}
          {!filtered.length && (
            <div className="px-3 py-2.5 text-[13px] text-zinc-500">No matching events</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── EventAttendancePicker ─────────────────────────────────────────────────────
// Inline optional block used inside create/log-contact forms.

export function EventAttendancePicker({
  events,
  value,
  onChange,
  label = "Event attendance",
  optional = true,
}: {
  events: CrmEventSummary[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  optional?: boolean;
}) {
  const disabled = !value.trim();
  return (
    <div className="grid gap-3 rounded-md border border-white/[0.08] bg-white/[0.025] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-zinc-300">{label}</p>
        {optional && <span className="shrink-0 text-[12px] text-zinc-600">Optional</span>}
      </div>
      <Field label="Event">
        <EventCombo events={events} value={value} onChange={onChange} />
      </Field>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Field label="Role">
          <select name="eventRole" defaultValue="judge" disabled={disabled} className={inputClass("w-full min-w-0")}>
            {eventRoles.map((role) => (
              <option key={role.value} value={role.value}>{role.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select name="eventStatus" defaultValue="asked" disabled={disabled} className={inputClass("w-full min-w-0")}>
            {eventStatuses.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  );
}

// ── EventAttendanceSection ────────────────────────────────────────────────────
// Full add-form + list section used in partner/company view and edit panels.

export function EventAttendanceSection({
  events,
  eventName,
  onEventNameChange,
  attendances,
  isPending,
  onSubmit,
  onUpdateStatus,
  onRemove,
  title = "Log event attendance",
  linkedCount,
  addLabel = "Add attendance",
  emptyLabel = "No event attendance linked yet.",
}: {
  events: CrmEventSummary[];
  eventName: string;
  onEventNameChange: (value: string) => void;
  attendances: PartnerEventAttendance[];
  isPending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateStatus: (attendance: PartnerEventAttendance, status: EventAttendanceStatus) => void;
  onRemove: (attendance: PartnerEventAttendance) => void;
  title?: string;
  linkedCount?: number;
  addLabel?: string;
  emptyLabel?: string;
}) {
  return (
    <>
      <div className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] font-medium text-zinc-200">{title}</p>
        {linkedCount !== undefined && (
          <p className="text-[12px] text-zinc-500">{linkedCount} linked</p>
        )}
      </div>
      <form onSubmit={onSubmit} className="mt-4 grid gap-3">
        <Field label="Event">
          <EventCombo events={events} value={eventName} onChange={onEventNameChange} />
        </Field>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <Field label="Role">
            <select name="eventRole" required className={inputClass("w-full min-w-0")}>
              {eventRoles.map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select name="eventStatus" required defaultValue="asked" className={inputClass("w-full min-w-0")}>
              {eventStatuses.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </Field>
        </div>
        <button
          disabled={isPending}
          className="h-9 w-fit rounded-md bg-zinc-700 px-4 text-[13px] font-medium text-white transition hover:bg-zinc-600 disabled:opacity-60 cursor-pointer"
        >
          {addLabel}
        </button>
      </form>
      <div className="mt-4 space-y-2">
        {attendances.length ? (
          attendances.map((attendance) => (
            <div
              key={`${attendance.eventId}-${attendance.eventRole}`}
              className="grid gap-2 rounded-md bg-white/[0.035] px-3 py-2 text-[13px] sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-center"
            >
              <span className="min-w-0">
                <span className="block truncate text-zinc-200">{attendance.eventName}</span>
                <span className="block truncate text-[12px] text-zinc-500">{eventRoleLabel(attendance.eventRole)}</span>
              </span>
              <select
                value={attendance.eventStatus}
                disabled={isPending}
                onChange={(event) => onUpdateStatus(attendance, event.currentTarget.value as EventAttendanceStatus)}
                aria-label={`${attendance.eventName} ${eventRoleLabel(attendance.eventRole)} status`}
                className={inputClass("h-8 px-2 text-[12px]")}
              >
                {eventStatuses.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
              <span className="inline-flex shrink-0 items-center gap-1">
                <a
                  href={`/events?eventId=${attendance.eventId}`}
                  className="grid size-8 place-items-center rounded-md text-zinc-500 transition hover:bg-white/5.5 hover:text-white"
                  aria-label={`Open ${attendance.eventName}`}
                >
                  <ExternalLink className="size-4" strokeWidth={1.8} />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm(`Remove ${attendance.eventName} attendance?`)) return;
                    onRemove(attendance);
                  }}
                  aria-label={`Remove ${attendance.eventName} ${eventRoleLabel(attendance.eventRole)} attendance`}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition hover:bg-red-500/10 hover:text-red-200 cursor-pointer"
                >
                  <Trash2 className="size-4" strokeWidth={1.8} />
                </button>
              </span>
            </div>
          ))
        ) : (
          <p className="text-[13px] text-zinc-500">{emptyLabel}</p>
        )}
      </div>
    </>
  );
}
