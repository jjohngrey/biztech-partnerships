"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createEventAction,
  logEventPartnerResponseAction,
  removePartnerEventRoleAction,
  updatePartnerEventStatusAction,
  updateEventAction,
} from "@/lib/partnerships/actions";
import type { CrmEventSummary, CrmUserSummary, EventAttendanceStatus, EventRole, PartnerDirectoryRecord } from "@/lib/partnerships/types";

type PanelMode = "closed" | "create" | "view" | "edit";
type SortDirection = "asc" | "desc";
type EventSortKey = "name" | "year" | "partners" | "start";
type TierPresetDraft = { id: string; label: string; amount: number | null };
type EventYearTab = { value: string; label: string; count: number };

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

function compareText(left: string | null | undefined, right: string | null | undefined) {
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, { sensitivity: "base" });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function eventRoleLabel(value: EventRole) {
  return eventRoles.find((role) => role.value === value)?.label ?? value;
}

function eventStatusLabel(value: EventAttendanceStatus) {
  return eventStatuses.find((status) => status.value === value)?.label ?? value;
}

function splitPartnerName(value: string) {
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

function partnerGoalText(event: Pick<CrmEventSummary, "confirmedPartnerCount" | "confirmedPartnerGoal">) {
  if (event.confirmedPartnerGoal) {
    return `${event.confirmedPartnerCount}/${event.confirmedPartnerGoal} confirmed`;
  }
  return `${event.confirmedPartnerCount} confirmed`;
}

function responseStatusTone(status: EventAttendanceStatus) {
  if (status === "confirmed" || status === "attended") return "bg-emerald-500/10 text-emerald-200";
  if (status === "declined") return "bg-red-500/10 text-red-200";
  if (status === "form_sent" || status === "form_submitted") return "bg-white/[0.075] text-zinc-300";
  return "bg-white/[0.055] text-zinc-400";
}

function parseOptionalInteger(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true as const, value: undefined };
  const numericValue = Number(trimmed);
  if (!Number.isInteger(numericValue) || numericValue < 0) return { ok: false as const };
  return { ok: true as const, value: numericValue };
}

function parseOptionalCadCents(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true as const, value: undefined };
  const numericValue = Number(trimmed);
  if (!Number.isFinite(numericValue) || numericValue < 0) return { ok: false as const };
  return { ok: true as const, value: Math.round(numericValue * 100) };
}

function sortValue(result: number, direction: SortDirection) {
  return direction === "asc" ? result : -result;
}

function academicYearStartYear(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  return month >= 4 ? year : year - 1; // May (4) -> Apr (3)
}

function eventAcademicYearKey(event: Pick<CrmEventSummary, "startDate" | "year">) {
  const parsed = new Date(`${event.startDate}T12:00:00`);
  if (!Number.isNaN(parsed.getTime())) {
    return String(academicYearStartYear(parsed));
  }
  if (typeof event.year === "number" && Number.isFinite(event.year)) {
    return String(event.year);
  }
  return "unknown";
}

function eventAcademicYearLabel(startYearKey: string) {
  if (startYearKey === "unknown") return "Unknown year";
  const startYear = Number(startYearKey);
  if (!Number.isFinite(startYear)) return "Unknown year";
  return `${startYear}/${String(startYear + 1).slice(2)}`;
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: EventSortKey;
  activeKey: EventSortKey;
  direction: SortDirection;
  onSort: (key: EventSortKey) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={["w-fit rounded-full px-2 py-1 text-left transition hover:bg-white/[0.055] hover:text-zinc-300 cursor-pointer",
        active ? "bg-white/[0.055] text-zinc-200" : "",
      ].join(" ")}
    >
      {label}
      {active ? ` ${direction === "desc" ? "↓" : "↑"}` : ""}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-[12px] font-medium text-zinc-400">
      {label}
      {children}
    </label>
  );
}

function ContactRequirementHint() {
  return <p className="text-[12px] leading-5 text-zinc-500">Email or LinkedIn is required.</p>;
}

