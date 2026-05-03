"use client";

import { useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, Plus, Trash2, X } from "lucide-react";
import {
  createCompanyInteractionAction,
  deleteCompanyInteractionAction,
  logEventPartnerResponseAction,
} from "@/lib/partnerships/actions";
import type {
  CompanyDirectoryRecord,
  CompanyInteractionRecord,
  CrmEventSummary,
  CrmUserSummary,
  EventAttendanceStatus,
  EventRole,
  MeetingLogRecord,
  PartnerDirectoryRecord,
  TouchpointRecord,
} from "@/lib/partnerships/types";

type TouchpointsDirectoryProps = {
  touchpoints: TouchpointRecord[];
  meetings: MeetingLogRecord[];
  companies: CompanyDirectoryRecord[];
  partners: PartnerDirectoryRecord[];
  users: CrmUserSummary[];
  events: CrmEventSummary[];
  initialActivityKey?: string;
  initialCreate?: boolean;
  initialCompanyName?: string;
  initialContactName?: string;
  initialEventName?: string;
};

type SortDirection = "asc" | "desc";
type SortKey = "date" | "company" | "contact" | "type";
type PanelMode = "closed" | "create" | "view";

type ActivityRecord = {
  id: string;
  key: string;
  kind: "touchpoint" | "meeting";
  title: string;
  dateIso: string;
  companyNames: string[];
  partnerNames: string[];
  userNames: string[];
  typeLabel: string;
  followUpDate: string | null;
  notes: string | null;
  touchpoint?: TouchpointRecord;
  meeting?: MeetingLogRecord;
};

const touchpointTypes: Array<{ value: CompanyInteractionRecord["type"]; label: string }> = [
  { value: "meeting", label: "Meeting" },
  { value: "email", label: "Email" },
  { value: "call", label: "Call" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "in_person", label: "In person" },
  { value: "other", label: "Other" },
];

const eventRoles: Array<{ value: EventRole; label: string }> = [
  { value: "judge", label: "Judge" },
  { value: "mentor", label: "Mentor" },
  { value: "speaker", label: "Speaker / keynote" },
  { value: "workshop", label: "Workshop" },
  { value: "sponsor", label: "Sponsor" },
  { value: "booth", label: "Booth" },
  { value: "student", label: "Student" },
];

const eventStatuses: Array<{ value: EventAttendanceStatus; label: string }> = [
  { value: "asked", label: "Asked" },
  { value: "interested", label: "Interested" },
  { value: "form_sent", label: "Waiting for form" },
  { value: "form_submitted", label: "Form submitted" },
  { value: "confirmed", label: "Confirmed" },
  { value: "declined", label: "Declined" },
  { value: "attended", label: "Attended" },
];

function inputClass(extra = "") {
  return [
    "h-9 w-full min-w-0 max-w-full rounded-md border border-white/[0.09] bg-[#0d0e11] px-3 text-[13px] text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-400/70 focus:ring-2 focus:ring-zinc-400/15",
    extra,
  ].join(" ");
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-[12px] font-medium text-zinc-400">
      {label}
      {children}
    </label>
  );
}

function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function compareText(left: string | null | undefined, right: string | null | undefined) {
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, { sensitivity: "base" });
}

function sortValue(result: number, direction: SortDirection) {
  return direction === "asc" ? result : -result;
}

function getCompanyMatch(companies: CompanyDirectoryRecord[], value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return companies.find((company) => company.name.trim().toLowerCase() === normalized) ?? null;
}

function getEventMatch(events: CrmEventSummary[], value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return events.find((event) => event.name.trim().toLowerCase() === normalized) ?? null;
}

