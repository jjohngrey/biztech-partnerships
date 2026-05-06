"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, MessageSquarePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  addCompanyEventRoleAction,
  addPartnerEventRoleAction,
  createCompanyInteractionAction,
  createCompanyAction,
  createContactAction,
  createContactWithEventAction,
  createPartnerDocumentAction,
  deleteCompanyInteractionAction,
  deletePartnerDocumentAction,
  linkContactToCompanyAction,
  removeCompanyEventRoleAction,
  removePartnerEventRoleAction,
  updateCompanyEventStatusAction,
  updateCompanyAction,
  updateContactAction,
  updatePartnerEventStatusAction,
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
  PartnerEventAttendance,
} from "@/lib/partnerships/types";

type CompaniesPageProps = {
  companies: CompanyDirectoryRecord[];
  events: CrmEventSummary[];
  users: CrmUserSummary[];
  partners: PartnerDirectoryRecord[];
  meetings: MeetingLogRecord[];
  initialCompanyId?: string;
};

type PartnersPageProps = {
  partners: PartnerDirectoryRecord[];
  companies: CompanyDirectoryRecord[];
  events: CrmEventSummary[];
  users: CrmUserSummary[];
  initialPartnerId?: string;
};

type PanelMode = "closed" | "create" | "view" | "edit";
type SortDirection = "asc" | "desc";
type PartnerSortKey = "name" | "company" | "role" | "events";
type CompanySortKey = "name" | "partners" | "events";
type CompanyKind = "sponsors" | "in_kind";

const IN_KIND_TAG = "in-kind";

function isInKind(company: Pick<CompanyDirectoryRecord, "tags">) {
  return company.tags.includes(IN_KIND_TAG);
}

function withInKindTag(existing: string[], inKind: boolean) {
  const without = existing.filter((tag) => tag !== IN_KIND_TAG);
  return inKind ? [...without, IN_KIND_TAG] : without;
}

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

function eventRoleLabel(value: EventRole) {
  return eventRoles.find((role) => role.value === value)?.label ?? value;
}

function eventStatusLabel(value: EventAttendanceStatus) {
  return eventStatuses.find((status) => status.value === value)?.label ?? value;
}

function eventSummary(items: PartnerEventAttendance[]) {
  if (!items.length) return "No events";
  return items
    .map((item) => `${item.eventName} (${eventRoleLabel(item.eventRole)} · ${eventStatusLabel(item.eventStatus)})`)
    .join(", ");
}