function PartnerCombo({
  partners,
  value,
  onChange,
  selectedId,
  onSelect,
}: {
  partners: PartnerDirectoryRecord[];
  value: string;
  onChange: (value: string) => void;
  selectedId: string;
  onSelect: (partnerId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const match = selectedId ? partners.find((partner) => partner.id === selectedId) ?? null : getPartnerMatch(partners, value);
  const filtered = partners
    .filter((partner) => {
      const query = value.trim().toLowerCase();
      if (!query) return true;
      return [partner.name, partner.email, partner.companyName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .slice(0, 6);

  return (
    <div className="relative">
      <input type="hidden" name="partnerId" value={selectedId || match?.id || ""} />
      <input
        name="partnerName"
        value={value}
        onChange={(event) => {
          onSelect("");
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder="Search partners or type a new one"
        className={inputClass("w-full")}
      />
      {open ? (
        <div className="absolute left-0 right-0 top-11 z-30 max-h-72 overflow-auto rounded-md border border-white/[0.1] bg-[#15161a] shadow-2xl shadow-black/40">
          {filtered.map((partner) => (
            <button
              key={partner.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(partner.id);
                onChange(partner.name);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.05] cursor-pointer"
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-zinc-100">{partner.name}</span>
                <span className="block truncate text-[12px] text-zinc-500">{partner.companyName}</span>
              </span>
              <span className="shrink-0 text-[12px] text-zinc-500">{partner.email ?? "LinkedIn"}</span>
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

function TierPresetEditor({
  presets,
  onChange,
}: {
  presets: TierPresetDraft[];
  onChange: (next: TierPresetDraft[]) => void;
}) {
  function update(index: number, patch: Partial<Omit<TierPresetDraft, "id">>) {
    onChange(presets.map((preset, i) => (i === index ? { ...preset, ...patch } : preset)));
  }
  function remove(index: number) {
    onChange(presets.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...presets, { id: crypto.randomUUID(), label: "", amount: null }]);
  }
  return (
    <div className="grid gap-2">
      {presets.length === 0 ? (
        <p className="text-[12px] text-zinc-500">
          Add named tiers (e.g. Gold, Silver) with default amounts. Selecting a tier on a sponsorship will pre-fill the ask.
        </p>
      ) : null}
      {presets.map((preset, index) => (
        <div key={preset.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,140px)_auto] gap-2">
          <input
            value={preset.label}
            onChange={(event) => update(index, { label: event.target.value })}
            placeholder="Tier name (e.g. Gold)"
            className={inputClass()}
          />
          <input
            type="number"
            min="0"
            step="1"
            value={preset.amount === null ? "" : preset.amount / 100}
            onChange={(event) => {
              const raw = event.target.value.trim();
              if (!raw) return update(index, { amount: null });
              const numeric = Number(raw);
              if (!Number.isFinite(numeric) || numeric < 0) return;
              update(index, { amount: Math.round(numeric * 100) });
            }}
            placeholder="Amount CAD"
            className={inputClass()}
          />
          <button
            type="button"
            onClick={() => remove(index)}
            aria-label={`Remove tier ${preset.label || index + 1}`}
            className="grid size-9 place-items-center rounded-md border border-white/[0.1] text-zinc-400 transition hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-200 cursor-pointer"
          >
            <Trash2 className="size-4" strokeWidth={1.8} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex h-8 w-fit items-center gap-1.5 rounded-md border border-white/[0.1] bg-white/[0.02] px-2.5 text-[12px] font-medium text-zinc-300 transition hover:bg-white/[0.05] hover:text-white cursor-pointer"
      >
        <Plus className="size-3.5" strokeWidth={1.8} />
        Add tier
      </button>
    </div>
  );
}

function DirectorMultiSelect({
  directors,
  selectedIds,
  onChange,
}: {
  directors: CrmUserSummary[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selected = directors.filter((director) => selectedIds.includes(director.id));
  const filtered = directors.filter((director) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [director.name, director.email].filter(Boolean).join(" ").toLowerCase().includes(q);
  });

  useEffect(() => {
    if (!open) return;
    searchInputRef.current?.focus();
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((value) => value !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  return (
    <div ref={containerRef} className="grid gap-2">
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="directorUserIds" value={id} />
      ))}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={inputClass("flex items-center justify-between text-left text-zinc-300")}
        >
          <span className="truncate">
            {selected.length === 0
              ? "Select BizTech directors…"
              : `${selected.length} director${selected.length === 1 ? "" : "s"} selected`}
          </span>
          <span className="ml-2 text-zinc-500">▾</span>
        </button>
        {open ? (
          <div className="absolute left-0 right-0 top-11 z-30 max-h-72 overflow-auto rounded-md border border-white/[0.1] bg-[#15161a] shadow-2xl shadow-black/40">
            <div className="border-b border-white/[0.08] p-2">
              <input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search directors…"
                className={inputClass("h-8 text-[12px]")}
              />
            </div>
            {filtered.length === 0 ? (
              <p className="px-3 py-2.5 text-[13px] text-zinc-500">No directors found.</p>
            ) : (
              filtered.map((director) => {
                const isSelected = selectedIds.includes(director.id);
                return (
                  <button
                    key={director.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => toggle(director.id)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.05] cursor-pointer"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-zinc-100">{director.name}</span>
                      <span className="block truncate text-[12px] text-zinc-500">{director.email}</span>
                    </span>
                    <span className={`shrink-0 text-[12px] ${isSelected ? "text-emerald-300" : "text-zinc-600"}`}>
                      {isSelected ? "✓" : ""}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        ) : null}
      </div>
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((director) => (
            <span
              key={director.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 py-1 text-[12px] text-zinc-200"
            >
              {director.name}
              <button
                type="button"
                onClick={() => toggle(director.id)}
                aria-label={`Remove ${director.name}`}
                className="text-zinc-500 transition hover:text-red-200 cursor-pointer"
              >
                <X className="size-3" strokeWidth={2} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function EventsDirectory({
  events,
  partners,
  directors,
  initialEventId,
}: {
  events: CrmEventSummary[];
  partners: PartnerDirectoryRecord[];
  directors: CrmUserSummary[];
  initialEventId?: string;
}) {
  const router = useRouter();
  const initialEvent = events.find((event) => event.id === initialEventId) ?? null;
  const currentAcademicYearKey = String(academicYearStartYear(new Date()));
  const yearCounts = new Map<string, number>();
  for (const event of events) {
    const key = eventAcademicYearKey(event);
    yearCounts.set(key, (yearCounts.get(key) ?? 0) + 1);
  }
  const dynamicTabs: EventYearTab[] = Array.from(yearCounts.entries())
    .sort(([left], [right]) => {
      if (left === "unknown") return 1;
      if (right === "unknown") return -1;
      return Number(right) - Number(left);
    })
    .map(([value, count]) => ({
      value,
      label: eventAcademicYearLabel(value),
      count,
    }));
  const fallbackYearTab = dynamicTabs[0]?.value ?? "unknown";
  const initialYearTab = initialEvent
    ? eventAcademicYearKey(initialEvent)
    : dynamicTabs.some((tab) => tab.value === currentAcademicYearKey)
      ? currentAcademicYearKey
      : fallbackYearTab;
  const [query, setQuery] = useState("");
  const [activeYearTab, setActiveYearTab] = useState(initialYearTab);
  const [sortKey, setSortKey] = useState<EventSortKey>("start");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedId, setSelectedId] = useState<string | null>(initialEvent?.id ?? null);
  const [mode, setMode] = useState<PanelMode>(initialEvent ? "view" : "closed");
  const [partnerName, setPartnerName] = useState("");
  const [selectedResponsePartnerId, setSelectedResponsePartnerId] = useState("");
  const [selectedDirectorIds, setSelectedDirectorIds] = useState<string[]>(
    initialEvent?.directors.map((director) => director.id) ?? [],
  );
  const [tierConfigs, setTierConfigs] = useState<TierPresetDraft[]>(
    initialEvent?.tierConfigs.map((preset) => ({ ...preset })) ?? [],
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const selected = events.find((event) => event.id === selectedId) ?? null;

  const partnerMatch = selectedResponsePartnerId ? partners.find((partner) => partner.id === selectedResponsePartnerId) ?? null : getPartnerMatch(partners, partnerName);
  const pendingPartnerName = splitPartnerName(partnerName);
  const panelOpen = mode !== "closed";
  const selectedRoleGroups = selected
    ? eventRoles
        .map((role) => ({
          ...role,
          responses: selected.partnerResponses.filter((response) => response.eventRole === role.value),
        }))
        .filter((role) => role.responses.length > 0)
    : [];
  const yearTabs: EventYearTab[] = dynamicTabs;
  const tabFilteredEvents = events.filter((event) => eventAcademicYearKey(event) === activeYearTab);
  const filteredEvents = [...tabFilteredEvents]
    .filter((event) =>
      [event.name, event.year].join(" ").toLowerCase().includes(query.trim().toLowerCase()),
    )
    .sort((left, right) => {
      const result =
        sortKey === "year"
          ? (left.year ?? 0) - (right.year ?? 0)
          : sortKey === "start"
            ? compareText(left.startDate, right.startDate)
            : sortKey === "partners"
              ? left.confirmedPartnerCount - right.confirmedPartnerCount
              : compareText(left.name, right.name);
      return sortValue(result, sortDirection);
    });

  function sortEvents(key: EventSortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "start" ? "desc" : "asc");
  }

  function payload(data: FormData) {
    const goal = String(data.get("sponsorshipGoal") ?? "").trim();
    const partnerGoal = String(data.get("confirmedPartnerGoal") ?? "").trim();
    const year = String(data.get("year") ?? "").trim();
    const parsedYear = parseOptionalInteger(year);
    const parsedGoal = parseOptionalCadCents(goal);
    const parsedPartnerGoal = parseOptionalInteger(partnerGoal);
    if (!parsedYear.ok) throw new Error("Year must be a whole number.");
    if (!parsedGoal.ok) throw new Error("Sponsorship goal must be a valid non-negative number.");
    if (!parsedPartnerGoal.ok) throw new Error("Partner goal must be a whole number.");
    const cleanedTierConfigs = tierConfigs
      .map((preset) => ({ id: preset.id, label: preset.label.trim(), amount: preset.amount }))
      .filter((preset) => preset.label.length > 0);
    return {
      name: String(data.get("name") ?? ""),
      year: parsedYear.value,
      startDate: String(data.get("startDate") ?? ""),
      endDate: String(data.get("endDate") ?? "") || undefined,
      outreachStartDate: String(data.get("outreachStartDate") ?? "") || undefined,
      sponsorshipGoal: parsedGoal.value,
      confirmedPartnerGoal: parsedPartnerGoal.value,
      notes: String(data.get("notes") ?? ""),
      archived: data.get("archived") === "on",
      directorUserIds: selectedDirectorIds,
      tierConfigs: cleanedTierConfigs,
    };
  }

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      try {
        const created = await createEventAction(payload(data));
        form.reset();
        setActiveYearTab(
          eventAcademicYearKey({
            startDate: created.startDate,
            year: created.year,
          }),
        );
        setSelectedId(created.id);
        setMode("view");
        setSelectedDirectorIds([]);
        setTierConfigs([]);
        window.history.replaceState(null, "", `/events?eventId=${created.id}`);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not create event.");
      }
    });
  }

  function submitPartnerResponse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const partnerId = String(data.get("partnerId") ?? "");
    const requestedPartner = String(data.get("partnerName") ?? "").trim();
    const eventRole = String(data.get("eventRole") ?? "") as EventRole;
    const eventStatus = String(data.get("eventStatus") ?? "asked") as EventAttendanceStatus;
    if (!partnerId && !requestedPartner) {
      setError("Choose a person or type a new one.");
      return;
    }
    if (!partnerId && !String(data.get("email") ?? "").trim() && !String(data.get("linkedin") ?? "").trim()) {
      setError("New people need either an email or LinkedIn.");
      return;
    }
    startTransition(async () => {
      try {
        await logEventPartnerResponseAction({
          eventId: selected.id,
          eventRole,
          eventStatus,
          partnerId: partnerId || undefined,
          firstName: String(data.get("firstName") ?? ""),
          lastName: String(data.get("lastName") ?? ""),
          companyName: String(data.get("companyName") ?? ""),
          role: String(data.get("role") ?? ""),
          email: String(data.get("email") ?? ""),
          linkedin: String(data.get("linkedin") ?? ""),
        });
        form.reset();
        setPartnerName("");
        setSelectedResponsePartnerId("");
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not add person.");
      }
    });
  }

  function submitUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError(null);
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await updateEventAction({ ...payload(data), id: selected.id });
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not update event.");
      }
    });
  }

  return (
    <div className={["grid min-h-[100dvh] w-full max-w-full grid-cols-1 overflow-x-hidden bg-[#0d0d0f] xl:overflow-hidden", panelOpen ? "xl:grid-cols-[minmax(0,1fr)_minmax(400px,480px)]" : ""].join(" ")}>
      <section className={["min-w-0 bg-[#0d0d0f] px-3 py-4 sm:px-5 sm:py-5 xl:overflow-hidden", panelOpen ? "hidden xl:block" : ""].join(" ")}>
        <h2 className="text-[15px] font-medium text-zinc-100">Events</h2>
        <div className="mt-4 inline-flex flex-wrap rounded-md border border-white/[0.09] bg-[#111113] p-0.5 text-[13px]">
          {yearTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveYearTab(tab.value)}
              className={[
                "h-7 rounded px-3 transition cursor-pointer",
                activeYearTab === tab.value
                  ? "bg-white/[0.08] text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200",
              ].join(" ")}
            >
              <span>{tab.label}</span>
              <span className="ml-1.5 text-[12px] text-zinc-500">{tab.count}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 grid max-w-[760px] grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <input
            name="eventSearch"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={inputClass("min-w-0 flex-1")}
            placeholder="Search events..."
          />
          <button
            type="button"
            onClick={() => {
              setError(null);
              setPartnerName("");
              setSelectedResponsePartnerId("");
              setSelectedDirectorIds([]);
              setTierConfigs([]);
              setSelectedId(null);
              setMode("create");
              window.history.replaceState(null, "", "/events");
            }}
            className="inline-flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-md bg-zinc-700 px-3.5 text-[13px] font-medium text-white transition hover:bg-zinc-600 md:w-auto cursor-pointer"
          >
            <Plus className="size-4" strokeWidth={1.8} />
            New event
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-md border border-white/[0.09] bg-[#111113]">
          <div className="grid min-w-0 grid-cols-1 border-b border-white/[0.08] px-4 py-2.5 text-[12px] text-zinc-500 md:grid-cols-[minmax(140px,1fr)_64px_120px_140px]">
            <span className="min-w-0"><SortHeader label="Name" sortKey="name" activeKey={sortKey} direction={sortDirection} onSort={sortEvents} /></span>
            <span className="hidden min-w-0 md:block"><SortHeader label="Year" sortKey="year" activeKey={sortKey} direction={sortDirection} onSort={sortEvents} /></span>
            <span className="hidden min-w-0 md:block"><SortHeader label="Partners" sortKey="partners" activeKey={sortKey} direction={sortDirection} onSort={sortEvents} /></span>
            <span className="hidden min-w-0 md:block"><SortHeader label="Start" sortKey="start" activeKey={sortKey} direction={sortDirection} onSort={sortEvents} /></span>
          </div>
          <div className="max-h-[62vh] overflow-auto">
            {filteredEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => {
                  setError(null);
                  setPartnerName("");
                  setSelectedResponsePartnerId("");
                  setSelectedDirectorIds(event.directors.map((director) => director.id));
                  setTierConfigs(event.tierConfigs.map((preset) => ({ ...preset })));
                  setSelectedId(event.id);
                  setMode("view");
                  window.history.replaceState(null, "", `/events?eventId=${event.id}`);
                }}
                className={["grid min-w-0 w-full grid-cols-1 items-center border-b border-white/[0.06] px-4 py-3.5 text-left text-[13px] text-zinc-300 transition hover:bg-white/[0.035] md:grid-cols-[minmax(140px,1fr)_64px_120px_140px] cursor-pointer",
                  selected?.id === event.id && mode !== "closed" && mode !== "create" ? "bg-white/[0.055]" : "",
                ].join(" ")}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-zinc-100">{event.name}</span>
                  <span className="mt-1 block text-[12px] text-zinc-500 md:hidden">
                    {[event.year, partnerGoalText(event), formatDate(event.startDate)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="hidden min-w-0 truncate md:block">{event.year ?? ""}</span>
                <span className="hidden min-w-0 truncate md:block">{partnerGoalText(event)}</span>
                <span className="hidden min-w-0 truncate md:block">{formatDate(event.startDate)}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-white/[0.08] px-4 py-4 text-[13px] text-zinc-500">
            {filteredEvents.length} events
          </div>
        </div>
      </section>

      {panelOpen ? (
        <aside className="flex h-[calc(100dvh-50px)] w-full max-w-[100dvw] min-w-0 flex-col overflow-hidden border-l border-white/[0.08] bg-[#111113] xl:h-[100dvh]">
          <div className="flex h-14 shrink-0 min-w-0 items-center gap-3 border-b border-white/[0.08] px-5">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <button
                type="button"
                aria-label="Back to events list"
                onClick={() => {
                  setMode("closed");
                  setPartnerName("");
                  setSelectedResponsePartnerId("");
                  window.history.replaceState(null, "", "/events");
                }}
                className="shrink-0 text-zinc-500 hover:text-white cursor-pointer"
              >
                <ArrowLeft className="size-5" strokeWidth={1.8} />
              </button>
              <h3 className="truncate text-[17px] font-medium text-white">
                {mode === "create" ? "New event" : selected?.name ?? "Event details"}
              </h3>
              {mode === "view" && selected ? (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode("edit");
                  }}
                  className="hidden h-8 shrink-0 items-center gap-1.5 rounded-md border border-white/[0.1] px-2.5 text-[12px] font-medium text-zinc-300 transition hover:bg-white/[0.05] hover:text-white sm:inline-flex cursor-pointer"
                >
                  <Pencil className="size-3.5" strokeWidth={1.8} />
                  Edit event
                </button>
              ) : null}
              <button
                type="button"
                aria-label="Close event panel"
                onClick={() => {
                  setMode("closed");
                  setSelectedId(null);
                  setPartnerName("");
                  setSelectedResponsePartnerId("");
                  window.history.replaceState(null, "", "/events");
                }}
                className="grid size-7 shrink-0 place-items-center rounded-md border border-white/[0.12] bg-white/[0.055] text-zinc-300 transition hover:border-red-400/30 hover:bg-red-500/15 hover:text-red-200 xl:hidden cursor-pointer"
              >
                <X className="size-4" strokeWidth={1.8} />
              </button>
            </div>
            <button
              type="button"
              aria-label="Close event panel"
              onClick={() => {
                setMode("closed");
                setSelectedId(null);
                setPartnerName("");
                setSelectedResponsePartnerId("");
                window.history.replaceState(null, "", "/events");
              }}
              className="hidden size-8 shrink-0 place-items-center rounded-md border border-white/[0.12] bg-white/[0.055] text-zinc-300 transition hover:border-red-400/30 hover:bg-red-500/15 hover:text-red-200 xl:grid cursor-pointer"
            >
              <X className="size-5" strokeWidth={1.8} />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 min-w-0 space-y-4 overflow-auto px-5 py-5">
              {mode !== "create" && selected ? (
                <section className="rounded-md border border-white/[0.09] bg-[#0d0e11] p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-zinc-100">{selected.name}</p>
                      <p className="mt-1 text-[12px] text-zinc-500">
                        {[selected.year, formatDate(selected.startDate), partnerGoalText(selected)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/[0.055] px-2 py-1 text-[12px] text-zinc-400">
                      {selected.partnerResponses.length} people
                    </span>
                  </div>
                  {selected.directors.length ? (
                    <div className="mt-4 rounded-md border border-white/[0.08] bg-white/[0.018] p-3">
                      <p className="text-[12px] font-medium text-zinc-300">BizTech directors</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {selected.directors.map((director) => (
                          <span
                            key={director.id}
                            className="inline-flex items-center rounded-full bg-white/[0.07] px-2.5 py-1 text-[12px] text-zinc-200"
                          >
                            {director.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 grid gap-2">
                    {selectedRoleGroups.length ? (
                      selectedRoleGroups.map((group) => (
                        <div key={group.value} className="rounded-md border border-white/[0.08] bg-white/[0.018]">
                          <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-3 py-2">
                            <p className="text-[12px] font-medium text-zinc-300">{group.label}</p>
                            <span className="text-[12px] text-zinc-500">{group.responses.length}</span>
                          </div>
                          <div className="divide-y divide-white/[0.055]">
                            {group.responses.map((response) => (
                              <div key={`summary-${response.partnerId}-${response.eventRole}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2.5 text-[13px]">
                                <span className="min-w-0">
                                  <a
                                    href={`/partners?partnerId=${response.partnerId}`}
                                    className="block truncate font-medium text-zinc-100 transition hover:text-white hover:underline hover:underline-offset-4"
                                  >
                                    {response.partnerName}
                                  </a>
                                  <span className="block truncate text-[12px] text-zinc-500">{response.companyName}</span>
                                </span>
                                <span className={`shrink-0 rounded-md px-2 py-1 text-[12px] ${responseStatusTone(response.eventStatus)}`}>
                                  {eventStatusLabel(response.eventStatus)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-md border border-white/[0.08] px-3 py-3 text-[13px] text-zinc-500">No people linked to this event yet.</p>
                    )}
                  </div>
                  {mode === "view" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setMode("edit");
                      }}
                      className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.1] px-2.5 text-[12px] font-medium text-zinc-300 transition hover:bg-white/[0.05] hover:text-white sm:hidden cursor-pointer"
                    >
                      <Pencil className="size-3.5" strokeWidth={1.8} />
                      Edit event details
                    </button>
                  ) : null}
                </section>
              ) : null}
              {mode === "create" || mode === "edit" ? (
                <form id="event-detail-form" onSubmit={mode === "create" ? submitCreate : submitUpdate} className="space-y-4">
                  <Field label="Name"><input name="name" required defaultValue={mode === "edit" ? selected?.name : ""} className={inputClass()} /></Field>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Year"><input name="year" type="number" defaultValue={mode === "edit" ? selected?.year ?? "" : ""} className={inputClass()} /></Field>
                    <Field label="Confirmed partner goal"><input name="confirmedPartnerGoal" type="number" min="0" step="1" defaultValue={mode === "edit" ? selected?.confirmedPartnerGoal ?? "" : ""} className={inputClass()} /></Field>
                    <Field label="Sponsorship goal CAD"><input name="sponsorshipGoal" type="number" min="0" step="1" defaultValue={mode === "edit" && selected?.sponsorshipGoal ? selected.sponsorshipGoal / 100 : ""} className={inputClass()} /></Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Start date"><input name="startDate" required type="date" defaultValue={mode === "edit" ? selected?.startDate : ""} className={inputClass()} /></Field>
                    <Field label="End date"><input name="endDate" type="date" defaultValue={mode === "edit" ? selected?.endDate ?? "" : ""} className={inputClass()} /></Field>
                  </div>
                  <Field label="Outreach start"><input name="outreachStartDate" type="date" defaultValue={mode === "edit" ? selected?.outreachStartDate ?? "" : ""} className={inputClass()} /></Field>
                  <Field label="BizTech directors">
                    <DirectorMultiSelect
                      directors={directors}
                      selectedIds={selectedDirectorIds}
                      onChange={setSelectedDirectorIds}
                    />
                  </Field>
                  <Field label="Tier presets">
                    <TierPresetEditor presets={tierConfigs} onChange={setTierConfigs} />
                  </Field>
                  <Field label="Notes"><textarea name="notes" rows={4} defaultValue={mode === "edit" ? selected?.notes ?? "" : ""} className={inputClass("h-auto py-2")} /></Field>
                  <label className="flex items-center gap-2 text-[13px] text-zinc-300">
                    <input name="archived" type="checkbox" defaultChecked={mode === "edit" ? selected?.archived : false} className="size-4 accent-zinc-400" />
                    Archived
                  </label>
                </form>
              ) : null}
              {mode !== "create" && selected ? (
                <div className="rounded-md border border-white/[0.09] bg-[#0d0e11] p-4">
                  <div className="grid gap-1">
                    <p className="text-[13px] font-medium text-zinc-200">People at this event</p>
                    <p className="text-[12px] text-zinc-500">
                      {selected.partnerResponses.length} linked · {partnerGoalText(selected)}
                    </p>
                  </div>
                  <form onSubmit={submitPartnerResponse} className="mt-4 grid gap-3">
                    <Field label="Person">
                      <PartnerCombo
                        partners={partners}
                        value={partnerName}
                        onChange={setPartnerName}
                        selectedId={selectedResponsePartnerId}
                        onSelect={setSelectedResponsePartnerId}
                      />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Event role">
                        <select name="eventRole" required className={inputClass()}>
                          {eventRoles.map((role) => (
                            <option key={role.value} value={role.value}>{role.label}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Status">
                        <select name="eventStatus" required defaultValue="asked" className={inputClass()}>
                          {eventStatuses.map((status) => (
                            <option key={status.value} value={status.value}>{status.label}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    {partnerName.trim() && !partnerMatch ? (
                      <div key={partnerName} className="grid gap-3 rounded-md border border-white/[0.08] bg-white/[0.025] p-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="New partner first name"><input name="firstName" defaultValue={pendingPartnerName.firstName} className={inputClass()} /></Field>
                          <Field label="New partner last name"><input name="lastName" defaultValue={pendingPartnerName.lastName} className={inputClass()} /></Field>
                        </div>
                        <Field label="Company"><input name="companyName" required placeholder="Company name" className={inputClass()} /></Field>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Email"><input name="email" type="email" placeholder="email@company.com" className={inputClass()} /></Field>
                          <Field label="LinkedIn"><input name="linkedin" placeholder="https://linkedin.com/in/..." className={inputClass()} /></Field>
                        </div>
                        <ContactRequirementHint />
                        <Field label="Title"><input name="role" placeholder="Founder, Recruiter, Engineering Manager" className={inputClass()} /></Field>
                      </div>
                    ) : null}
                    <button disabled={isPending} className="h-9 w-fit rounded-md bg-zinc-700 px-4 text-[13px] font-medium text-white transition hover:bg-zinc-600 disabled:opacity-60 cursor-pointer">
                      Add person to event
                    </button>
                  </form>
                  <div className="mt-4 w-full max-w-[760px] overflow-hidden rounded-md border border-white/[0.08]">
                    {selected.partnerResponses.length ? (
                      <div className="divide-y divide-white/[0.06]">
                        <div className="hidden grid-cols-[minmax(0,1fr)_132px_132px_auto] gap-3 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.02em] text-zinc-500 sm:grid">
                          <span>Partner</span>
                          <span>Role</span>
                          <span>Status</span>
                          <span className="sr-only">Actions</span>
                        </div>
                        {selected.partnerResponses.map((response) => (
                          <div key={`${response.partnerId}-${response.eventRole}`} className="grid gap-2 px-3 py-2.5 text-[13px] sm:grid-cols-[minmax(0,1fr)_132px_132px_auto] sm:items-center sm:gap-3">
                            <div className="min-w-0">
                              <span className="min-w-0 flex-1">
                                <a
                                  href={`/partners?partnerId=${response.partnerId}`}
                                  className="block truncate font-medium text-zinc-100 transition hover:text-white hover:underline hover:underline-offset-4"
                                >
                                  {response.partnerName}
                                </a>
                                <span className="mt-0.5 block truncate text-[12px] text-zinc-500">{response.companyName}</span>
                              </span>
                            </div>
                            <span className="min-w-0 truncate text-zinc-300">{eventRoleLabel(response.eventRole)}</span>
                            <select
                              value={response.eventStatus}
                              disabled={isPending}
                              onChange={(event) => {
                                const eventStatus = event.currentTarget.value as EventAttendanceStatus;
                                startTransition(async () => {
                                  await updatePartnerEventStatusAction({
                                    partnerId: response.partnerId,
                                    eventId: selected.id,
                                    eventRole: response.eventRole,
                                    eventStatus,
                                  });
                                  router.refresh();
                                });
                              }}
                              aria-label={`${response.partnerName} confirmation status`}
                              className={inputClass("h-8 px-2 text-[12px]")}
                            >
                              {eventStatuses.map((status) => (
                                <option key={status.value} value={status.value}>{status.label}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                if (!window.confirm("Remove this person from the event?")) return;
                                startTransition(async () => {
                                  await removePartnerEventRoleAction({
                                    partnerId: response.partnerId,
                                    eventId: selected.id,
                                    eventRole: response.eventRole,
                                  });
                                  router.refresh();
                                });
                              }}
                              className="inline-flex size-8 shrink-0 items-center justify-center justify-self-start rounded-md text-zinc-500 transition hover:bg-red-500/10 hover:text-red-200 sm:justify-self-end cursor-pointer"
                              aria-label={`Remove ${response.partnerName} ${eventRoleLabel(response.eventRole)} ${eventStatusLabel(response.eventStatus)} response`}
                            >
                              <Trash2 className="size-4" strokeWidth={1.8} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="px-3 py-3 text-[13px] text-zinc-500">No people linked to this event yet.</p>
                    )}
                  </div>
                </div>
              ) : null}
              {error && <p className="rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2 text-[13px] text-red-200">{error}</p>}
            </div>
            {mode === "create" || mode === "edit" ? (
              <div className="shrink-0 border-t border-white/[0.08] bg-[#0d0e11] px-5 py-4">
                <button form="event-detail-form" type="submit" disabled={isPending} className="h-9 rounded-md bg-zinc-700 px-4 text-[13px] font-medium text-white transition hover:bg-zinc-600 disabled:opacity-60 cursor-pointer">
                  {mode === "create" ? "Create event" : "Save changes"}
                </button>
              </div>
            ) : null}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