function splitPersonName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function getPartnerMatch(partners: PartnerDirectoryRecord[], value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return (
    partners.find((partner) => {
      const values = [partner.name, partner.email, partner.linkedin]
        .filter(Boolean)
        .map((item) => String(item).trim().toLowerCase());
      return values.includes(normalized);
    }) ?? null
  );
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={["-ml-2 w-fit rounded-full px-2 py-1 text-left transition hover:bg-white/[0.055] hover:text-zinc-300 cursor-pointer",
        active ? "bg-white/[0.055] text-zinc-200" : "",
      ].join(" ")}
    >
      {label}
      {active ? ` ${direction === "asc" ? "↑" : "↓"}` : ""}
    </button>
  );
}

function CompanyCombo({
  companies,
  value,
  onChange,
}: {
  companies: CompanyDirectoryRecord[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const match = getCompanyMatch(companies, value);
  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return companies.slice(0, 6);
    return companies.filter((company) => company.name.toLowerCase().includes(query)).slice(0, 6);
  }, [companies, value]);

  return (
    <div className="relative">
      <input type="hidden" name="companyId" value={match?.id ?? ""} />
      <input
        aria-label="Company"
        name="companyName"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder="Search companies or create one"
        className={inputClass()}
      />
      {open && (
        <div className="absolute left-0 right-0 top-11 z-30 overflow-hidden rounded-md border border-white/[0.1] bg-[#15161a] shadow-2xl shadow-black/40">
          {filtered.map((company) => (
            <button
              key={company.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(company.name);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.05] cursor-pointer"
            >
              <span className="truncate text-[13px] font-medium text-zinc-100">{company.name}</span>
              <span className="shrink-0 text-[12px] text-zinc-500">{company.activeContactsCount} partners</span>
            </button>
          ))}
          {!match && value.trim() && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setOpen(false)}
              className="block w-full border-t border-white/[0.08] px-3 py-2.5 text-left text-[13px] text-zinc-300 transition hover:bg-white/[0.05] cursor-pointer"
            >
              Create company &quot;{value.trim()}&quot;
            </button>
          )}
        </div>
      )}
      {!match && value.trim() ? (
        <p className="mt-1.5 text-[12px] font-normal text-zinc-500">
          Will create company &quot;{value.trim()}&quot; when saved.
        </p>
      ) : null}
    </div>
  );
}