function dollars(cents: number | null) {
  if (!cents) return "$0";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function titleStatus(status: string | null) {
  if (!status) return "No sponsorship";
  return status
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

function contactLine(partner: Pick<PartnerDirectoryRecord, "email" | "linkedin">) {
  if (partner.email) return partner.email;
  if (partner.linkedin) return "LinkedIn available";
  return "No contact info";
}

function companyWebLine(company: Pick<CompanyDirectoryRecord, "website" | "linkedin">) {
  if (company.website) return company.website;
  if (company.linkedin) return "LinkedIn available";
  return "No website";
}

function contactLogCreateHref({
  companyName,
  contactName,
  eventName,
}: {
  companyName?: string | null;
  contactName?: string | null;
  eventName?: string | null;
}) {
  const params = new URLSearchParams({ create: "1" });
  if (companyName) params.set("company", companyName);
  if (contactName) params.set("contact", contactName);
  if (eventName) params.set("event", eventName);
  return `/contact-log?${params.toString()}`;
}

function contactHistoryActivityHref(kind: "meeting" | "touchpoint", id: string) {
  return `/contact-log?activity=${encodeURIComponent(`${kind}:${id}`)}`;
}

function setPartnerUrl(partnerId: string) {
  window.history.replaceState(null, "", `/partners?partnerId=${partnerId}`);
}

function resetPartnerUrl() {
  window.history.replaceState(null, "", "/partners");
}

function setCompanyUrl(companyId: string) {
  window.history.replaceState(null, "", `/companies?companyId=${companyId}`);
}

function resetCompanyUrl() {
  window.history.replaceState(null, "", "/companies");
}

function formHasContactInfo(data: FormData) {
  return Boolean(String(data.get("email") ?? "").trim() || String(data.get("linkedin") ?? "").trim());
}

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "BT"
  );
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

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sizeClass =
    size === "lg" ? "size-10 text-base" : size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs";
  return (
    <div
      className={`${sizeClass} grid shrink-0 place-items-center rounded-full border border-white/[0.08] bg-zinc-700/80 font-semibold text-zinc-100`}
    >
      {initials(name)}
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="grid min-w-0 max-w-full gap-1.5 text-[12px] font-medium text-zinc-400">
      <span>
        {label}
        {required ? <span className="ml-0.5 text-red-400">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function ContactRequirementHint() {
  return <p className="text-[12px] leading-5 text-zinc-500">Email or LinkedIn is required.</p>;
}

function inputClass(extra = "") {
  return [
    "h-9 w-full min-w-0 max-w-full rounded-md border border-white/[0.09] bg-[#0d0e11] px-3 text-[13px] text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-400/70 focus:ring-2 focus:ring-zinc-400/15",
    extra,
  ].join(" ");
}

function compareText(left: string | null | undefined, right: string | null | undefined) {
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, { sensitivity: "base" });
}

function sortValue(result: number, direction: SortDirection) {
  return direction === "asc" ? result : -result;
}

function SortHeader<T extends string>({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: T;
  activeKey: T;
  direction: SortDirection;
  onSort: (key: T) => void;
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

function StatusPill({ status }: { status: string | null }) {
  const label = titleStatus(status);
  const good = ["confirmed", "paid"].includes(String(status));
  const active = ["pitched", "reached_out", "shortlist", "in_conversation", "followed_up"].includes(String(status));
  return (
    <span
      className={[
        "inline-flex h-6 max-w-full items-center rounded-md px-2 text-[12px] font-medium",
        good
          ? "bg-zinc-500/14 text-zinc-200"
          : active
            ? "bg-zinc-500/12 text-zinc-300"
            : "bg-zinc-500/12 text-zinc-300",
      ].join(" ")}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

function CompanyCombo({
  companies,
  value,
  onChange,
  name = "companyName",
}: {
  companies: CompanyDirectoryRecord[];
  value: string;
  onChange: (value: string) => void;
  name?: string;
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
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder="Search companies or create a new one"
        className={inputClass("w-full")}
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
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.05] cursor-pointer"
            >
              <Avatar name={company.name} />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-zinc-100">{company.name}</span>
                <span className="block truncate text-[12px] text-zinc-500">
                  {company.activeContactsCount} linked partners
                </span>
              </span>
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
        <div className="absolute left-0 right-0 top-11 z-30 overflow-hidden rounded-md border border-white/[0.1] bg-[#15161a] shadow-2xl shadow-black/40">
          {filtered.map((event) => (
            <button
              key={event.id}
              type="button"
              onMouseDown={(mouseEvent) => mouseEvent.preventDefault()}
              onClick={() => {
                onChange(event.name);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.05] cursor-pointer"
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

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="grid min-h-[100dvh] place-items-center border-l border-white/[0.08] bg-[#111113]/60 px-8 text-center text-sm text-zinc-500">
      {label}
    </div>
  );
}

function DirectorCheckboxes({
  users,
  selectedIds = [],
}: {
  users: CrmUserSummary[];
  selectedIds?: string[];
}) {
  return (
    <div className="rounded-md border border-white/[0.08] bg-[#101114] p-3">
      <p className="text-[12px] font-medium text-zinc-300">BizTech Directors POC</p>
      <div className="mt-3 grid gap-2">
        {users.map((user) => (
          <label key={user.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-zinc-300 hover:bg-white/[0.04]">
            <input
              name="directorUserIds"
              value={user.id}
              type="checkbox"
              defaultChecked={selectedIds.includes(user.id)}
              className="size-4 accent-zinc-300"
            />
            <span className="min-w-0 truncate">{user.name}</span>
          </label>
        ))}
        {!users.length && <p className="text-[13px] text-zinc-500">No BizTech Directors found.</p>}
      </div>
    </div>
  );
}

export function PartnersDirectory({ partners, companies, events, users, initialPartnerId }: PartnersPageProps) {
  const router = useRouter();
  const initialPartner = partners.find((partner) => partner.id === initialPartnerId) ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(initialPartner?.id ?? null);
  const [mode, setMode] = useState<PanelMode>(initialPartner ? "view" : "closed");
  const [query, setQuery] = useState("");
  const [createCompanyName, setCreateCompanyName] = useState("");
  const [editCompanyName, setEditCompanyName] = useState(initialPartner?.companyName ?? "");
  const [eventName, setEventName] = useState("");
  const [sortKey, setSortKey] = useState<PartnerSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const selected = partners.find((partner) => partner.id === selectedId) ?? null;
  const editCompanyValue = editCompanyName || selected?.companyName || "";

  useEffect(() => {
    const partnerId = new URLSearchParams(window.location.search).get("partnerId");
    const partner = partners.find((item) => item.id === partnerId);
    if (!partner) return;
    setSelectedId(partner.id);
    setMode("view");
    setEditCompanyName(partner.companyName);
  }, [partners]);

  const filteredPartners = useMemo(() => {
    const filtered = partners.filter((partner) => {
      const haystack = [partner.name, partner.email, partner.companyName, partner.role]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    });

    return [...filtered].sort((left, right) => {
      const result =
        sortKey === "company"
          ? compareText(left.companyName, right.companyName)
          : sortKey === "role"
            ? compareText(left.role, right.role)
            : sortKey === "events"
              ? left.eventAttendances.length - right.eventAttendances.length
              : compareText(left.name, right.name);
      return sortValue(result, sortDirection);
    });
  }, [partners, query, sortDirection, sortKey]);

  function sortPartners(key: PartnerSortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  function contactPayload(data: FormData) {
    return {
      firstName: String(data.get("firstName") ?? ""),
      lastName: String(data.get("lastName") ?? ""),
      companyId: String(data.get("companyId") ?? "") || undefined,
      companyName: String(data.get("companyName") ?? ""),
      role: String(data.get("role") ?? ""),
      email: String(data.get("email") ?? ""),
      phone: String(data.get("phone") ?? ""),
      linkedin: String(data.get("linkedin") ?? ""),
      notes: String(data.get("notes") ?? ""),
      isPrimary: data.get("isPrimary") === "on",
      directorUserIds: data.getAll("directorUserIds").map(String),
    };
  }

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const eventId = String(data.get("eventId") ?? "");
    const requestedEvent = String(data.get("eventName") ?? "").trim();
    if (!formHasContactInfo(data)) {
      setError("Add either an email or LinkedIn.");
      return;
    }
    if (requestedEvent && !eventId) {
      setError("Select an existing event or leave the event blank.");
      return;
    }
    startTransition(async () => {
      try {
        const created = await createContactWithEventAction({
          ...contactPayload(data),
          eventId: eventId || undefined,
          eventRole: eventId ? (String(data.get("eventRole")) as EventRole) : undefined,
          eventStatus: eventId ? (String(data.get("eventStatus") ?? "asked") as EventAttendanceStatus) : undefined,
        });
        form.reset();
        setCreateCompanyName("");
        setEventName("");
        setSelectedId(created.id);
        setMode("view");
        setPartnerUrl(created.id);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not create partner.");
      }
    });
  }

  function submitUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError(null);
    const data = new FormData(event.currentTarget);
    if (!formHasContactInfo(data)) {
      setError("Add either an email or LinkedIn.");
      return;
    }
    startTransition(async () => {
      try {
        await updateContactAction({
          ...contactPayload(data),
          id: selected.id,
          archived: data.get("archived") === "on",
        });
        setMode("view");
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not update partner.");
      }
    });
  }

  function submitEventRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError(null);
    const data = new FormData(event.currentTarget);
    const eventId = String(data.get("eventId") ?? "");
    if (!eventId) {
      setError("Select an existing event.");
      return;
    }
    startTransition(async () => {
      await addPartnerEventRoleAction({
        partnerId: selected.id,
        eventId,
        eventRole: String(data.get("eventRole")) as EventRole,
        eventStatus: String(data.get("eventStatus") ?? "asked") as EventAttendanceStatus,
      });
      setEventName("");
      router.refresh();
    });
  }

  const panelOpen = mode !== "closed";
  const partnerGrid = panelOpen
    ? "grid-cols-[minmax(180px,1.1fr)_minmax(120px,0.9fr)]"
    : "grid-cols-1 md:grid-cols-[minmax(180px,1.35fr)_minmax(120px,0.9fr)_minmax(120px,0.9fr)] lg:grid-cols-[minmax(180px,1.35fr)_minmax(120px,0.9fr)_minmax(120px,0.9fr)_minmax(160px,1fr)]";
  const partnerTableMin = "min-w-0";

  return (
    <div className={["grid min-h-[100dvh] w-full max-w-full grid-cols-1 overflow-x-hidden bg-[#0d0d0f] xl:overflow-hidden", panelOpen ? "xl:grid-cols-[minmax(0,1fr)_minmax(400px,480px)]" : ""].join(" ")}>
      <section className={["min-w-0 bg-[#0d0d0f] px-3 py-4 sm:px-5 sm:py-5 xl:overflow-hidden", panelOpen ? "hidden xl:block" : ""].join(" ")}>
        <h2 className="text-[15px] font-medium text-zinc-100">Partners</h2>

        <div className="mt-4 grid max-w-[760px] grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <input
            name="partnerSearch"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={inputClass("min-w-0 flex-1")}
            placeholder="Search partners..."
          />
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode("create");
              setSelectedId(null);
              setCreateCompanyName("");
              setEventName("");
              resetPartnerUrl();
            }}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-zinc-700 px-3.5 text-[13px] font-medium text-white transition hover:bg-zinc-600 md:w-auto cursor-pointer"
          >
            <Plus className="size-4" strokeWidth={1.8} />
            Log person
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-md border border-white/[0.09] bg-[#111113]">
          <div className={`grid ${partnerTableMin} ${partnerGrid} border-b border-white/[0.08] px-4 py-2.5 text-[12px] text-zinc-500`}>
            <span className="pl-[52px]">
              <SortHeader label="Name" sortKey="name" activeKey={sortKey} direction={sortDirection} onSort={sortPartners} />
            </span>
            <span className={panelOpen ? "min-w-0" : "hidden min-w-0 md:block"}>
              <SortHeader label="Company" sortKey="company" activeKey={sortKey} direction={sortDirection} onSort={sortPartners} />
            </span>
            {!panelOpen && <span className="hidden min-w-0 md:block"><SortHeader label="Role" sortKey="role" activeKey={sortKey} direction={sortDirection} onSort={sortPartners} /></span>}
            {!panelOpen && <span className="hidden min-w-0 lg:block"><SortHeader label="Events" sortKey="events" activeKey={sortKey} direction={sortDirection} onSort={sortPartners} /></span>}
          </div>
          <div className="max-h-[62vh] overflow-auto">
            {filteredPartners.map((partner) => {
              const selectedRow = (mode === "view" || mode === "edit") && selected?.id === partner.id;
              return (
                <button
                  key={partner.id}
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode("view");
                    setSelectedId(partner.id);
                    setPartnerUrl(partner.id);
                    setEditCompanyName(partner.companyName);
                    setEventName("");
                  }}
                  className={[
                    `grid ${partnerTableMin} w-full ${partnerGrid} items-center border-b border-white/[0.06] px-4 py-3.5 text-left text-[13px] text-zinc-300 transition hover:bg-white/[0.035] cursor-pointer`,
                    selectedRow ? "bg-white/[0.055]" : "",
                  ].join(" ")}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={partner.name} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-zinc-100">{partner.name}</span>
                      <span className="block truncate text-[12px] text-zinc-500">{contactLine(partner)}</span>
                      {!panelOpen && (
                        <span className="block truncate text-[12px] text-zinc-500 md:hidden">
                          {[partner.companyName, partner.role].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className={panelOpen ? "min-w-0 truncate" : "hidden min-w-0 truncate md:block"}>{partner.companyName}</span>
                  {!panelOpen && <span className="hidden min-w-0 truncate md:block">{partner.role || "Partner"}</span>}
                  {!panelOpen && (
                    <span className="hidden min-w-0 truncate text-zinc-400 lg:block">
                      {eventSummary(partner.eventAttendances)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="border-t border-white/[0.08] px-4 py-4 text-[13px] text-zinc-500">
            {filteredPartners.length} partners
          </div>
        </div>
      </section>

      {panelOpen ? (
        <aside className="flex h-[calc(100dvh-50px)] w-full max-w-[100dvw] min-w-0 flex-col overflow-hidden border-l border-white/[0.08] bg-[#111113] xl:h-[100dvh]">
          <div className="flex h-14 shrink-0 min-w-0 items-center gap-2 border-b border-white/[0.08] px-3 sm:px-5">
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
              <button
                type="button"
                aria-label="Back to partners list"
                onClick={() => {
                  setMode("closed");
                  setEventName("");
                  resetPartnerUrl();
                }}
                className="shrink-0 text-zinc-500 hover:text-white cursor-pointer"
              >
                <ArrowLeft className="size-5" strokeWidth={1.8} />
              </button>
              <h3 className="truncate text-[17px] font-medium text-white">
                {mode === "create" ? "Log person" : mode === "edit" ? `Edit ${selected?.name ?? "person"}` : selected?.name ?? "Partner details"}
              </h3>
              <button
                type="button"
                aria-label="Close partner panel"
                onClick={() => {
                  setMode("closed");
                  setSelectedId(null);
                  setEventName("");
                  resetPartnerUrl();
                }}
                className="grid size-7 shrink-0 place-items-center rounded-md border border-white/[0.12] bg-white/[0.055] text-zinc-300 transition hover:border-red-400/30 hover:bg-red-500/15 hover:text-red-200 xl:hidden cursor-pointer"
              >
                <X className="size-4" strokeWidth={1.8} />
              </button>
            </div>
            {mode === "view" && selected ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode("edit");
                }}
                className="hidden h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-white/[0.09] px-2.5 text-[12px] font-medium text-zinc-300 transition hover:bg-white/[0.055] hover:text-white md:inline-flex cursor-pointer"
              >
                <Pencil className="size-3.5" strokeWidth={1.8} />
                Edit
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Close partner panel"
              onClick={() => {
                setMode("closed");
                setSelectedId(null);
                setEventName("");
                resetPartnerUrl();
              }}
              className="hidden size-8 shrink-0 place-items-center rounded-md border border-white/[0.12] bg-white/[0.055] text-zinc-300 transition hover:border-red-400/30 hover:bg-red-500/15 hover:text-red-200 xl:grid cursor-pointer"
            >
              <X className="size-5" strokeWidth={1.8} />
            </button>
          </div>

          {mode === "create" ? (
            <form id="partner-create-form" onSubmit={submitCreate} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 min-w-0 space-y-4 overflow-x-hidden overflow-y-auto px-5 py-5">
                <div className="grid min-w-0 gap-4">
                  <Field label="New partner first name" required><input name="firstName" required autoComplete="given-name" className={inputClass()} /></Field>
                  <Field label="New partner last name"><input name="lastName" autoComplete="family-name" className={inputClass()} /></Field>
                </div>
                <Field label="Company" required>
                  <CompanyCombo companies={companies} value={createCompanyName} onChange={setCreateCompanyName} />
                </Field>
                <Field label="Title"><input name="role" className={inputClass()} /></Field>
                <Field label="Email" required><input name="email" type="email" autoComplete="email" className={inputClass()} /></Field>
                <Field label="Phone"><input name="phone" autoComplete="tel" className={inputClass()} /></Field>
                <Field label="LinkedIn" required><input name="linkedin" autoComplete="url" className={inputClass()} /></Field>
                <ContactRequirementHint />
                <Field label="Notes"><textarea name="notes" rows={3} className={inputClass("h-auto py-2")} /></Field>
                <label className="flex items-center gap-2 text-[13px] text-zinc-300">
                  <input name="isPrimary" type="checkbox" className="size-4 accent-zinc-400" />
                  Primary contact for company
                </label>
                <DirectorCheckboxes users={users} />
                <div className="min-w-0 max-w-full overflow-hidden rounded-md border border-white/[0.09] bg-[#0d0e11] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-medium text-zinc-200">Log event attendance</p>
                    <span className="shrink-0 text-[12px] text-zinc-500">Optional</span>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <Field label="Event">
                      <EventCombo events={events} value={eventName} onChange={setEventName} />
                    </Field>
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      <Field label="Role">
                        <select name="eventRole" defaultValue="judge" className={inputClass("w-full min-w-0")}>
                          {eventRoles.map((role) => (
                            <option key={role.value} value={role.value}>{role.label}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Status">
                        <select name="eventStatus" defaultValue="asked" className={inputClass("w-full min-w-0")}>
                          {eventStatuses.map((status) => (
                            <option key={status.value} value={status.value}>{status.label}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  </div>
                </div>
                {error && <p className="rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2 text-[13px] text-red-200">{error}</p>}
              </div>
              <div className="shrink-0 border-t border-white/[0.08] bg-[#0d0e11] px-5 py-4">
                <button disabled={isPending} className="h-9 rounded-md bg-zinc-700 px-4 text-[13px] font-medium text-white transition hover:bg-zinc-600 disabled:opacity-60 cursor-pointer">
                  Save person
                </button>
              </div>
            </form>
          ) : mode === "view" && selected ? (
            <div className="min-h-0 flex-1 min-w-0 overflow-x-hidden overflow-y-auto px-5 py-5">
              <div className="grid gap-4">
                <section className="min-w-0 max-w-full overflow-hidden rounded-md border border-white/[0.09] bg-[#0d0e11] p-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={selected.name} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-zinc-100">{selected.name}</p>
                      <p className="mt-0.5 truncate text-[12px] text-zinc-500">
                        {[selected.role, selected.isPrimary ? "Primary contact" : null, selected.archived ? "Archived" : null].filter(Boolean).join(" · ") || "Partner"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-[13px]">
                    {selected.email ? (
                      <a href={`mailto:${selected.email}`} className="inline-flex min-w-0 items-center gap-2 text-zinc-300 transition hover:text-white">
                        <span className="truncate">{selected.email}</span>
                        <ExternalLink className="size-3.5 shrink-0" strokeWidth={1.8} />
                      </a>
                    ) : null}
                    {selected.phone ? <p className="truncate text-zinc-400">{selected.phone}</p> : null}
                    {selected.linkedin ? (
                      <a href={selected.linkedin} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-2 text-zinc-300 transition hover:text-white">
                        <span className="truncate">{selected.linkedin}</span>
                        <ExternalLink className="size-3.5 shrink-0" strokeWidth={1.8} />
                      </a>
                    ) : null}
                    {selected.notes ? <p className="leading-5 text-zinc-400">{selected.notes}</p> : null}
                    {selected.directors.length ? (
                      <p className="truncate text-zinc-500">
                        BizTech Directors POC: {selected.directors.map((director) => director.name).join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <a
                      href={contactLogCreateHref({ companyName: selected.companyName, contactName: selected.name })}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.09] px-2.5 text-[12px] font-medium text-zinc-300 transition hover:bg-white/[0.055] hover:text-white"
                    >
                      <MessageSquarePlus className="size-3.5" strokeWidth={1.8} />
                      Log contact
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setMode("edit");
                      }}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.09] px-2.5 text-[12px] font-medium text-zinc-300 transition hover:bg-white/[0.055] hover:text-white cursor-pointer"
                    >
                      <Pencil className="size-3.5" strokeWidth={1.8} />
                      Edit person
                    </button>
                  </div>
                </section>

                <section className="min-w-0 max-w-full overflow-hidden rounded-md border border-white/[0.09] bg-[#101114] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-medium text-zinc-200">Linked company</p>
                    <a href={`/companies?companyId=${selected.companyId}`} className="shrink-0 rounded-md border border-white/[0.09] px-2 py-1 text-[11px] text-zinc-400 transition hover:bg-white/[0.055] hover:text-white">
                      Open
                    </a>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <Avatar name={selected.companyName} size="lg" />
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium text-white">{selected.companyName}</p>
                      <p className="truncate text-[12px] text-zinc-500">Company profile</p>
                    </div>
                  </div>
                </section>

                <section className="min-w-0 max-w-full overflow-hidden rounded-md border border-white/[0.09] bg-[#0d0e11] p-4">
                  <div className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[13px] font-medium text-zinc-200">Log event attendance</p>
                    <p className="text-[12px] text-zinc-500">{selected.eventAttendances.length} linked</p>
                  </div>
                  <form onSubmit={submitEventRole} className="mt-4 grid gap-3">
                    <Field label="Event">
                      <EventCombo events={events} value={eventName} onChange={setEventName} />
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
                      className="h-9 w-fit rounded-md bg-zinc-700 px-4 text-[13px] font-medium text-white transition hover:bg-zinc-600 disabled:opacity-60 cursor-pointer">
                      Add attendance
                    </button>
                  </form>
                  <div className="mt-4 space-y-2">
                    {selected.eventAttendances.length ? (
                      selected.eventAttendances.map((attendance) => (
                        <div key={`${attendance.eventId}-${attendance.eventRole}`} className="grid gap-2 rounded-md bg-white/[0.035] px-3 py-2 text-[13px] sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-center">
                          <span className="min-w-0">
                            <span className="block truncate text-zinc-200">{attendance.eventName}</span>
                            <span className="block truncate text-[12px] text-zinc-500">{eventRoleLabel(attendance.eventRole)}</span>
                          </span>
                          <select
                            value={attendance.eventStatus}
                            disabled={isPending}
                            onChange={(event) => {
                              const eventStatus = event.currentTarget.value as EventAttendanceStatus;
                              startTransition(async () => {
                                await updatePartnerEventStatusAction({
                                  partnerId: selected.id,
                                  eventId: attendance.eventId,
                                  eventRole: attendance.eventRole,
                                  eventStatus,
                                });
                                router.refresh();
                              });
                            }}
                            aria-label={`${attendance.eventName} ${eventRoleLabel(attendance.eventRole)} status`}
                            className={inputClass("h-8 px-2 text-[12px]")}
                          >
                            {eventStatuses.map((status) => (
                              <option key={status.value} value={status.value}>{status.label}</option>
                            ))}
                          </select>
                          <span className="inline-flex shrink-0 items-center gap-1">
                            <a href={`/events?eventId=${attendance.eventId}`} className="grid size-8 place-items-center rounded-md text-zinc-500 transition hover:bg-white/[0.055] hover:text-white" aria-label={`Open ${attendance.eventName}`}>
                              <ExternalLink className="size-4" strokeWidth={1.8} />
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                if (!window.confirm("Remove this event attendance?")) return;
                                startTransition(async () => {
                                  await removePartnerEventRoleAction({
                                    partnerId: selected.id,
                                    eventId: attendance.eventId,
                                    eventRole: attendance.eventRole,
                                  });
                                  router.refresh();
                                });
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
                      <p className="text-[13px] text-zinc-500">No event attendance linked yet.</p>
                    )}
                  </div>
                </section>
                {error && <p className="rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2 text-[13px] text-red-200">{error}</p>}
              </div>
            </div>
          ) : selected ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 min-w-0 overflow-x-hidden overflow-y-auto px-5 py-5">
                <form id="partner-edit-form" onSubmit={submitUpdate} className="space-y-4">
                  <div className="grid min-w-0 gap-4">
                    <Field label="First name"><input name="firstName" required defaultValue={selected.firstName} autoComplete="given-name" className={inputClass()} /></Field>
                    <Field label="Last name"><input name="lastName" defaultValue={selected.lastName ?? ""} autoComplete="family-name" className={inputClass()} /></Field>
                  </div>
                  <Field label="Company">
                    <CompanyCombo companies={companies} value={editCompanyValue} onChange={setEditCompanyName} />
                  </Field>
                  <Field label="Title"><input name="role" defaultValue={selected.role ?? ""} className={inputClass()} /></Field>
                  <Field label="Email"><input name="email" type="email" defaultValue={selected.email ?? ""} autoComplete="email" className={inputClass()} /></Field>
                  <Field label="Phone"><input name="phone" defaultValue={selected.phone ?? ""} autoComplete="tel" className={inputClass()} /></Field>
                  <Field label="LinkedIn"><input name="linkedin" defaultValue={selected.linkedin ?? ""} autoComplete="url" className={inputClass()} /></Field>
                  <ContactRequirementHint />
                  <Field label="Notes"><textarea name="notes" rows={3} defaultValue={selected.notes ?? ""} className={inputClass("h-auto py-2")} /></Field>
                  <div className="flex flex-wrap gap-5">
                    <label className="flex items-center gap-2 text-[13px] text-zinc-300">
                      <input name="isPrimary" type="checkbox" defaultChecked={selected.isPrimary} className="size-4 accent-zinc-400" />
                      Primary contact
                    </label>
                    <label className="flex items-center gap-2 text-[13px] text-zinc-300">
                      <input name="archived" type="checkbox" defaultChecked={selected.archived} className="size-4 accent-zinc-400" />
                      Archived
                    </label>
                  </div>
                  <DirectorCheckboxes users={users} selectedIds={selected.directors.map((director) => director.id)} />
                </form>

                <div className="mt-6 min-w-0 max-w-full overflow-hidden rounded-md border border-white/[0.09] bg-[#101114] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[12px] text-zinc-500">Linked company</p>
                    <a href={`/companies?companyId=${selected.companyId}`} className="shrink-0 rounded-md border border-white/[0.09] px-2 py-1 text-[11px] text-zinc-400 transition hover:bg-white/[0.055] hover:text-white">
                      Open
                    </a>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <Avatar name={selected.companyName} size="lg" />
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium text-white">{selected.companyName}</p>
                      <p className="truncate text-[12px] text-zinc-500">Linked company</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 min-w-0 max-w-full overflow-hidden rounded-md border border-white/[0.09] bg-[#0d0e11] p-4">
                  <p className="text-[13px] font-medium text-zinc-200">Event attendance</p>
                  <form onSubmit={submitEventRole} className="mt-4 grid gap-3">
                    <div className="grid gap-3">
                      <Field label="Event">
                        <EventCombo events={events} value={eventName} onChange={setEventName} />
                      </Field>
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
                      className="h-9 w-fit rounded-md bg-zinc-700 px-4 text-[13px] font-medium text-white transition hover:bg-zinc-600 disabled:opacity-60 cursor-pointer">
                      Add attendance
                    </button>
                  </form>
                  <div className="mt-4 space-y-2">
                    {selected.eventAttendances.length ? (
                      selected.eventAttendances.map((attendance) => (
                        <div key={`${attendance.eventId}-${attendance.eventRole}`} className="grid grid-cols-[minmax(0,1fr)_140px_auto] items-center gap-3 rounded-md bg-white/[0.035] px-3 py-2 text-[13px]">
                          <span className="min-w-0 truncate text-zinc-200">
                            {attendance.eventName} · {eventRoleLabel(attendance.eventRole)}
                          </span>
                          <select
                            value={attendance.eventStatus}
                            disabled={isPending}
                            onChange={(event) => {
                              const eventStatus = event.currentTarget.value as EventAttendanceStatus;
                              startTransition(async () => {
                                await updatePartnerEventStatusAction({
                                  partnerId: selected.id,
                                  eventId: attendance.eventId,
                                  eventRole: attendance.eventRole,
                                  eventStatus,
                                });
                                router.refresh();
                              });
                            }}
                            aria-label={`${attendance.eventName} ${eventRoleLabel(attendance.eventRole)} status`}
                            className={inputClass("h-8 px-2 text-[12px]")}
                          >
                            {eventStatuses.map((status) => (
                              <option key={status.value} value={status.value}>{status.label}</option>
                            ))}
                          </select>
                          <span className="inline-flex shrink-0 items-center gap-1">
                            <a href={`/events?eventId=${attendance.eventId}`} className="grid size-8 place-items-center rounded-md text-zinc-500 transition hover:bg-white/[0.055] hover:text-white" aria-label={`Open ${attendance.eventName}`}>
                              <ExternalLink className="size-4" strokeWidth={1.8} />
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                if (!window.confirm("Remove this event attendance?")) return;
                                startTransition(async () => {
                                  await removePartnerEventRoleAction({
                                    partnerId: selected.id,
                                    eventId: attendance.eventId,
                                    eventRole: attendance.eventRole,
                                  });
                                  router.refresh();
                                });
                              }}
                              aria-label={`Remove ${attendance.eventName} ${eventRoleLabel(attendance.eventRole)} role`}
                              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition hover:bg-red-500/10 hover:text-red-200 cursor-pointer"
                            >
                              <Trash2 className="size-4" strokeWidth={1.8} />
                            </button>
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[13px] text-zinc-500">No event attendance linked yet.</p>
                    )}
                  </div>
                </div>
                {error && <p className="mt-4 rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2 text-[13px] text-red-200">{error}</p>}
              </div>
              <div className="shrink-0 border-t border-white/[0.08] bg-[#0d0e11] px-5 py-4">
                <button form="partner-edit-form" disabled={isPending} className="h-9 rounded-md bg-zinc-700 px-4 text-[13px] font-medium text-white transition hover:bg-zinc-600 disabled:opacity-60 cursor-pointer">
                  Save changes
                </button>
              </div>
            </div>
          ) : (
            <EmptyPanel label="Select a partner to edit." />
          )}
        </aside>
      ) : null}
    </div>
  );
}

export function CompaniesDirectory({ companies, events, users, partners, meetings, initialCompanyId }: CompaniesPageProps) {
  const router = useRouter();
  const initialCompany = companies.find((company) => company.id === initialCompanyId) ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(initialCompany?.id ?? null);
  const [mode, setMode] = useState<PanelMode>(initialCompany ? "view" : "closed");
  const [query, setQuery] = useState("");
  const [eventName, setEventName] = useState("");
  const [touchpointEventName, setTouchpointEventName] = useState("");
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showTouchpointForm, setShowTouchpointForm] = useState(false);
  const [existingPartnerId, setExistingPartnerId] = useState("");
  const [sortKey, setSortKey] = useState<CompanySortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [kind, setKind] = useState<CompanyKind>("sponsors");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const selected = companies.find((company) => company.id === selectedId) ?? null;

  const sponsorCount = useMemo(() => companies.filter((company) => !isInKind(company)).length, [companies]);
  const inKindCount = useMemo(() => companies.filter(isInKind).length, [companies]);

  useEffect(() => {
    const companyId = new URLSearchParams(window.location.search).get("companyId");
    const company = companies.find((item) => item.id === companyId);
    if (!company) return;
    setSelectedId(company.id);
    setMode("view");
    setKind(isInKind(company) ? "in_kind" : "sponsors");
  }, [companies]);
  const linkablePartners = selected
    ? partners.filter((partner) => partner.companyId !== selected.id && !partner.archived)
    : [];
  const selectedMeetings = useMemo(() => {
    if (!selected) return [];
    const contactIds = new Set(selected.contacts.map((contact) => contact.id));
    return meetings.filter((meeting) =>
      meeting.companies.some((company) => company.id === selected.id) ||
      meeting.partners.some((partner) => contactIds.has(partner.id)),
    );
  }, [meetings, selected]);

  const filteredCompanies = useMemo(() => {
    const filtered = companies.filter((company) => {
      if (kind === "in_kind" ? !isInKind(company) : isInKind(company)) return false;
      const haystack = [company.name, company.website, company.linkedin]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    });

    return [...filtered].sort((left, right) => {
      const result =
        sortKey === "partners"
            ? left.activeContactsCount - right.activeContactsCount
            : sortKey === "events"
              ? left.eventAttendances.length - right.eventAttendances.length
              : compareText(left.name, right.name);
      return sortValue(result, sortDirection);
    });
  }, [companies, kind, query, sortDirection, sortKey]);

  function sortCompanies(key: CompanySortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const inKind = data.get("isInKind") === "on";
    startTransition(async () => {
      try {
        const company = await createCompanyAction({
          name: String(data.get("name") ?? ""),
          website: String(data.get("website") ?? ""),
          linkedin: String(data.get("linkedin") ?? ""),
          notes: String(data.get("notes") ?? ""),
          isAlumni: data.get("isAlumni") === "on",
          tags: inKind ? [IN_KIND_TAG] : [],
        });
        form.reset();
        setSelectedId(company.id);
        setMode("view");
        setKind(inKind ? "in_kind" : "sponsors");
        setCompanyUrl(company.id);
        setShowPartnerForm(false);
        setShowEventForm(false);
        setShowTouchpointForm(false);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not create company.");
      }
    });
  }

  function submitUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError(null);
    const data = new FormData(event.currentTarget);
    const inKind = data.get("isInKind") === "on";
    startTransition(async () => {
      try {
        await updateCompanyAction({
          id: selected.id,
          name: String(data.get("name") ?? ""),
          website: String(data.get("website") ?? ""),
          linkedin: String(data.get("linkedin") ?? ""),
          notes: String(data.get("notes") ?? ""),
          isAlumni: data.get("isAlumni") === "on",
          archived: data.get("archived") === "on",
          tags: withInKindTag(selected.tags, inKind),
        });
        setMode("view");
        setKind(inKind ? "in_kind" : "sponsors");
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not update company.");
      }
    });
  }

  function submitCompanyEventRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError(null);
    const data = new FormData(event.currentTarget);
    const eventId = String(data.get("eventId") ?? "");
    if (!eventId) {
      setError("Select an existing event.");
      return;
    }
    startTransition(async () => {
      await addCompanyEventRoleAction({
        companyId: selected.id,
        eventId,
        eventRole: String(data.get("eventRole")) as EventRole,
        eventStatus: String(data.get("eventStatus") ?? "asked") as EventAttendanceStatus,
      });
      setEventName("");
      router.refresh();
    });
  }

  function submitCompanyDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      try {
        await createPartnerDocumentAction({
          companyId: selected.id,
          partnerId: String(data.get("partnerId") ?? "") || undefined,
          eventId: String(data.get("eventId") ?? "") || undefined,
          title: String(data.get("title") ?? ""),
          type: String(data.get("type") ?? ""),
          status: String(data.get("status") ?? ""),
          url: String(data.get("url") ?? ""),
          fileName: String(data.get("fileName") ?? ""),
          notes: String(data.get("notes") ?? ""),
        });
        form.reset();
        setShowTouchpointForm(false);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not add document.");
      }
    });
  }

  function submitCompanyCommunication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const partnerId = String(data.get("partnerId") ?? "") || undefined;
    const eventId = String(data.get("eventId") ?? "") || undefined;
    if (touchpointEventName.trim() && !eventId) {
      setError("Select an existing event.");
      return;
    }
    if (eventId && !partnerId) {
      setError("Event attendance needs a contacted person.");
      return;
    }
    startTransition(async () => {
      try {
        await createCompanyInteractionAction({
          companyId: selected.id,
          contacts: partnerId ? [{ partnerId }] : [],
          userId: String(data.get("userId") ?? ""),
          type: String(data.get("type") ?? "meeting") as CompanyInteractionRecord["type"],
          direction: (String(data.get("direction") ?? "") || undefined) as CompanyInteractionRecord["direction"] | undefined,
          subject: String(data.get("subject") ?? ""),
          notes: String(data.get("notes") ?? ""),
          contactedAt: String(data.get("contactedAt") ?? ""),
          followUpDate: String(data.get("followUpDate") ?? "") || undefined,
        });
        if (eventId && partnerId) {
          await addPartnerEventRoleAction({
            partnerId,
            eventId,
            eventRole: String(data.get("eventRole") ?? "judge") as EventRole,
            eventStatus: String(data.get("eventStatus") ?? "asked") as EventAttendanceStatus,
          });
        }
        form.reset();
        setTouchpointEventName("");
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not log contact.");
      }
    });
  }

  function submitCompanyPartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    if (!formHasContactInfo(data)) {
      setError("Add either an email or LinkedIn.");
      return;
    }
    startTransition(async () => {
      try {
        await createContactAction({
          firstName: String(data.get("firstName") ?? ""),
          lastName: String(data.get("lastName") ?? ""),
          companyId: selected.id,
          role: String(data.get("role") ?? ""),
          email: String(data.get("email") ?? ""),
          linkedin: String(data.get("linkedin") ?? ""),
          phone: String(data.get("phone") ?? ""),
          notes: String(data.get("notes") ?? ""),
          isPrimary: data.get("isPrimary") === "on",
          directorUserIds: data.getAll("directorUserIds").map(String),
        });
        form.reset();
        setShowPartnerForm(false);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not link partner.");
      }
    });
  }

  function submitExistingPartnerLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const partnerId = String(data.get("partnerId") ?? "");
    if (!partnerId) {
      setError("Select a partner to link.");
      return;
    }
    startTransition(async () => {
      try {
        await linkContactToCompanyAction({
          partnerId,
          companyId: selected.id,
        });
        form.reset();
        setExistingPartnerId("");
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not link partner.");
      }
    });
  }

  const panelOpen = mode !== "closed";
  const companyGrid = panelOpen
    ? "grid-cols-[minmax(150px,1fr)_96px]"
    : "grid-cols-1 md:grid-cols-[minmax(180px,1fr)_128px] xl:grid-cols-[minmax(180px,1.4fr)_110px_minmax(160px,1fr)]";
  const companyTableMin = "min-w-0";

  return (
    <div className={["grid min-h-[100dvh] w-full max-w-full grid-cols-1 overflow-x-hidden bg-[#0d0d0f] xl:overflow-hidden", panelOpen ? "xl:grid-cols-[minmax(0,1fr)_minmax(400px,480px)]" : ""].join(" ")}>
      <section className={["min-w-0 bg-[#0d0d0f] px-3 py-4 sm:px-5 sm:py-5 xl:overflow-hidden", panelOpen ? "hidden xl:block" : ""].join(" ")}>
        <h2 className="text-[15px] font-medium text-zinc-100">Companies</h2>

        <div className="mt-4 inline-flex rounded-md border border-white/[0.09] bg-[#111113] p-0.5 text-[13px]">
          {([
            { value: "sponsors" as const, label: "Sponsors", count: sponsorCount },
            { value: "in_kind" as const, label: "In-kind", count: inKindCount },
          ]).map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setKind(tab.value)}
              className={[
                "h-7 rounded px-3 transition cursor-pointer",
                kind === tab.value
                  ? "bg-white/[0.08] text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200",
              ].join(" ")}
            >
              <span>{tab.label}</span>
              <span className="ml-1.5 text-[12px] text-zinc-500">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 grid max-w-[760px] grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <input
            name="companySearch"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={inputClass("min-w-0 flex-1")}
            placeholder="Search companies..."
          />
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode("create");
              setSelectedId(null);
              setShowPartnerForm(false);
              setShowEventForm(false);
              setShowTouchpointForm(false);
              setExistingPartnerId("");
              resetCompanyUrl();
            }}
            className="inline-flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-md bg-zinc-700 px-3.5 text-[13px] font-medium text-white transition hover:bg-zinc-600 md:w-auto cursor-pointer"
          >
            <Plus className="size-4" strokeWidth={1.8} />
            New company
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-md border border-white/[0.09] bg-[#111113]">
          <div className={`grid ${companyTableMin} ${companyGrid} border-b border-white/[0.08] px-4 py-2.5 text-[12px] text-zinc-500`}>
            <span className="pl-[52px]">
              <SortHeader label="Name" sortKey="name" activeKey={sortKey} direction={sortDirection} onSort={sortCompanies} />
            </span>
            <span className={panelOpen ? "min-w-0 justify-self-start" : "hidden min-w-0 justify-self-start md:block"}>
              {panelOpen ? (
                <SortHeader label="Partners" sortKey="partners" activeKey={sortKey} direction={sortDirection} onSort={sortCompanies} />
              ) : (
                <SortHeader label="Partners" sortKey="partners" activeKey={sortKey} direction={sortDirection} onSort={sortCompanies} />
              )}
            </span>
            {!panelOpen && <span className="hidden min-w-0 xl:block"><SortHeader label="Events" sortKey="events" activeKey={sortKey} direction={sortDirection} onSort={sortCompanies} /></span>}
          </div>
          <div className="max-h-[62vh] overflow-auto">
            {filteredCompanies.map((company) => {
              const selectedRow = (mode === "view" || mode === "edit") && selected?.id === company.id;
              return (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode("view");
                    setSelectedId(company.id);
                    setCompanyUrl(company.id);
                    setShowPartnerForm(false);
                    setShowEventForm(false);
                    setShowTouchpointForm(false);
                    setExistingPartnerId("");
                  }}
                  className={[
                    `grid ${companyTableMin} w-full ${companyGrid} items-center border-b border-white/[0.06] px-4 py-3.5 text-left text-[13px] text-zinc-300 transition hover:bg-white/[0.035] cursor-pointer`,
                    selectedRow ? "bg-white/[0.055]" : "",
                  ].join(" ")}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={company.name} />
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium text-zinc-100">{company.name}</span>
                        {isInKind(company) ? (
                          <span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-200">
                            In-kind
                          </span>
                        ) : null}
                      </span>
                      <span className="block truncate text-[12px] text-zinc-500">{companyWebLine(company)}</span>
                      {!panelOpen && (
                        <span className="block truncate text-[12px] text-zinc-500 md:hidden">
                          {company.activeContactsCount} partners
                        </span>
                      )}
                    </span>
                  </span>
                  <span className={panelOpen ? "min-w-0 text-left" : "hidden min-w-0 text-left md:block"}>{company.activeContactsCount}</span>
                  {!panelOpen && (
                    <span className="hidden min-w-0 truncate text-zinc-400 xl:block">
                      {eventSummary(company.eventAttendances)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="border-t border-white/[0.08] px-4 py-4 text-[13px] text-zinc-500">
            {filteredCompanies.length} {kind === "in_kind" ? "in-kind companies" : "companies"}
          </div>
        </div>
      </section>

      {panelOpen ? (
        <aside className="flex h-[calc(100dvh-50px)] w-full max-w-[100dvw] min-w-0 flex-col overflow-hidden border-l border-white/[0.08] bg-[#111113] xl:h-[100dvh]">
          <div className="flex h-14 shrink-0 min-w-0 items-center gap-2 border-b border-white/[0.08] px-3 sm:px-5">
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
              <button
                type="button"
                aria-label="Back to companies list"
                onClick={() => {
                  setMode("closed");
                  setShowTouchpointForm(false);
                  resetCompanyUrl();
                }}
                className="shrink-0 text-zinc-500 hover:text-white cursor-pointer"
              >
                <ArrowLeft className="size-5" strokeWidth={1.8} />
              </button>
              <h3 className="truncate text-[17px] font-medium text-white">
                {mode === "create" ? "New company" : mode === "edit" ? `Edit ${selected?.name ?? "company"}` : selected?.name ?? "Company"}
              </h3>
              <button
                type="button"
                aria-label="Close company panel"
                onClick={() => {
                  setMode("closed");
                  setSelectedId(null);
                  setShowPartnerForm(false);
                  setShowEventForm(false);
                  setShowTouchpointForm(false);
                  resetCompanyUrl();
                }}
                className="grid size-7 shrink-0 place-items-center rounded-md border border-white/[0.12] bg-white/[0.055] text-zinc-300 transition hover:border-red-400/30 hover:bg-red-500/15 hover:text-red-200 xl:hidden cursor-pointer"
              >
                <X className="size-4" strokeWidth={1.8} />
              </button>
            </div>
            {mode === "view" && selected ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode("edit");
                }}
                className="hidden h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-white/[0.09] px-2.5 text-[12px] font-medium text-zinc-300 transition hover:bg-white/[0.055] hover:text-white md:inline-flex cursor-pointer"
              >
                <Pencil className="size-3.5" strokeWidth={1.8} />
                Edit
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Close company panel"
              onClick={() => {
                setMode("closed");
                setSelectedId(null);
                setShowPartnerForm(false);
                setShowEventForm(false);
                setShowTouchpointForm(false);
                resetCompanyUrl();
              }}
              className="hidden size-8 shrink-0 place-items-center rounded-md border border-white/[0.12] bg-white/[0.055] text-zinc-300 transition hover:border-red-400/30 hover:bg-red-500/15 hover:text-red-200 xl:grid cursor-pointer"
            >
              <X className="size-5" strokeWidth={1.8} />
            </button>
          </div>

          {mode === "create" ? (
            <form id="company-create-form" onSubmit={submitCreate} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 min-w-0 space-y-4 overflow-x-hidden overflow-y-auto px-5 py-5">
                <Field label="Company name"><input name="name" required className={inputClass()} /></Field>
                <Field label="Website"><input name="website" className={inputClass()} /></Field>
                <Field label="LinkedIn"><input name="linkedin" className={inputClass()} /></Field>
                <Field label="Notes"><textarea name="notes" rows={3} className={inputClass("h-auto py-2")} /></Field>
                <div className="flex flex-wrap gap-5">
                  <label className="flex items-center gap-2 text-[13px] text-zinc-300">
                    <input name="isAlumni" type="checkbox" className="size-4 accent-zinc-400" />
                    Alumni-led
                  </label>
                  <label className="flex items-center gap-2 text-[13px] text-zinc-300">
                    <input name="isInKind" type="checkbox" defaultChecked={kind === "in_kind"} className="size-4 accent-zinc-400" />
                    In-kind sponsor
                  </label>
                </div>
                {error && <p className="rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2 text-[13px] text-red-200">{error}</p>}
              </div>
              <div className="shrink-0 border-t border-white/[0.08] bg-[#0d0e11] px-5 py-4">
                <button disabled={isPending} className="h-9 rounded-md bg-zinc-700 px-4 text-[13px] font-medium text-white transition hover:bg-zinc-600 disabled:opacity-60 cursor-pointer">
                  Create company
                </button>
              </div>
            </form>
          ) : mode === "view" && selected ? (
            <div className="min-h-0 flex-1 min-w-0 overflow-x-hidden overflow-y-auto px-5 py-5">
              <div className="grid gap-4">
                <section className="min-w-0 max-w-full overflow-hidden rounded-md border border-white/[0.09] bg-[#0d0e11] p-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={selected.name} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-[15px] font-medium text-zinc-100">{selected.name}</p>
                        {isInKind(selected) ? (
                          <span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-200">
                            In-kind
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-[12px] text-zinc-500">
                        {[isInKind(selected) ? "In-kind sponsor" : null, selected.isAlumni ? "Alumni-led" : null, selected.archived ? "Archived" : null].filter(Boolean).join(" · ") || "Company profile"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-[13px]">
                    {selected.website ? (
                      <a href={selected.website} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-2 text-zinc-300 transition hover:text-white">
                        <span className="truncate">{selected.website}</span>
                        <ExternalLink className="size-3.5 shrink-0" strokeWidth={1.8} />
                      </a>
                    ) : null}
                    {selected.linkedin ? (
                      <a href={selected.linkedin} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-2 text-zinc-300 transition hover:text-white">
                        <span className="truncate">{selected.linkedin}</span>
                        <ExternalLink className="size-3.5 shrink-0" strokeWidth={1.8} />
                      </a>
                    ) : null}
                    {selected.notes ? <p className="leading-5 text-zinc-400">{selected.notes}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMode("edit");
                    }}
                    className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.09] px-2.5 text-[12px] font-medium text-zinc-300 transition hover:bg-white/[0.055] hover:text-white cursor-pointer"
                  >
                    <Pencil className="size-3.5" strokeWidth={1.8} />
                    Edit company
                  </button>
                </section>

                <section className="min-w-0 max-w-full overflow-hidden rounded-md border border-white/[0.09] bg-[#0d0e11] p-4">
                  <div className="flex min-w-0 flex-col items-start gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <p className="text-[13px] font-medium text-zinc-200">Partners</p>
                    <button
                      type="button"
                      onClick={() => setShowPartnerForm((current) => !current)}
                      className="h-7 rounded-md border border-white/[0.09] px-2.5 text-[12px] text-zinc-300 transition hover:bg-white/[0.055] hover:text-white cursor-pointer"
                    >
                      {showPartnerForm ? "Cancel" : "Add or link partner"}
                    </button>
                  </div>
                  {showPartnerForm ? (
                    <div className="mt-4 grid min-w-0 gap-3 rounded-md border border-white/[0.08] bg-[#111113] p-3">
                      <form onSubmit={submitCompanyPartner} className="grid min-w-0 max-w-full gap-3">
                        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                          <Field label="New partner first name"><input name="firstName" required className={inputClass()} /></Field>
                          <Field label="New partner last name"><input name="lastName" className={inputClass()} /></Field>
                        </div>
                        <Field label="Title"><input name="role" className={inputClass()} /></Field>
                        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                          <Field label="Email"><input name="email" type="email" className={inputClass()} /></Field>
                          <Field label="LinkedIn"><input name="linkedin" className={inputClass()} /></Field>
                        </div>
                        <ContactRequirementHint />
                        <Field label="Phone"><input name="phone" className={inputClass()} /></Field>
                        <label className="flex items-center gap-2 text-[13px] text-zinc-300">
                          <input name="isPrimary" type="checkbox" className="size-4 accent-zinc-400" />
                          Primary contact
                        </label>
                        <DirectorCheckboxes users={users} />
                        <button disabled={isPending} className="h-8 w-fit rounded-md bg-zinc-700 px-3 text-[12px] font-medium text-white transition hover:bg-zinc-600 disabled:opacity-60 cursor-pointer">
                          Add partner
                        </button>
                      </form>
                      <form onSubmit={submitExistingPartnerLink} className="grid min-w-0 max-w-full gap-2 border-t border-white/[0.08] pt-3">
                        <select
                          name="partnerId"
                          required
                          value={existingPartnerId}
                          onChange={(event) => setExistingPartnerId(event.target.value)}
                          className={inputClass("w-full min-w-0")}
                        >
                          <option value="">Link existing partner</option>
                          {linkablePartners.map((partner) => (
                            <option key={partner.id} value={partner.id}>
                              {partner.name} · {partner.companyName}
                            </option>
                          ))}
                        </select>
                        <button
                          disabled={isPending || !linkablePartners.length || !existingPartnerId}
                          className="h-8 w-fit rounded-md border border-white/[0.09] px-3 text-[12px] font-medium text-zinc-300 transition hover:bg-white/[0.055] hover:text-white disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer">
                          Link existing partner
                        </button>
                      </form>
                    </div>
                  ) : null}
                  <div className="mt-3 divide-y divide-white/[0.06]">
                    {selected.contacts.length ? selected.contacts.map((contact) => (
                      <div key={contact.id} className="flex min-w-0 items-center gap-3 py-2.5">
                        <Avatar name={contact.name} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-zinc-100">{contact.name}</span>
                          <span className="block truncate text-[12px] text-zinc-500">{[contact.role, contact.email || contact.linkedin].filter(Boolean).join(" · ") || "No contact detail"}</span>
                        </span>
                        <a href={`/partners?partnerId=${contact.id}`} className="shrink-0 rounded-md border border-white/[0.09] px-2 py-1 text-[11px] text-zinc-400 transition hover:bg-white/[0.055] hover:text-white">
                          Open
                        </a>
                      </div>
                    )) : <p className="py-2 text-[13px] text-zinc-500">No partners linked yet.</p>}
                  </div>
                </section>

                <section className="min-w-0 max-w-full overflow-hidden rounded-md border border-white/[0.09] bg-[#0d0e11] p-4">
                  <div className="flex min-w-0 flex-col items-start gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <p className="text-[13px] font-medium text-zinc-200">Contact History</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={contactLogCreateHref({ companyName: selected.name })}
                        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/[0.09] px-2.5 text-[12px] text-zinc-300 transition hover:bg-white/[0.055] hover:text-white"
                      >
                        <ExternalLink className="size-3.5" strokeWidth={1.8} />
                        Open history
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setShowTouchpointForm((current) => {
                            if (!current) setTouchpointEventName("");
                            return !current;
                          });
                        }}
                        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/[0.09] px-2.5 text-[12px] text-zinc-300 transition hover:bg-white/[0.055] hover:text-white cursor-pointer"
                      >
                        <MessageSquarePlus className="size-3.5" strokeWidth={1.8} />
                        {showTouchpointForm ? "Cancel" : "Log contact"}
                      </button>
                    </div>
                  </div>
                  {showTouchpointForm ? (
                    <form onSubmit={submitCompanyCommunication} className="mt-4 grid min-w-0 gap-3 rounded-md border border-white/[0.08] bg-[#111113] p-3">
                      <Field label="Subject"><input name="subject" required className={inputClass()} /></Field>
                      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                        <Field label="Date"><input name="contactedAt" type="date" required className={inputClass()} /></Field>
                        <Field label="Next outreach"><input name="followUpDate" type="date" className={inputClass()} /></Field>
                      </div>
                      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                        <Field label="Channel">
                          <select name="type" defaultValue="meeting" className={inputClass("w-full min-w-0")}>
                            <option value="meeting">Meeting</option>
                            <option value="email">Email</option>
                            <option value="call">Call</option>
                            <option value="linkedin">LinkedIn</option>
                            <option value="in_person">In person</option>
                            <option value="other">Other</option>
                          </select>
                        </Field>
                        <Field label="Direction">
                          <select name="direction" defaultValue="outbound" className={inputClass("w-full min-w-0")}>
                            <option value="outbound">Outbound</option>
                            <option value="inbound">Inbound</option>
                          </select>
                        </Field>
                      </div>
                      <Field label="Contact">
                        <select name="partnerId" className={inputClass("w-full min-w-0")}>
                          <option value="">Company-level contact</option>
                          {selected.contacts.map((contact) => (
                            <option key={contact.id} value={contact.id}>{contact.name}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="BizTech Director">
                        <select name="userId" required className={inputClass("w-full min-w-0")}>
                          <option value="">Select BizTech Director</option>
                          {users.map((user) => (
                            <option key={user.id} value={user.id}>{user.name}</option>
                          ))}
                        </select>
                      </Field>
                      <div className="grid min-w-0 gap-3 rounded-md border border-white/[0.08] bg-white/[0.025] p-3">
                        <div className="flex min-w-0 items-center justify-between gap-3">
                          <p className="truncate text-[13px] font-medium text-zinc-300">Event attendance</p>
                          <span className="shrink-0 text-[12px] text-zinc-600">Optional</span>
                        </div>
                        <Field label="Event">
                          <EventCombo events={events} value={touchpointEventName} onChange={setTouchpointEventName} />
                        </Field>
                        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                          <Field label="Role">
                            <select name="eventRole" disabled={!touchpointEventName.trim()} className={inputClass("w-full min-w-0")}>
                              {eventRoles.map((role) => (
                                <option key={role.value} value={role.value}>{role.label}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Status">
                            <select name="eventStatus" disabled={!touchpointEventName.trim()} defaultValue="asked" className={inputClass("w-full min-w-0")}>
                              {eventStatuses.map((status) => (
                                <option key={status.value} value={status.value}>{status.label}</option>
                              ))}
                            </select>
                          </Field>
                        </div>
                      </div>
                      <Field label="Notes"><textarea name="notes" rows={3} className={inputClass("h-auto py-2")} /></Field>
                      <button disabled={isPending} className="h-9 w-fit rounded-md bg-zinc-700 px-4 text-[13px] font-medium text-white transition hover:bg-zinc-600 disabled:opacity-60 cursor-pointer">
                        Save contact
                      </button>
                    </form>
                  ) : null}
                  <div className="mt-3 divide-y divide-white/[0.06]">
                    {selectedMeetings.map((meeting) => (
                      <div key={meeting.id} className="py-2.5">
                        <p className="truncate text-[13px] font-medium text-zinc-100">{meeting.title}</p>
                        <div className="mt-1 flex min-w-0 items-center justify-between gap-3">
                          <p className="truncate text-[12px] text-zinc-500">
                            {[formatDateTime(meeting.meetingDateIso), "Meeting", meeting.partners.map((partner) => partner.name).join(", "), meeting.attendees.map((attendee) => attendee.name).join(", ")].filter(Boolean).join(" · ")}
                          </p>
                          <a href={contactHistoryActivityHref("meeting", meeting.id)} className="shrink-0 rounded-md border border-white/[0.09] px-2 py-1 text-[11px] text-zinc-400 transition hover:bg-white/[0.055] hover:text-white">
                            Open
                          </a>
                        </div>
                      </div>
                    ))}
                    {selected.communications.map((communication) => (
                      <div key={communication.id} className="py-2.5">
                        <p className="truncate text-[13px] font-medium text-zinc-100">{communication.subject || titleStatus(communication.type)}</p>
                        <div className="mt-1 flex min-w-0 items-center justify-between gap-3">
                          <p className="truncate text-[12px] text-zinc-500">
                            {[formatDateTime(communication.contactedAtIso), communication.partnerName || "Company-level contact", communication.userName, communication.followUpDate ? `Next outreach ${communication.followUpDate}` : null].filter(Boolean).join(" · ")}
                          </p>
                          <a href={contactHistoryActivityHref("touchpoint", communication.id)} className="shrink-0 rounded-md border border-white/[0.09] px-2 py-1 text-[11px] text-zinc-400 transition hover:bg-white/[0.055] hover:text-white">
                            Open
                          </a>
                        </div>
                      </div>
                    ))}
                    {!selectedMeetings.length && !selected.communications.length ? <p className="py-2 text-[13px] text-zinc-500">No contact history yet.</p> : null}
                  </div>
                </section>

                <section className="min-w-0 max-w-full overflow-hidden rounded-md border border-white/[0.09] bg-[#0d0e11] p-4">
                  <div className="flex min-w-0 flex-col items-start gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <p className="text-[13px] font-medium text-zinc-200">Pipeline</p>
                    <a href="/pipeline" className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/[0.09] px-2.5 text-[12px] text-zinc-300 transition hover:bg-white/[0.055] hover:text-white">
                      Open pipeline
                      <ExternalLink className="size-3" strokeWidth={1.8} />
                    </a>
                  </div>
                  <div className="mt-3 space-y-2">
                    {selected.activeDeals.length ? selected.activeDeals.map((deal) => (
                      <div key={deal.id} className="grid gap-2 rounded-md bg-white/[0.035] px-3 py-2 text-[13px] md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-zinc-100">{deal.eventName ?? "No event"}</span>
                          <span className="block truncate text-[12px] text-zinc-500">
                            {[deal.primaryContactName, deal.followUpDate ? `Next outreach ${deal.followUpDate}` : null, dollars(deal.amount)].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <StatusPill status={deal.status} />
                        <a href={`/pipeline?conversationId=${deal.id}`} className="w-fit rounded-md border border-white/[0.09] px-2 py-1 text-[11px] text-zinc-400 transition hover:bg-white/[0.055] hover:text-white">
                          Open
                        </a>
                      </div>
                    )) : <p className="text-[13px] text-zinc-500">No pipeline conversations yet.</p>}
                  </div>
                </section>

                <section className="min-w-0 max-w-full overflow-hidden rounded-md border border-white/[0.09] bg-[#0d0e11] p-4">
                  <div className="flex min-w-0 flex-col items-start gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <p className="text-[13px] font-medium text-zinc-200">Event involvement</p>
                    <button
                      type="button"
                      onClick={() => setShowEventForm((current) => !current)}
                      className="h-7 rounded-md border border-white/[0.09] px-2.5 text-[12px] text-zinc-300 transition hover:bg-white/[0.055] hover:text-white cursor-pointer"
                    >
                      {showEventForm ? "Cancel" : "Add involvement"}
                    </button>
                  </div>
                  {showEventForm ? (
                    <form onSubmit={submitCompanyEventRole} className="mt-4 grid min-w-0 gap-3 rounded-md border border-white/[0.08] bg-[#111113] p-3">
                      <Field label="Event">
                        <EventCombo events={events} value={eventName} onChange={setEventName} />
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
                        className="h-8 w-fit rounded-md bg-zinc-700 px-3 text-[12px] font-medium text-white transition hover:bg-zinc-600 disabled:opacity-60 cursor-pointer">
                        Add involvement
                      </button>
                    </form>
                  ) : null}
                  <div className="mt-3 space-y-2">
                    {selected.eventAttendances.length ? (
                      selected.eventAttendances.map((attendance) => (
                        <div key={`${attendance.eventId}-${attendance.eventRole}`} className="grid gap-2 rounded-md bg-white/[0.035] px-3 py-2 text-[13px] sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-center">
                          <span className="min-w-0">
                            <span className="block truncate text-zinc-100">{attendance.eventName}</span>
                            <span className="block truncate text-[12px] text-zinc-500">{eventRoleLabel(attendance.eventRole)}</span>
                          </span>
                          <select
                            value={attendance.eventStatus}
                            disabled={isPending}
                            onChange={(event) => {
                              const eventStatus = event.currentTarget.value as EventAttendanceStatus;
                              startTransition(async () => {
                                await updateCompanyEventStatusAction({
                                  companyId: selected.id,
                                  eventId: attendance.eventId,
                                  eventRole: attendance.eventRole,
                                  eventStatus,
                                });
                                router.refresh();
                              });
                            }}
                            aria-label={`${attendance.eventName} ${eventRoleLabel(attendance.eventRole)} status`}
                            className={inputClass("h-8 px-2 text-[12px]")}
                          >
                            {eventStatuses.map((status) => (
                              <option key={status.value} value={status.value}>{status.label}</option>
                            ))}
                          </select>
                          <span className="inline-flex shrink-0 items-center gap-1">
                            <a href={`/events?eventId=${attendance.eventId}`} className="grid size-8 place-items-center rounded-md text-zinc-500 transition hover:bg-white/[0.055] hover:text-white" aria-label={`Open ${attendance.eventName}`}>
                              <ExternalLink className="size-4" strokeWidth={1.8} />
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                if (!window.confirm("Remove this event involvement?")) return;
                                startTransition(async () => {
                                  await removeCompanyEventRoleAction({
                                    companyId: selected.id,
                                    eventId: attendance.eventId,
                                    eventRole: attendance.eventRole,
                                  });
                                  router.refresh();
                                });
                              }}
                              aria-label={`Remove ${attendance.eventName} ${eventRoleLabel(attendance.eventRole)} role`}
                              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition hover:bg-red-500/10 hover:text-red-200 cursor-pointer"
                            >
                              <Trash2 className="size-4" strokeWidth={1.8} />
                            </button>
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[13px] text-zinc-500">No event involvement linked yet.</p>
                    )}
                    <div className="border-t border-white/[0.08] pt-3">
                      <p className="text-[12px] text-zinc-500">Documents</p>
                      <p className="mt-1 text-[13px] text-zinc-300">{selected.documents.length ? `${selected.documents.length} linked` : "No documents linked"}</p>
                    </div>
                  </div>
                </section>
                {error && <p className="rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2 text-[13px] text-red-200">{error}</p>}
              </div>
            </div>
          ) : selected ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 min-w-0 space-y-4 overflow-x-hidden overflow-y-auto px-5 py-5">
                <form id="company-edit-form" onSubmit={submitUpdate} className="min-w-0 space-y-4">
                  <Field label="Company name">
                    <input name="name" required defaultValue={selected.name} className={inputClass()} />
                  </Field>
                  <Field label="Website"><input name="website" defaultValue={selected.website ?? ""} className={inputClass()} /></Field>
                  <Field label="LinkedIn"><input name="linkedin" defaultValue={selected.linkedin ?? ""} className={inputClass()} /></Field>
                  <Field label="Notes"><textarea name="notes" rows={3} defaultValue={selected.notes ?? ""} className={inputClass("h-auto py-2")} /></Field>
                  <div className="flex flex-wrap gap-5">
                    <label className="flex items-center gap-2 text-[13px] text-zinc-300">
                      <input name="isAlumni" type="checkbox" defaultChecked={selected.isAlumni} className="size-4 accent-zinc-400" />
                      Alumni-led
                    </label>
                    <label className="flex items-center gap-2 text-[13px] text-zinc-300">
                      <input name="isInKind" type="checkbox" defaultChecked={isInKind(selected)} className="size-4 accent-zinc-400" />
                      In-kind sponsor
                    </label>
                    <label className="flex items-center gap-2 text-[13px] text-zinc-300">
                      <input name="archived" type="checkbox" defaultChecked={selected.archived} className="size-4 accent-zinc-400" />
                      Archived
                    </label>
                  </div>
                </form>
                <div className="grid w-full min-w-0 max-w-full gap-4 overflow-x-hidden">
                  <div className="min-w-0 max-w-full overflow-hidden rounded-md border border-white/[0.09] bg-[#0d0e11] p-4">
                    <div className="flex min-w-0 flex-col items-start gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <p className="text-[12px] text-zinc-500">Linked partners</p>
                      <button
                        type="button"
                        onClick={() => setShowPartnerForm((current) => !current)}
                        className="h-7 rounded-md border border-white/[0.09] px-2.5 text-[12px] text-zinc-300 transition hover:bg-white/[0.055] hover:text-white cursor-pointer"
                      >
                        {showPartnerForm ? "Cancel" : "Add partner"}
                      </button>
                    </div>
                    {showPartnerForm && (
                      <form onSubmit={submitCompanyPartner} className="mt-4 grid min-w-0 max-w-full gap-3 rounded-md border border-white/[0.08] bg-[#111113] p-3">
                        <div className="grid min-w-0 gap-3">
                          <Field label="New partner first name"><input name="firstName" required className={inputClass()} /></Field>
                          <Field label="New partner last name"><input name="lastName" className={inputClass()} /></Field>
                        </div>
                        <Field label="Title"><input name="role" className={inputClass()} /></Field>
                        <div className="grid min-w-0 gap-3">
                          <Field label="Email"><input name="email" type="email" className={inputClass()} /></Field>
                          <Field label="LinkedIn"><input name="linkedin" className={inputClass()} /></Field>
                        </div>
                        <ContactRequirementHint />
                        <Field label="Phone"><input name="phone" className={inputClass()} /></Field>
                        <label className="flex items-center gap-2 text-[13px] text-zinc-300">
                          <input name="isPrimary" type="checkbox" className="size-4 accent-zinc-400" />
                          Primary contact
                        </label>
                        <DirectorCheckboxes users={users} />
                        <button disabled={isPending} className="h-8 w-fit rounded-md bg-zinc-700 px-3 text-[12px] font-medium text-white transition hover:bg-zinc-600 disabled:opacity-60 cursor-pointer">
                          Link partner
                        </button>
                      </form>
                    )}
                    <form onSubmit={submitExistingPartnerLink} className="mt-4 grid min-w-0 max-w-full gap-2">
                      <select
                        name="partnerId"
                        required
                        value={existingPartnerId}
                        onChange={(event) => setExistingPartnerId(event.target.value)}
                        className={inputClass("w-full min-w-0")}
                      >
                        <option value="">Link existing partner</option>
                        {linkablePartners.map((partner) => (
                          <option key={partner.id} value={partner.id}>
                            {partner.name} · {partner.companyName}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={isPending || !linkablePartners.length || !existingPartnerId}
                        className="h-9 rounded-md border border-white/[0.09] px-3 text-[13px] font-medium text-zinc-300 transition hover:bg-white/[0.055] hover:text-white disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer">
                        Link
                      </button>
                    </form>
                    <div className="mt-3 space-y-3">
                      {selected.contacts.length ? selected.contacts.map((contact) => (
                        <div key={contact.id} className="flex items-center gap-3">
                          <Avatar name={contact.name} />
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-medium text-zinc-100">{contact.name}</span>
                            <span className="block truncate text-[12px] text-zinc-500">{contact.role || contact.email || "Partner"}</span>
                          </span>
                        </div>
                      )) : <p className="text-[13px] text-zinc-500">No partners linked yet.</p>}
                    </div>
                  </div>

                  <div className="min-w-0 max-w-full overflow-hidden rounded-md border border-white/[0.09] bg-[#0d0e11] p-4">
                    <div className="flex min-w-0 flex-col items-start gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <p className="text-[13px] font-medium text-zinc-200">Pipeline conversations</p>
                      <a href="/pipeline" className="text-[12px] text-zinc-500 transition hover:text-zinc-200">
                        Open pipeline
                      </a>
                    </div>
                    <div className="mt-4 space-y-2">
                      {selected.activeDeals.length ? (
                        selected.activeDeals.map((deal) => (
                          <div key={deal.id} className="grid gap-2 rounded-md bg-white/[0.035] px-3 py-2 text-[13px] md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-zinc-100">{deal.eventName ?? "No event"}</span>
                              <span className="block truncate text-[12px] text-zinc-500">
                                {[deal.primaryContactName, deal.followUpDate ? `Next outreach ${deal.followUpDate}` : null, dollars(deal.amount)].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                            <StatusPill status={deal.status} />
                            <a href={`/pipeline?conversationId=${deal.id}`} className="w-fit rounded-md border border-white/[0.09] px-2 py-1 text-[11px] text-zinc-400 transition hover:bg-white/[0.055] hover:text-white">
                              Open
                            </a>
                          </div>
                        ))
                      ) : (
                        <p className="text-[13px] text-zinc-500">No pipeline conversations yet.</p>
                      )}
                    </div>
                  </div>
                  <div className="min-w-0 max-w-full overflow-hidden rounded-md border border-white/[0.09] bg-[#0d0e11] p-4">
                    <p className="text-[13px] font-medium text-zinc-200">Event involvement</p>
                    <form onSubmit={submitCompanyEventRole} className="mt-4 grid min-w-0 gap-3">
                      <div className="grid min-w-0 gap-3">
                        <Field label="Event">
                          <EventCombo events={events} value={eventName} onChange={setEventName} />
                        </Field>
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
                        className="h-9 w-fit rounded-md bg-zinc-700 px-4 text-[13px] font-medium text-white transition hover:bg-zinc-600 disabled:opacity-60 cursor-pointer">
                        Add involvement
                      </button>
                    </form>
                    <div className="mt-4 space-y-2">
                      {selected.eventAttendances.length ? (
                        selected.eventAttendances.map((attendance) => (
                          <div key={`${attendance.eventId}-${attendance.eventRole}`} className="grid grid-cols-[minmax(0,1fr)_140px_auto] items-center gap-3 rounded-md bg-white/[0.035] px-3 py-2 text-[13px]">
                            <span className="min-w-0 truncate text-zinc-200">
                              {attendance.eventName} · {eventRoleLabel(attendance.eventRole)}
                            </span>
                            <select
                              value={attendance.eventStatus}
                              disabled={isPending}
                              onChange={(event) => {
                                const eventStatus = event.currentTarget.value as EventAttendanceStatus;
                                startTransition(async () => {
                                  await updateCompanyEventStatusAction({
                                    companyId: selected.id,
                                    eventId: attendance.eventId,
                                    eventRole: attendance.eventRole,
                                    eventStatus,
                                  });
                                  router.refresh();
                                });
                              }}
                              aria-label={`${attendance.eventName} ${eventRoleLabel(attendance.eventRole)} status`}
                              className={inputClass("h-8 px-2 text-[12px]")}
                            >
                              {eventStatuses.map((status) => (
                                <option key={status.value} value={status.value}>{status.label}</option>
                              ))}
                            </select>
                            <span className="inline-flex shrink-0 items-center gap-1">
                              <a href={`/events?eventId=${attendance.eventId}`} className="grid size-8 place-items-center rounded-md text-zinc-500 transition hover:bg-white/[0.055] hover:text-white" aria-label={`Open ${attendance.eventName}`}>
                                <ExternalLink className="size-4" strokeWidth={1.8} />
                              </a>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!window.confirm("Remove this event involvement?")) return;
                                  startTransition(async () => {
                                    await removeCompanyEventRoleAction({
                                      companyId: selected.id,
                                      eventId: attendance.eventId,
                                      eventRole: attendance.eventRole,
                                    });
                                    router.refresh();
                                  });
                                }}
                                aria-label={`Remove ${attendance.eventName} ${eventRoleLabel(attendance.eventRole)} role`}
                                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition hover:bg-red-500/10 hover:text-red-200 cursor-pointer"
                              >
                                <Trash2 className="size-4" strokeWidth={1.8} />
                              </button>
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[13px] text-zinc-500">No event involvement linked yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 max-w-full overflow-hidden rounded-md border border-white/[0.09] bg-[#0d0e11] p-4">
                    <p className="text-[13px] font-medium text-zinc-200">Documents</p>
                    <form onSubmit={submitCompanyDocument} className="mt-4 grid min-w-0 gap-3">
                      <Field label="Title">
                        <input name="title" required className={inputClass()} />
                      </Field>
                      <Field label="URL">
                        <input name="url" type="url" required className={inputClass()} />
                      </Field>
                      <div className="grid min-w-0 gap-3">
                        <Field label="Type">
                          <select name="type" defaultValue="deck" className={inputClass("w-full min-w-0")}>
                            <option value="deck">Deck</option>
                            <option value="contract">Contract</option>
                            <option value="invoice">Invoice</option>
                            <option value="proposal">Proposal</option>
                            <option value="general">General</option>
                          </select>
                        </Field>
                        <Field label="Status">
                          <select name="status" defaultValue="draft" className={inputClass("w-full min-w-0")}>
                            <option value="draft">Draft</option>
                            <option value="sent">Sent</option>
                            <option value="signed">Signed</option>
                            <option value="archived">Archived</option>
                          </select>
                        </Field>
                        <Field label="Event">
                          <select name="eventId" className={inputClass("w-full min-w-0")}>
                            <option value="">No event</option>
                            {events.map((event) => (
                              <option key={event.id} value={event.id}>{event.name}</option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      <Field label="Partner">
                        <select name="partnerId" className={inputClass("w-full min-w-0")}>
                          <option value="">Company-level document</option>
                          {selected.contacts.map((contact) => (
                            <option key={contact.id} value={contact.id}>{contact.name}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Notes">
                        <textarea name="notes" rows={2} className={inputClass("h-auto py-2")} />
                      </Field>
                      <button
                        disabled={isPending}
                        className="h-9 w-fit rounded-md bg-zinc-700 px-4 text-[13px] font-medium text-white transition hover:bg-zinc-600 disabled:opacity-60 cursor-pointer">
                        Add document
                      </button>
                    </form>
                    <div className="mt-4 space-y-2">
                      {selected.documents.length ? (
                        selected.documents.map((document) => (
                          <div key={document.id} className="flex items-start justify-between gap-3 rounded-md bg-white/[0.035] px-3 py-2 text-[13px]">
                            <span className="min-w-0">
                              <a href={document.url} target="_blank" rel="noreferrer" className="block truncate font-medium text-zinc-100 hover:text-white">
                                {document.title}
                              </a>
                              <span className="block truncate text-[12px] text-zinc-500">
                                {[document.type, document.status, document.eventName, document.partnerName].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (!window.confirm("Remove this document link?")) return;
                                startTransition(async () => {
                                  await deletePartnerDocumentAction(document.id);
                                  router.refresh();
                                });
                              }}
                              aria-label={`Remove ${document.title}`}
                              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition hover:bg-red-500/10 hover:text-red-200 cursor-pointer"
                            >
                              <Trash2 className="size-4" strokeWidth={1.8} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="text-[13px] text-zinc-500">No documents linked yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 max-w-full overflow-hidden rounded-md border border-white/[0.09] bg-[#0d0e11] p-4">
                    <div className="flex min-w-0 flex-col items-start gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <p className="text-[13px] font-medium text-zinc-200">Contact History</p>
                      <a
                        href={contactLogCreateHref({ companyName: selected.name })}
                        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/[0.09] px-2.5 text-[12px] text-zinc-300 transition hover:bg-white/[0.055] hover:text-white"
                      >
                        <ExternalLink className="size-3.5" strokeWidth={1.8} />
                        Open history
                      </a>
                    </div>
                    <form onSubmit={submitCompanyCommunication} className="mt-4 grid min-w-0 gap-3">
                      <div className="grid min-w-0 gap-3">
                        <Field label="Subject">
                          <input name="subject" required className={inputClass()} />
                        </Field>
                        <Field label="Date">
                          <input name="contactedAt" type="date" required className={inputClass()} />
                        </Field>
                      </div>
                      <div className="grid min-w-0 gap-3">
                        <Field label="Channel">
                          <select name="type" defaultValue="meeting" className={inputClass("w-full min-w-0")}>
                            <option value="meeting">Meeting</option>
                            <option value="email">Email</option>
                            <option value="call">Call</option>
                            <option value="linkedin">LinkedIn</option>
                            <option value="in_person">In person</option>
                            <option value="other">Other</option>
                          </select>
                        </Field>
                        <Field label="Direction">
                          <select name="direction" defaultValue="outbound" className={inputClass("w-full min-w-0")}>
                            <option value="outbound">Outbound</option>
                            <option value="inbound">Inbound</option>
                          </select>
                        </Field>
                        <Field label="Next outreach">
                          <input name="followUpDate" type="date" className={inputClass()} />
                        </Field>
                      </div>
                      <div className="grid min-w-0 gap-3">
                        <Field label="BizTech Director">
                          <select name="userId" required className={inputClass("w-full min-w-0")}>
                            <option value="">Select BizTech Director</option>
                            {users.map((user) => (
                              <option key={user.id} value={user.id}>{user.name}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Contact">
                          <select name="partnerId" className={inputClass("w-full min-w-0")}>
                            <option value="">Company-level contact</option>
                            {selected.contacts.map((contact) => (
                              <option key={contact.id} value={contact.id}>{contact.name}</option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      <Field label="Notes">
                        <textarea name="notes" rows={3} className={inputClass("h-auto py-2")} />
                      </Field>
                      <button
                        disabled={isPending}
                        className="h-9 w-fit rounded-md bg-zinc-700 px-4 text-[13px] font-medium text-white transition hover:bg-zinc-600 disabled:opacity-60 cursor-pointer">
                        Save contact
                      </button>
                    </form>
                    <div className="mt-4 space-y-2">
                      {selectedMeetings.map((meeting) => (
                        <div key={meeting.id} className="flex items-start justify-between gap-3 rounded-md bg-white/[0.035] px-3 py-2 text-[13px]">
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-zinc-100">{meeting.title}</span>
                            <span className="block truncate text-[12px] text-zinc-500">
                              {[formatDateTime(meeting.meetingDateIso), "Meeting", meeting.partners.map((partner) => partner.name).join(", "), meeting.attendees.map((attendee) => attendee.name).join(", ")].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <a href={contactHistoryActivityHref("meeting", meeting.id)} className="grid size-8 shrink-0 place-items-center rounded-md text-zinc-500 transition hover:bg-white/[0.055] hover:text-white" aria-label={`Open ${meeting.title}`}>
                            <ExternalLink className="size-4" strokeWidth={1.8} />
                          </a>
                        </div>
                      ))}
                      {selected.communications.map((communication) => (
                          <div key={communication.id} className="flex items-start justify-between gap-3 rounded-md bg-white/[0.035] px-3 py-2 text-[13px]">
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-zinc-100">
                                {communication.subject || titleStatus(communication.type)}
                              </span>
                              <span className="block truncate text-[12px] text-zinc-500">
                                {[
                                  formatDateTime(communication.contactedAtIso),
                                  communication.userName,
                                  communication.partnerName || "Company-level contact",
                                  communication.followUpDate ? `Next outreach ${communication.followUpDate}` : null,
                                ].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                            <span className="inline-flex shrink-0 items-center gap-1">
                              <a href={contactHistoryActivityHref("touchpoint", communication.id)} className="grid size-8 place-items-center rounded-md text-zinc-500 transition hover:bg-white/[0.055] hover:text-white" aria-label={`Open ${communication.subject || titleStatus(communication.type)}`}>
                                <ExternalLink className="size-4" strokeWidth={1.8} />
                              </a>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!window.confirm("Remove this contact record?")) return;
                                  startTransition(async () => {
                                    await deleteCompanyInteractionAction(communication.id);
                                    router.refresh();
                                  });
                                }}
                                aria-label={`Remove ${communication.subject || titleStatus(communication.type)}`}
                                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition hover:bg-red-500/10 hover:text-red-200 cursor-pointer"
                              >
                                <Trash2 className="size-4" strokeWidth={1.8} />
                              </button>
                            </span>
                          </div>
                        ))}
                      {!selectedMeetings.length && !selected.communications.length ? (
                        <p className="text-[13px] text-zinc-500">No contact history yet.</p>
                      ) : null}
                    </div>
                  </div>
                </div>
                {error && <p className="rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2 text-[13px] text-red-200">{error}</p>}
              </div>
              <div className="shrink-0 border-t border-white/[0.08] bg-[#0d0e11] px-5 py-4">
                <button form="company-edit-form" disabled={isPending} className="h-9 rounded-md bg-zinc-700 px-4 text-[13px] font-medium text-white transition hover:bg-zinc-600 disabled:opacity-60 cursor-pointer">
                  Save changes
                </button>
              </div>
            </div>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