function EventCombo({
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
    const source = query ? events.filter((event) => event.name.toLowerCase().includes(query)) : events;
    return source.slice(0, 6);
  }, [events, value]);

  return (
    <div className="relative">
      <input type="hidden" name="eventId" value={match?.id ?? ""} />
      <input
        aria-label="Event"
        name="eventName"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder="Search events"
        className={inputClass()}
      />
      {open ? (
        <div className="absolute left-0 right-0 top-11 z-30 max-h-72 overflow-auto rounded-md border border-white/[0.1] bg-[#15161a] shadow-2xl shadow-black/40">
          {filtered.map((event) => (
            <button
              key={event.id}
              type="button"
              onMouseDown={(mouseEvent) => mouseEvent.preventDefault()}
              onClick={() => {
                onChange(event.name);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 border-b border-white/[0.06] px-3 py-2.5 text-left transition last:border-b-0 hover:bg-white/[0.05] cursor-pointer"
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-zinc-100">{event.name}</span>
                <span className="block truncate text-[12px] text-zinc-500">{event.year}</span>
              </span>
              <span className="shrink-0 text-[12px] text-zinc-500">
                {event.confirmedPartnerCount}
                {event.confirmedPartnerGoal ? `/${event.confirmedPartnerGoal}` : ""} confirmed
              </span>
            </button>
          ))}
          {!filtered.length ? (
            <div className="px-3 py-2.5 text-[13px] text-zinc-500">No matching events.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PersonCombo({
  partners,
  value,
  selectedId,
  onChange,
  onSelect,
}: {
  partners: PartnerDirectoryRecord[];
  value: string;
  selectedId: string;
  onChange: (value: string) => void;
  onSelect: (partner: PartnerDirectoryRecord | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const match = selectedId ? partners.find((partner) => partner.id === selectedId) ?? null : getPartnerMatch(partners, value);
  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase();
    const source = query
      ? partners.filter((partner) =>
          [partner.name, partner.email, partner.linkedin, partner.companyName]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query),
        )
      : partners;
    return source.slice(0, 6);
  }, [partners, value]);

  return (
    <div className="relative">
      <input type="hidden" name="partnerId" value={selectedId || match?.id || ""} />
      <input
        aria-label="Contacted person"
        name="partnerName"
        value={value}
        onChange={(event) => {
          onSelect(null);
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder="Search people or type a new one"
        className={inputClass()}
      />
      {open ? (
        <div className="absolute left-0 right-0 top-11 z-30 max-h-72 overflow-auto rounded-md border border-white/[0.1] bg-[#15161a] shadow-2xl shadow-black/40">
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onSelect(null);
              onChange("");
              setOpen(false);
            }}
            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.05] cursor-pointer"
          >
            <span className="truncate text-[13px] font-medium text-zinc-100">Company-level contact</span>
            <span className="shrink-0 text-[12px] text-zinc-500">No person</span>
          </button>
          {filtered.map((partner) => (
            <button
              key={partner.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(partner);
                onChange(partner.name);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 border-t border-white/[0.06] px-3 py-2.5 text-left transition hover:bg-white/[0.05] cursor-pointer"
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-zinc-100">{partner.name}</span>
                <span className="block truncate text-[12px] text-zinc-500">{partner.companyName}</span>
              </span>
              <span className="shrink-0 truncate text-[12px] text-zinc-500">{partner.email ?? "LinkedIn"}</span>
            </button>
          ))}
          {!match && value.trim() ? (
            <div className="border-t border-white/[0.08] px-3 py-2.5 text-[13px] text-zinc-300">
              Create person &quot;{value.trim()}&quot;
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function toActivities(touchpoints: TouchpointRecord[], meetings: MeetingLogRecord[]): ActivityRecord[] {
  return [
    ...touchpoints.map((touchpoint) => ({
      id: touchpoint.id,
      key: `touchpoint:${touchpoint.id}`,
      kind: "touchpoint" as const,
      title: touchpoint.subject || titleCase(touchpoint.type),
      dateIso: touchpoint.contactedAtIso,
      companyNames: [touchpoint.companyName],
      partnerNames: touchpoint.partnerName ? [touchpoint.partnerName] : [],
      userNames: [touchpoint.userName],
      typeLabel: touchpointTypes.find((type) => type.value === touchpoint.type)?.label ?? titleCase(touchpoint.type),
      followUpDate: touchpoint.followUpDate,
      notes: touchpoint.notes,
      touchpoint,
    })),
    ...meetings.map((meeting) => ({
      id: meeting.id,
      key: `meeting:${meeting.id}`,
      kind: "meeting" as const,
      title: meeting.title,
      dateIso: meeting.meetingDateIso,
      companyNames: meeting.companies.map((company) => company.name),
      partnerNames: meeting.partners.map((partner) => partner.name),
      userNames: meeting.attendees.map((attendee) => attendee.name),
      typeLabel: "Meeting",
      followUpDate: null,
      notes: meeting.summary || meeting.content,
      meeting,
    })),
  ];
}

function activityUrl(activityKey: string) {
  return `/contact-log?activity=${encodeURIComponent(activityKey)}`;
}

function resetActivityUrl() {
  window.history.replaceState(null, "", "/contact-log");
}

export function TouchpointsDirectory({
  touchpoints,
  meetings,
  companies,
  partners,
  users,
  events,
  initialActivityKey,
  initialCreate = false,
  initialCompanyName = "",
  initialContactName = "",
  initialEventName = "",
}: TouchpointsDirectoryProps) {
  const router = useRouter();
  const initialActivity = useMemo(
    () => toActivities(touchpoints, meetings).find((activity) => activity.key === initialActivityKey) ?? null,
    [initialActivityKey, meetings, touchpoints],
  );
  const [mode, setMode] = useState<PanelMode>(initialActivity ? "view" : initialCreate ? "create" : "closed");
  const [selectedKey, setSelectedKey] = useState<string | null>(initialActivity?.key ?? null);
  const [query, setQuery] = useState("");
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [contactName, setContactName] = useState(initialContactName);
  const [eventName, setEventName] = useState(initialEventName);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const companyMatch = getCompanyMatch(companies, companyName);
  const partnerOptions = companyMatch
    ? partners.filter((partner) => partner.companyId === companyMatch.id)
    : partners;
  const selectedPartner = selectedPartnerId
    ? partners.find((partner) => partner.id === selectedPartnerId) ?? null
    : getPartnerMatch(partnerOptions, contactName);
  const eventMatch = getEventMatch(events, eventName);
  const pendingPersonName = splitPersonName(contactName);

  const activities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = toActivities(touchpoints, meetings).filter((activity) => {
      if (!normalizedQuery) return true;
      return [
        activity.title,
        activity.typeLabel,
        activity.companyNames.join(" "),
        activity.partnerNames.join(" "),
        activity.userNames.join(" "),
        activity.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });

    return filtered.sort((left, right) => {
      const result =
        sortKey === "date"
          ? new Date(left.dateIso).getTime() - new Date(right.dateIso).getTime()
          : sortKey === "company"
            ? compareText(left.companyNames[0], right.companyNames[0])
            : sortKey === "contact"
              ? compareText(left.partnerNames[0], right.partnerNames[0])
              : compareText(left.typeLabel, right.typeLabel);
      return sortValue(result, sortDirection);
    });
  }, [meetings, query, sortDirection, sortKey, touchpoints]);

  const selected = activities.find((activity) => activity.key === selectedKey) ?? null;
  const panelOpen = mode !== "closed";
  const activityGridColumns = panelOpen
    ? "md:grid-cols-[minmax(180px,1.35fr)_98px_minmax(118px,1fr)_minmax(118px,1fr)] 2xl:grid-cols-[minmax(220px,1.4fr)_116px_minmax(150px,1fr)_minmax(150px,1fr)_118px_110px]"
    : "md:grid-cols-[minmax(220px,1.4fr)_112px_minmax(140px,1fr)_minmax(140px,1fr)] xl:grid-cols-[minmax(240px,1.4fr)_120px_minmax(160px,1fr)_minmax(160px,1fr)_130px_120px]";
  const panelOnlySecondaryColumnClass = panelOpen
    ? "hidden truncate text-zinc-400 2xl:block"
    : "hidden truncate text-zinc-400 xl:block";

  function sortActivities(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "date" ? "desc" : "asc");
  }

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    if (
      contactName.trim() &&
      !selectedPartner &&
      !String(data.get("partnerEmail") ?? "").trim() &&
      !String(data.get("partnerLinkedin") ?? "").trim()
    ) {
      setError("New people need either an email or LinkedIn.");
      return;
    }
    if (eventName.trim() && !eventMatch) {
      setError("Choose an existing event before saving attendance.");
      return;
    }
    if (eventMatch && !contactName.trim() && !selectedPartnerId) {
      setError("Event attendance needs a contacted person.");
      return;
    }
    startTransition(async () => {
      try {
        const interaction = await createCompanyInteractionAction({
          companyId: String(data.get("companyId") ?? "") || undefined,
          companyName: String(data.get("companyName") ?? ""),
          partnerId: selectedPartnerId || String(data.get("partnerId") ?? "") || undefined,
          partnerFirstName: String(data.get("partnerFirstName") ?? ""),
          partnerLastName: String(data.get("partnerLastName") ?? ""),
          partnerRole: String(data.get("partnerRole") ?? ""),
          partnerEmail: String(data.get("partnerEmail") ?? ""),
          partnerLinkedin: String(data.get("partnerLinkedin") ?? ""),
          userId: String(data.get("userId") ?? ""),
          type: String(data.get("type") ?? "meeting") as CompanyInteractionRecord["type"],
          direction: String(data.get("direction") || "") as CompanyInteractionRecord["direction"],
          subject: String(data.get("subject") ?? ""),
          notes: String(data.get("notes") ?? ""),
          contactedAt: String(data.get("contactedAt") ?? ""),
          followUpDate: String(data.get("followUpDate") ?? "") || undefined,
        });
        if (eventMatch) {
          const partnerId = selectedPartnerId || interaction.partnerId || undefined;
          await logEventPartnerResponseAction({
            eventId: eventMatch.id,
            eventRole: String(data.get("eventRole") ?? "judge") as EventRole,
            eventStatus: String(data.get("eventStatus") ?? "asked") as EventAttendanceStatus,
            partnerId,
            firstName: partnerId ? undefined : String(data.get("partnerFirstName") ?? ""),
            lastName: partnerId ? undefined : String(data.get("partnerLastName") ?? ""),
            companyId: String(data.get("companyId") ?? "") || undefined,
            companyName: String(data.get("companyName") ?? ""),
            role: String(data.get("partnerRole") ?? ""),
            email: String(data.get("partnerEmail") ?? ""),
            linkedin: String(data.get("partnerLinkedin") ?? ""),
          });
        }
        form.reset();
        setCompanyName("");
        setContactName("");
        setEventName("");
        setSelectedPartnerId("");
        setMode("closed");
        resetActivityUrl();
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not log contact.");
      }
    });
  }

  return (
    <div className={["grid min-h-[100dvh] w-full max-w-full grid-cols-1 overflow-x-hidden bg-[#0d0d0f] text-zinc-100 xl:overflow-hidden", panelOpen ? "xl:grid-cols-[minmax(0,1fr)_minmax(400px,480px)]" : ""].join(" ")}>
      <section className={["min-w-0 bg-[#0d0d0f] px-3 py-4 sm:px-5 sm:py-5 xl:overflow-hidden", panelOpen ? "hidden xl:block" : ""].join(" ")}>
        <h2 className="text-[15px] font-medium text-zinc-100">Contact history</h2>

        <div className="mt-4 grid w-full max-w-[calc(100dvw-1.5rem)] grid-cols-1 gap-2 md:max-w-[860px] md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <input
            name="touchpointSearch"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={inputClass("min-w-0 flex-1")}
            placeholder="Search contact history..."
          />
          <button
            type="button"
            onClick={() => {
              setError(null);
              setSelectedKey(null);
              setCompanyName("");
              setContactName("");
              setEventName("");
              setSelectedPartnerId("");
              setMode("create");
              resetActivityUrl();
            }}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-zinc-700 px-3.5 text-[13px] font-medium text-white transition hover:bg-zinc-600 md:w-auto cursor-pointer"
          >
            <Plus className="size-4" strokeWidth={1.8} />
            Log contact
          </button>
        </div>

        <div className="mt-5 w-full max-w-[calc(100dvw-1.5rem)] overflow-hidden rounded-md border border-white/[0.09] bg-[#111113] md:max-w-full">
          <div className="flex gap-2 border-b border-white/[0.08] px-4 py-2.5 text-[12px] text-zinc-500 md:hidden">
            <SortHeader label="Date" sortKey="date" activeKey={sortKey} direction={sortDirection} onSort={sortActivities} />
            <SortHeader label="Company" sortKey="company" activeKey={sortKey} direction={sortDirection} onSort={sortActivities} />
            <SortHeader label="Contact" sortKey="contact" activeKey={sortKey} direction={sortDirection} onSort={sortActivities} />
          </div>
          <div className={["hidden border-b border-white/[0.08] px-4 py-2.5 text-[12px] text-zinc-500 md:grid", activityGridColumns].join(" ")}>
            <SortHeader label="Subject" sortKey="type" activeKey={sortKey} direction={sortDirection} onSort={sortActivities} />
            <SortHeader label="Date" sortKey="date" activeKey={sortKey} direction={sortDirection} onSort={sortActivities} />
            <SortHeader label="Company" sortKey="company" activeKey={sortKey} direction={sortDirection} onSort={sortActivities} />
            <SortHeader label="Contact" sortKey="contact" activeKey={sortKey} direction={sortDirection} onSort={sortActivities} />
            <span className={panelOpen ? "hidden 2xl:block" : "hidden xl:block"}>BizTech Director</span>
            <span className={panelOpen ? "hidden 2xl:block" : "hidden xl:block"}>Next outreach</span>
          </div>
          <div className="max-h-[68vh] overflow-x-hidden overflow-y-auto">
            {activities.map((activity) => (
              <button
                key={activity.key}
                type="button"
                onClick={() => {
                  setError(null);
                  setSelectedKey(activity.key);
                  setMode("view");
                  window.history.replaceState(null, "", activityUrl(activity.key));
                }}
                className={["grid w-full grid-cols-1 gap-1 border-b border-white/[0.06] px-4 py-3.5 text-left text-[13px] text-zinc-300 transition hover:bg-white/[0.035] md:items-center md:gap-0 cursor-pointer",
                  activityGridColumns,
                  selectedKey === activity.key ? "bg-white/[0.055]" : "",
                ].join(" ")}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-zinc-100">{activity.title}</span>
                  <span className="block truncate text-[12px] text-zinc-500">{activity.typeLabel}</span>
                  <span className="mt-1 grid min-w-0 max-w-full gap-0.5 text-[12px] text-zinc-500 md:hidden">
                    <span className="block min-w-0 max-w-full truncate">
                      {formatDateTime(activity.dateIso)} · {activity.companyNames.join(", ") || "No company"}
                    </span>
                    <span className="block min-w-0 max-w-full truncate">
                      {activity.partnerNames.join(", ") || "Company-level contact"} ·{" "}
                      {activity.userNames.join(", ") || "No BizTech Director"}
                      {activity.followUpDate ? ` · Next outreach ${activity.followUpDate}` : ""}
                    </span>
                  </span>
                </span>
                <span className="hidden truncate text-zinc-400 md:block">{formatDateTime(activity.dateIso)}</span>
                <span className="hidden truncate md:block">{activity.companyNames.join(", ") || "No company"}</span>
                <span className="hidden truncate text-zinc-400 md:block">{activity.partnerNames.join(", ") || "Company-level contact"}</span>
                <span className={panelOnlySecondaryColumnClass}>{activity.userNames.join(", ") || "No BizTech Director"}</span>
                <span className={panelOnlySecondaryColumnClass}>{activity.followUpDate ?? ""}</span>
              </button>
            ))}
            {!activities.length && (
              <p className="px-4 py-8 text-[13px] text-zinc-500">No contact history matches this view.</p>
            )}
          </div>
          <div className="border-t border-white/[0.08] px-4 py-4 text-[13px] text-zinc-500">
            {activities.length} records
          </div>
        </div>
      </section>

      {panelOpen ? (
        <aside className="flex h-[calc(100dvh-50px)] w-full max-w-[100dvw] min-w-0 flex-col overflow-hidden border-l border-white/[0.08] bg-[#111113] xl:h-[100dvh]">
          <div className="flex h-14 shrink-0 min-w-0 items-center gap-2 border-b border-white/[0.08] px-3 sm:px-5">
            <button
              type="button"
              aria-label="Close contact history panel"
              onClick={() => {
                setMode("closed");
                setSelectedKey(null);
                setCompanyName("");
                setContactName("");
                setEventName("");
                setSelectedPartnerId("");
                resetActivityUrl();
              }}
              className="grid size-7 shrink-0 place-items-center rounded-md border border-white/[0.12] bg-white/[0.055] text-zinc-300 transition hover:border-red-400/30 hover:bg-red-500/15 hover:text-red-200 xl:hidden cursor-pointer"
            >
              <X className="size-4" strokeWidth={1.8} />
            </button>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[17px] font-medium text-white">
                {mode === "create" ? "Log contact" : selected?.title ?? "Contact history"}
              </h3>
            </div>
            <button
              type="button"
              aria-label="Close contact history panel"
              onClick={() => {
                setMode("closed");
                setSelectedKey(null);
                setCompanyName("");
                setContactName("");
                setEventName("");
                setSelectedPartnerId("");
                resetActivityUrl();
              }}
              className="hidden size-8 shrink-0 place-items-center rounded-md border border-white/[0.12] bg-white/[0.055] text-zinc-300 transition hover:border-red-400/30 hover:bg-red-500/15 hover:text-red-200 xl:grid cursor-pointer"
            >
              <X className="size-5" strokeWidth={1.8} />
            </button>
          </div>

          {mode === "create" ? (
            <form onSubmit={submitCreate} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 min-w-0 space-y-4 overflow-x-hidden overflow-y-auto px-5 py-5">
                <Field label="Subject">
                  <input name="subject" required placeholder="Followed up on sponsorship deck" className={inputClass()} />
                </Field>
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  <Field label="Date">
                    <input name="contactedAt" required type="date" className={inputClass()} />
                  </Field>
                  <Field label="Next outreach">
                    <input name="followUpDate" type="date" className={inputClass()} />
                  </Field>
                </div>
                <Field label="Company">
                  <CompanyCombo
                    companies={companies}
                    value={companyName}
                    onChange={(value) => {
                      setCompanyName(value);
                      setSelectedPartnerId("");
                    }}
                  />
                </Field>
                <Field label="Contacted person">
                  <PersonCombo
                    partners={partnerOptions}
                    value={contactName}
                    selectedId={selectedPartnerId}
                    onChange={setContactName}
                    onSelect={(partner) => {
                      setSelectedPartnerId(partner?.id ?? "");
                      if (partner) {
                        setCompanyName(partner.companyName);
                      }
                    }}
                  />
                </Field>
                {contactName.trim() && !selectedPartner ? (
                  <div key={contactName} className="grid gap-3 rounded-md border border-white/[0.08] bg-white/[0.025] p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="New person first name">
                        <input name="partnerFirstName" defaultValue={pendingPersonName.firstName} className={inputClass()} />
                      </Field>
                      <Field label="New person last name">
                        <input name="partnerLastName" defaultValue={pendingPersonName.lastName} className={inputClass()} />
                      </Field>
                    </div>
                    <Field label="Title">
                      <input name="partnerRole" placeholder="Recruiter, Founder, Engineering Manager" className={inputClass()} />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Email">
                        <input name="partnerEmail" type="email" placeholder="email@company.com" className={inputClass()} />
                      </Field>
                      <Field label="LinkedIn">
                        <input name="partnerLinkedin" placeholder="https://linkedin.com/in/..." className={inputClass()} />
                      </Field>
                    </div>
                    <p className="text-[12px] text-zinc-500">New person needs email or LinkedIn.</p>
                  </div>
                ) : null}
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  <Field label="Channel">
                    <select name="type" defaultValue="meeting" className={inputClass()}>
                      {touchpointTypes.map((type) => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Direction">
                    <select name="direction" defaultValue="outbound" className={inputClass()}>
                      <option value="outbound">Outbound</option>
                      <option value="inbound">Inbound</option>
                    </select>
                  </Field>
                </div>
                <Field label="BizTech Director">
                  <select name="userId" required className={inputClass()}>
                    <option value="">Select BizTech Director</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                  </select>
                </Field>
                <div className="grid gap-3 rounded-md border border-white/[0.08] bg-white/[0.025] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-medium text-zinc-300">Event attendance</p>
                    <span className="text-[12px] text-zinc-600">Optional</span>
                  </div>
                  <Field label="Event">
                    <EventCombo events={events} value={eventName} onChange={setEventName} />
                  </Field>
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    <Field label="Role">
                      <select name="eventRole" defaultValue="judge" disabled={!eventName.trim()} className={inputClass()}>
                        {eventRoles.map((role) => (
                          <option key={role.value} value={role.value}>{role.label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Status">
                      <select name="eventStatus" defaultValue="asked" disabled={!eventName.trim()} className={inputClass()}>
                        {eventStatuses.map((status) => (
                          <option key={status.value} value={status.value}>{status.label}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>
                <Field label="Notes">
                  <textarea name="notes" rows={5} className={inputClass("h-auto py-2")} />
                </Field>
                {error ? <p className="rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2 text-[13px] text-red-200">{error}</p> : null}
              </div>
              <div className="shrink-0 border-t border-white/[0.08] bg-[#0d0e11] px-5 py-4">
                <button disabled={isPending} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-zinc-700 px-4 text-[13px] font-medium text-white transition hover:bg-zinc-600 disabled:opacity-60 cursor-pointer">
                  <MessageSquarePlus className="size-4" strokeWidth={1.8} />
                  Save contact
                </button>
              </div>
            </form>
          ) : selected ? (
            <div className="min-h-0 flex-1 min-w-0 overflow-x-hidden overflow-y-auto px-5 py-5">
              <div className="grid gap-4">
                <section className="min-w-0 overflow-hidden rounded-md border border-white/[0.09] bg-[#0d0e11] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium text-zinc-100">{selected.title}</p>
                      <p className="mt-1 truncate text-[12px] text-zinc-500">
                        {[selected.typeLabel, formatDateTime(selected.dateIso)].join(" · ")}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 text-[13px]">
                    <div>
                      <p className="text-[12px] text-zinc-500">Company</p>
                      <p className="mt-1 text-zinc-300">{selected.companyNames.join(", ") || "No company"}</p>
                    </div>
                    <div>
                      <p className="text-[12px] text-zinc-500">Contacted person</p>
                      <p className="mt-1 text-zinc-300">{selected.partnerNames.join(", ") || "Company-level contact"}</p>
                    </div>
                    <div>
                      <p className="text-[12px] text-zinc-500">BizTech Director</p>
                      <p className="mt-1 text-zinc-300">{selected.userNames.join(", ") || "No BizTech Director"}</p>
                    </div>
                    {selected.followUpDate ? (
                      <div>
                        <p className="text-[12px] text-zinc-500">Next outreach</p>
                        <p className="mt-1 text-zinc-300">{selected.followUpDate}</p>
                      </div>
                    ) : null}
                  </div>
                </section>

                {selected.notes ? (
                  <section className="min-w-0 overflow-hidden rounded-md border border-white/[0.09] bg-[#0d0e11] p-4">
                    <p className="text-[13px] font-medium text-zinc-200">Notes</p>
                    <p className="mt-3 whitespace-pre-wrap text-[13px] leading-5 text-zinc-400">{selected.notes}</p>
                  </section>
                ) : null}

                {selected.kind === "touchpoint" && selected.touchpoint ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      if (!window.confirm("Remove this contact record?")) return;
                      startTransition(async () => {
                        await deleteCompanyInteractionAction(selected.touchpoint!.id);
                        setMode("closed");
                        setSelectedKey(null);
                        resetActivityUrl();
                        router.refresh();
                      });
                    }}
                    className="inline-flex h-9 w-fit items-center gap-1.5 rounded-md border border-red-400/20 px-3 text-[13px] font-medium text-red-200 transition hover:bg-red-400/10 disabled:opacity-60 cursor-pointer"
                  >
                    <Trash2 className="size-4" strokeWidth={1.8} />
                    Remove contact record
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
