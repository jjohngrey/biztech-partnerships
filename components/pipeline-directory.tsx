"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Bell, Plus, X } from "lucide-react";
import { createSponsorshipAction, updateSponsorshipAction } from "@/lib/partnerships/actions";
import type {
  CompanyDirectoryRecord,
  CrmEventSummary,
  CrmStatus,
  CrmUserSummary,
  CurrentPipelineRecord,
  PartnerDirectoryRecord,
} from "@/lib/partnerships/types";

type PipelineView = "active" | "outcomes" | "all";
type PanelMode = "closed" | "create" | "edit";

type PipelineLane = {
  id: string;
  label: string;
  targetStatus: CrmStatus;
  statuses: CrmStatus[];
  matches?: (record: CurrentPipelineRecord) => boolean;
  emptyLabel?: string;
};

const openPipelineStatuses: CrmStatus[] = [
  "prospecting",
  "pitched",
  "reached_out",
  "shortlist",
  "in_conversation",
  "followed_up",
];

function needsReachOut(record: CurrentPipelineRecord) {
  return openPipelineStatuses.includes(record.status) && (record.status === "followed_up" || Boolean(record.followUpDate));
}

const activeLanes: PipelineLane[] = [
  {
    id: "in_conversation",
    label: "In conversation",
    targetStatus: "in_conversation",
    statuses: openPipelineStatuses,
    matches: (record) => openPipelineStatuses.includes(record.status) && !needsReachOut(record),
    emptyLabel: "No open conversations.",
  },
  {
    id: "to_reach_out_again",
    label: "Needs outreach",
    targetStatus: "followed_up",
    statuses: openPipelineStatuses,
    matches: needsReachOut,
    emptyLabel: "No outreach queued.",
  },
];

const acceptedLanes: PipelineLane[] = [
  {
    id: "accepted",
    label: "Committed",
    targetStatus: "confirmed",
    statuses: ["confirmed"],
  },
  {
    id: "paid",
    label: "Paid",
    targetStatus: "paid",
    statuses: ["paid"],
  },
];

const closedOutcomeLanes: PipelineLane[] = [
  {
    id: "declined",
    label: "Declined",
    targetStatus: "declined",
    statuses: ["declined"],
  },
  {
    id: "backed_out",
    label: "Backed out",
    targetStatus: "backed_out",
    statuses: ["backed_out"],
  },
];

const activeStatuses = new Set<CrmStatus>(activeLanes.flatMap((lane) => lane.statuses));
const outcomeLanes = [...acceptedLanes, ...closedOutcomeLanes];

const editableStatuses: CrmStatus[] = [
  "in_conversation",
  "followed_up",
  "confirmed",
  "paid",
  "declined",
  "backed_out",
];

const statusLabels: Record<CrmStatus, string> = {
  prospecting: "In conversation",
  reached_out: "In conversation",
  pitched: "In conversation",
  shortlist: "In conversation",
  in_conversation: "In conversation",
  followed_up: "Needs outreach",
  confirmed: "Committed",
  paid: "Paid",
  declined: "Declined",
  backed_out: "Backed out",
};

function laneForRecord(record: CurrentPipelineRecord, lanes: PipelineLane[]) {
  return lanes.find((lane) => (lane.matches ? lane.matches(record) : lane.statuses.includes(record.status)));
}

function titleStatus(status: string) {
  return statusLabels[status as CrmStatus] ?? status
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function inputClass(extra = "") {
  return [
    "h-9 min-w-0 max-w-full rounded-md border border-white/[0.09] bg-[#0d0e11] px-3 text-[13px] text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-400/70 focus:ring-2 focus:ring-zinc-400/15",
    extra,
  ].join(" ");
}

function selectClass(extra = "") {
  return inputClass(`appearance-none pr-9 ${extra}`);
}

function SelectShell({
  children,
}: {
  children: ReactNode;
}) {
  return <span className="relative block min-w-0 max-w-full">{children}</span>;
}

function formatCurrency(amount: number | null) {
  if (!amount) return null;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

function formatDate(date: string | null) {
  if (!date) return null;
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function dueState(record: CurrentPipelineRecord) {
  if (!record.followUpDate) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (record.followUpDate < today) return "overdue";
  if (record.followUpDate === today) return "today";
  return "scheduled";
}

function reminderLabel(state: ReturnType<typeof dueState>) {
  if (state === "overdue") return "Overdue";
  if (state === "today") return "Due today";
  return null;
}

function compare(left: string | null | undefined, right: string | null | undefined) {
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, { sensitivity: "base" });
}

function followUpPriority(record: CurrentPipelineRecord) {
  const state = dueState(record);
  if (state === "overdue") return 0;
  if (state === "today") return 1;
  if (state === "scheduled") return 2;
  return 3;
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

function parseOptionalCadCents(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true as const, value: undefined };
  const numericValue = Number(trimmed);
  if (!Number.isFinite(numericValue) || numericValue < 0) return { ok: false as const };
  return { ok: true as const, value: Math.round(numericValue * 100) };
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
        name="companyName"
        required
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
        placeholder="Search events or leave blank"
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
            <div className="px-3 py-2.5 text-[13px] text-zinc-500">No event will be linked</div>
          )}
        </div>
      )}
    </div>
  );
}

export function PipelineDirectory({
  records,
  partners,
  users,
  companies,
  events,
  initialConversationId,
}: {
  records: CurrentPipelineRecord[];
  partners: PartnerDirectoryRecord[];
  users: CrmUserSummary[];
  companies: CompanyDirectoryRecord[];
  events: CrmEventSummary[];
  initialConversationId?: string;
}) {
  const router = useRouter();
  const initialRecord = records.find((record) => record.id === initialConversationId) ?? null;
  const [query, setQuery] = useState("");
  const [view, setView] = useState<PipelineView>(initialRecord && !activeStatuses.has(initialRecord.status) ? "outcomes" : "active");
  const [selectedId, setSelectedId] = useState<string | null>(initialRecord?.id ?? null);
  const [panelMode, setPanelMode] = useState<PanelMode>(initialRecord ? "edit" : "closed");
  const [createCompanyName, setCreateCompanyName] = useState("");
  const [editCompanyName, setEditCompanyName] = useState("");
  const [createEventName, setCreateEventName] = useState("");
  const [editEventName, setEditEventName] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [localRecords, setLocalRecords] = useState(records);
  const [savingRecordIds, setSavingRecordIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const selected = panelMode === "edit" ? localRecords.find((record) => record.id === selectedId) ?? null : null;
  const panelOpen = panelMode !== "closed";
  const visibleLanes = useMemo(
    () =>
      view === "outcomes"
        ? outcomeLanes
        : view === "all"
          ? [...activeLanes, ...outcomeLanes]
          : activeLanes,
    [view],
  );
  const visibleStatuses = useMemo(
    () => new Set<CrmStatus>(visibleLanes.flatMap((lane) => lane.statuses)),
    [visibleLanes],
  );
  const createCompanyMatch = getCompanyMatch(companies, createCompanyName);
  const editCompanyValue = editCompanyName || selected?.partnerName || "";
  const editCompanyMatch = getCompanyMatch(companies, editCompanyValue);
  const activeCompanyId = panelMode === "create" ? createCompanyMatch?.id ?? "" : editCompanyMatch?.id ?? selected?.partnerId ?? "";
  const contactOptions = activeCompanyId ? partners.filter((partner) => partner.companyId === activeCompanyId) : [];

  useEffect(() => {
    setLocalRecords(records);
  }, [records]);

  const searchedRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = localRecords
      .filter((record) => {
        if (view === "all") return true;
        return visibleStatuses.has(record.status);
      })
      .filter((record) =>
        [record.partnerName, record.eventName, record.primaryContactName, record.ownerName, record.tier, record.notes, record.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
      );
    return [...filtered].sort((left, right) => {
      const priority = followUpPriority(left) - followUpPriority(right);
      if (priority !== 0) return priority;
      const followUp = compare(left.followUpDate, right.followUpDate);
      if (followUp !== 0) return followUp;
      const company = compare(left.partnerName, right.partnerName);
      if (company !== 0) return company;
      return compare(right.updatedAtIso, left.updatedAtIso);
    });
  }, [query, localRecords, view, visibleStatuses]);

  const grouped = useMemo(() => {
    const map = new Map<string, CurrentPipelineRecord[]>();
    for (const lane of visibleLanes) map.set(lane.id, []);
    for (const record of searchedRecords) {
      const lane = laneForRecord(record, visibleLanes) ?? visibleLanes[0];
      if (!lane) continue;
      map.get(lane.id)?.push(record);
    }
    return map;
  }, [searchedRecords, visibleLanes]);

  const summary = useMemo(() => {
    const due = localRecords.filter((record) => {
      const state = dueState(record);
      return state === "overdue" || state === "today";
    }).length;
    const active = localRecords.filter((record) => activeStatuses.has(record.status)).length;
    const toReachOutAgain = localRecords.filter(needsReachOut).length;
    return { due, active, toReachOutAgain };
  }, [localRecords]);

  function closePanel() {
    setPanelMode("closed");
    setSelectedId(null);
    setCreateCompanyName("");
    setEditCompanyName("");
    setCreateEventName("");
    setEditEventName("");
    setError(null);
    window.history.replaceState(null, "", "/pipeline");
  }

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const amountValue = String(data.get("amount") ?? "").trim();
    const eventId = String(data.get("eventId") ?? "");
    const amount = parseOptionalCadCents(amountValue);
    if (!amount.ok) {
      setError("Amount must be a valid non-negative number.");
      return;
    }
    startTransition(async () => {
      try {
        await createSponsorshipAction({
          companyId: String(data.get("companyId") ?? ""),
          companyName: String(data.get("companyName") ?? ""),
          eventId: eventId || undefined,
          status: String(data.get("status")) as CrmStatus,
          tier: String(data.get("tier") ?? ""),
          role: String(data.get("role") ?? ""),
          followUpDate: String(data.get("followUpDate") ?? ""),
          notes: String(data.get("notes") ?? ""),
          primaryContactId: String(data.get("primaryContactId") ?? ""),
          ownerUserId: String(data.get("ownerUserId") ?? ""),
          amount: amount.value,
        });
        form.reset();
        closePanel();
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not create conversation.");
      }
    });
  }

  function submitUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError(null);
    const data = new FormData(event.currentTarget);
    const amountValue = String(data.get("amount") ?? "").trim();
    const eventId = String(data.get("eventId") ?? "");
    const amount = parseOptionalCadCents(amountValue);
    if (!amount.ok) {
      setError("Amount must be a valid non-negative number.");
      return;
    }
    const previousRecord = selected;
    const nextStatus = String(data.get("status")) as CrmStatus;
    const companyName = String(data.get("companyName") ?? "").trim() || selected.partnerName;
    const eventName = String(data.get("eventName") ?? "").trim() || null;
    const primaryContactId = String(data.get("primaryContactId") ?? "");
    const ownerUserId = String(data.get("ownerUserId") ?? "");
    const primaryContact = partners.find((partner) => partner.id === primaryContactId) ?? null;
    const owner = users.find((user) => user.id === ownerUserId) ?? null;
    const nextUpdatedAt = new Date().toISOString();

    setLocalRecords((current) =>
      current.map((record) =>
        record.id === selected.id
          ? {
              ...record,
              partnerName: companyName,
              eventId: eventId || null,
              eventName,
              primaryContactId: primaryContactId || null,
              primaryContactName: primaryContact?.name ?? null,
              ownerUserId: ownerUserId || null,
              ownerName: owner?.name ?? null,
              amount: amount.value ?? null,
              tier: String(data.get("tier") ?? "").trim() || null,
              status: nextStatus,
              role: String(data.get("role") ?? "").trim() || null,
              followUpDate: String(data.get("followUpDate") ?? "") || null,
              notes: String(data.get("notes") ?? "").trim() || null,
              updatedAtIso: nextUpdatedAt,
            }
          : record,
      ),
    );

    startTransition(async () => {
      try {
        await updateSponsorshipAction({
          id: selected.id,
          companyId: String(data.get("companyId") ?? ""),
          companyName: String(data.get("companyName") ?? ""),
          eventId: eventId || null,
          status: nextStatus,
          tier: String(data.get("tier") ?? ""),
          role: String(data.get("role") ?? ""),
          followUpDate: String(data.get("followUpDate") ?? ""),
          notes: String(data.get("notes") ?? ""),
          primaryContactId: String(data.get("primaryContactId") ?? ""),
          ownerUserId: String(data.get("ownerUserId") ?? ""),
          amount: amount.value,
        });
        router.refresh();
      } catch (cause) {
        setLocalRecords((current) =>
          current.map((record) => (record.id === previousRecord.id ? previousRecord : record)),
        );
        setError(cause instanceof Error ? cause.message : "Could not update conversation.");
      }
    });
  }

  function moveRecord(recordId: string, status: CrmStatus) {
    const record = localRecords.find((item) => item.id === recordId);
    if (!record) return;
    setError(null);
    const previousRecord = record;
    const nextUpdatedAt = new Date().toISOString();
    const nextFollowUpDate = status === "followed_up" ? record.followUpDate : null;
    if (record.status === status && record.followUpDate === nextFollowUpDate) return;
    setDraggedId(null);
    setSavingRecordIds((current) => new Set(current).add(recordId));
    setLocalRecords((current) =>
      current.map((item) =>
        item.id === recordId
          ? { ...item, status, followUpDate: nextFollowUpDate, updatedAtIso: nextUpdatedAt }
          : item,
      ),
    );
    startTransition(async () => {
      try {
        await updateSponsorshipAction({
          id: record.id,
          status,
          tier: record.tier ?? "",
          role: record.role ?? "",
          followUpDate: nextFollowUpDate ?? "",
          notes: record.notes ?? "",
          primaryContactId: record.primaryContactId ?? "",
          ownerUserId: record.ownerUserId ?? "",
          amount: record.amount ?? undefined,
        });
      } catch (cause) {
        setLocalRecords((current) =>
          current.map((item) =>
            item.id === recordId ? previousRecord : item,
          ),
        );
        setError(cause instanceof Error ? cause.message : "Could not move conversation.");
      } finally {
        setSavingRecordIds((current) => {
          const next = new Set(current);
          next.delete(recordId);
          return next;
        });
      }
    });
  }

  return (
    <div className={["grid min-h-[100dvh] w-full max-w-full grid-cols-1 overflow-x-hidden bg-[#0d0d0f] xl:overflow-hidden", panelOpen ? "xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]" : ""].join(" ")}>
      <section className={["min-w-0 px-3 py-4 sm:px-5 sm:py-5 xl:overflow-hidden", panelOpen ? "hidden xl:block" : ""].join(" ")}>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <h2 className="text-[15px] font-medium text-zinc-100">Pipeline</h2>
          <div className="hidden items-center gap-2 whitespace-nowrap text-[12px] text-zinc-500 lg:flex">
            <span>{summary.active} open</span>
            <span className={summary.toReachOutAgain ? "text-amber-200" : ""}>{summary.toReachOutAgain} outreach</span>
            <span className={summary.due ? "text-amber-200" : ""}>{summary.due} due</span>
          </div>
        </div>

        <div className="mt-4 grid min-w-0 gap-2">
          <input
            name="pipelineSearch"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={inputClass("w-full")}
            placeholder="Search conversations..."
          />
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-white/[0.08] bg-[#111113] p-1">
              {[
                ["active", "Open"],
                ["outcomes", "Outcomes"],
                ["all", "All"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setView(key as PipelineView)}
                  className={["h-7 rounded px-2.5 text-[12px] font-medium transition cursor-pointer",
                    view === key ? "bg-white/[0.08] text-zinc-100" : "text-zinc-500 hover:text-zinc-200",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                setCreateCompanyName("");
                setEditCompanyName("");
                setCreateEventName("");
                setEditEventName("");
                setPanelMode("create");
                setError(null);
                window.history.replaceState(null, "", "/pipeline");
              }}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-zinc-700 px-3.5 text-[13px] font-medium text-white transition hover:bg-zinc-600 cursor-pointer"
            >
              <Plus className="size-4" strokeWidth={1.8} />
              New conversation
            </button>
          </div>
        </div>

        <div className="mt-5 min-h-0 overflow-visible pb-3 xl:h-[calc(100dvh-132px)] xl:overflow-hidden">
          <div
            className={[
              "grid h-full min-w-0 grid-cols-1 gap-3",
              visibleLanes.length > 4
                ? "lg:grid-cols-2 2xl:grid-cols-3"
                : visibleLanes.length > 2
                  ? "lg:grid-cols-2 2xl:grid-cols-4"
                  : "lg:grid-cols-2",
            ].join(" ")}
          >
            {visibleLanes.map((lane) => {
              const laneRecords = grouped.get(lane.id) ?? [];
              return (
                <div
                  key={lane.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggedId) moveRecord(draggedId, lane.targetStatus);
                  }}
                  className={[
                    "flex min-h-0 min-w-0 flex-col rounded-md border bg-[#111113] transition xl:min-h-0",
                    draggedId ? "border-zinc-400/40 bg-[#141519]" : "border-white/[0.08]",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-2.5">
                    <span className="text-[12px] font-medium text-zinc-300">{lane.label}</span>
                    <span className="rounded-full bg-white/[0.055] px-2 py-0.5 text-[11px] text-zinc-500">{laneRecords.length}</span>
                  </div>
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                    {laneRecords.map((record) => {
                      const state = dueState(record);
                      const active = selected?.id === record.id;
                      const amount = formatCurrency(record.amount);
                      const dueLabel = formatDate(record.followUpDate);
                      const reminder = reminderLabel(state);
                      const reachOutAgain = needsReachOut(record);
                      const needsPayment = record.status === "confirmed";
                      const saving = savingRecordIds.has(record.id);
                      return (
                        <div
                          key={record.id}
                          draggable
                          onDragStart={() => setDraggedId(record.id)}
                          onDragEnd={() => setDraggedId(null)}
                          className={[
                            "min-w-0 overflow-hidden rounded-md border p-2.5 transition",
                            active
                              ? "border-zinc-400/35 bg-white/[0.075]"
                              : "border-white/[0.07] bg-[#15161a] hover:border-white/[0.12] hover:bg-white/[0.055]",
                          ].join(" ")}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setError(null);
                              setSelectedId(record.id);
                              setEditCompanyName(record.partnerName);
                              setEditEventName(record.eventName ?? "");
                              setPanelMode("edit");
                              window.history.replaceState(null, "", `/pipeline?conversationId=${record.id}`);
                            }}
                            className="block w-full text-left cursor-pointer"
                          >
                            <span className="flex items-start justify-between gap-2">
                              <span className="min-w-0">
                                <span className="block truncate text-[13px] font-medium text-zinc-100">{record.partnerName}</span>
                                <span className="mt-0.5 block truncate text-[12px] text-zinc-500">{record.eventName ?? "No event"}</span>
                              </span>
                              {(state === "overdue" || state === "today") && (
                                <Bell className={state === "overdue" ? "size-4 shrink-0 text-red-300" : "size-4 shrink-0 text-amber-200"} strokeWidth={1.8} />
                              )}
                            </span>
                            <span className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                              {reminder && (
                                <span
                                  className={[
                                    "rounded px-1.5 py-0.5",
                                    state === "overdue"
                                      ? "bg-red-400/10 text-red-200"
                                      : "bg-amber-300/10 text-amber-100",
                                  ].join(" ")}
                                >
                                  {reminder}
                                </span>
                              )}
                              {needsPayment && (
                                <span className="rounded bg-white/[0.065] px-1.5 py-0.5 text-zinc-300">
                                  Awaiting payment
                                </span>
                              )}
                              {reachOutAgain && !reminder && (
                                <span className="rounded bg-amber-300/10 px-1.5 py-0.5 text-amber-100">
                                  Needs outreach
                                </span>
                              )}
                              {record.primaryContactName && <span className="rounded bg-white/[0.045] px-1.5 py-0.5">{record.primaryContactName}</span>}
                              {record.tier && <span className="rounded bg-white/[0.045] px-1.5 py-0.5">{record.tier}</span>}
                              {amount && <span className="rounded bg-white/[0.045] px-1.5 py-0.5">{amount}</span>}
                            </span>
                            <span className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                              <span className="truncate">{saving ? "Saving..." : record.ownerName ?? "No BizTech Director"}</span>
                              <span className={["truncate", state === "overdue" ? "text-red-300" : state === "today" ? "text-amber-200" : ""].join(" ")}>
                                {dueLabel ?? "No next outreach"}
                              </span>
                            </span>
                          </button>
                          <label className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                            <span>Move to</span>
                            <span className="relative block min-w-0 flex-1 sm:max-w-[220px]">
                              <select
                                name={`pipelineMove-${record.id}`}
                                value={laneForRecord(record, [...activeLanes, ...acceptedLanes, ...closedOutcomeLanes])?.targetStatus ?? record.status}
                                onChange={(event) => moveRecord(record.id, event.target.value as CrmStatus)}
                                disabled={saving}
                                className={selectClass("h-8 w-full text-[12px]")}
                              >
                                {editableStatuses.map((status) => <option key={status} value={status}>{titleStatus(status)}</option>)}
                              </select>
                            </span>
                          </label>
                        </div>
                      );
                    })}
                    {!laneRecords.length && (
                      <div className="rounded-md border border-dashed border-white/[0.07] px-3 py-4 text-[12px] text-zinc-600 sm:py-6">
                        {lane.emptyLabel ?? "No conversations in this lane."}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {panelOpen ? (
        <aside className="flex h-[calc(100dvh-50px)] w-full max-w-[100dvw] min-w-0 flex-col overflow-hidden border-l border-white/[0.08] bg-[#111113] xl:h-[100dvh]">
          <div className="flex h-14 shrink-0 min-w-0 items-center gap-3 border-b border-white/[0.08] px-5">
            <button
              type="button"
              aria-label="Close conversation panel"
              onClick={closePanel}
              className="grid size-7 shrink-0 place-items-center rounded-md border border-white/[0.12] bg-white/[0.055] text-zinc-300 transition hover:border-red-400/30 hover:bg-red-500/15 hover:text-red-200 xl:hidden cursor-pointer">
              <X className="size-4" strokeWidth={1.8} />
            </button>
            <h3 className="min-w-0 flex-1 truncate text-[16px] font-medium text-zinc-100">
              {panelMode === "create" ? "New conversation" : selected?.partnerName ?? "Conversation"}
            </h3>
            <button
              type="button"
              aria-label="Close conversation panel"
              onClick={closePanel}
              className="hidden size-8 shrink-0 place-items-center rounded-md border border-white/[0.12] bg-white/[0.055] text-zinc-300 transition hover:border-red-400/30 hover:bg-red-500/15 hover:text-red-200 xl:grid cursor-pointer">
              <X className="size-5" strokeWidth={1.8} />
            </button>
          </div>
          <form
            id="pipeline-conversation-form"
            key={panelMode === "create" ? "create" : selected?.id ?? "edit"}
            onSubmit={panelMode === "create" ? submitCreate : submitUpdate}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <label className="grid gap-1.5 text-[12px] font-medium text-zinc-400">
                Company
                <CompanyCombo
                  companies={companies}
                  value={panelMode === "create" ? createCompanyName : editCompanyValue}
                  onChange={panelMode === "create" ? setCreateCompanyName : setEditCompanyName}
                />
              </label>
              <label className="grid gap-1.5 text-[12px] font-medium text-zinc-400">
                Event
                <EventCombo
                  events={events}
                  value={panelMode === "create" ? createEventName : editEventName || selected?.eventName || ""}
                  onChange={panelMode === "create" ? setCreateEventName : setEditEventName}
                />
              </label>
              <label className="grid gap-1.5 text-[12px] font-medium text-zinc-400">
                Status
                <SelectShell>
                  <select name="status" defaultValue={selected ? laneForRecord(selected, [...activeLanes, ...acceptedLanes, ...closedOutcomeLanes])?.targetStatus ?? selected.status : "in_conversation"} className={selectClass("w-full")}>
                    {editableStatuses.map((status) => <option key={status} value={status}>{titleStatus(status)}</option>)}
                  </select>
                </SelectShell>
              </label>
              <label className="grid gap-1.5 text-[12px] font-medium text-zinc-400">
                Next outreach
                <input name="followUpDate" type="date" defaultValue={selected?.followUpDate ?? ""} className={inputClass()} />
              </label>
              <div className="grid gap-4">
                <label className="grid gap-1.5 text-[12px] font-medium text-zinc-400">
                  Package
                  <input name="tier" defaultValue={selected?.tier ?? ""} className={inputClass()} />
                </label>
                <label className="grid gap-1.5 text-[12px] font-medium text-zinc-400">
                  Ask amount CAD
                  <input name="amount" type="number" min="0" step="1" defaultValue={selected?.amount ? selected.amount / 100 : ""} className={inputClass()} />
                </label>
              </div>
              <label className="grid gap-1.5 text-[12px] font-medium text-zinc-400">
                Primary contact
                <SelectShell>
                  <select name="primaryContactId" defaultValue={selected?.primaryContactId ?? ""} className={selectClass("w-full")}>
                    <option value="">{activeCompanyId ? "No primary contact" : "Select a company first"}</option>
                    {contactOptions.map((partner) => (
                      <option key={partner.id} value={partner.id}>{partner.name} · {partner.companyName}</option>
                    ))}
                  </select>
                </SelectShell>
              </label>
              <label className="grid gap-1.5 text-[12px] font-medium text-zinc-400">
                BizTech Director
                <SelectShell>
                  <select name="ownerUserId" defaultValue={selected?.ownerUserId ?? ""} className={selectClass("w-full")}>
                    <option value="">No BizTech Director</option>
                    {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                  </select>
                </SelectShell>
              </label>
              <label className="grid gap-1.5 text-[12px] font-medium text-zinc-400">
                Ask
                <input name="role" defaultValue={selected?.role ?? ""} className={inputClass()} />
              </label>
              <label className="grid gap-1.5 text-[12px] font-medium text-zinc-400">
                Notes
                <textarea name="notes" rows={7} defaultValue={selected?.notes ?? ""} className={inputClass("h-auto py-2")} />
              </label>
              {error && <p className="rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2 text-[13px] text-red-200">{error}</p>}
            </div>
            <div className="shrink-0 border-t border-white/[0.08] bg-[#0d0e11] px-5 py-4">
              <button disabled={isPending} className="h-9 rounded-md bg-zinc-700 px-4 text-[13px] font-medium text-white transition hover:bg-zinc-600 disabled:opacity-60 cursor-pointer">
                {panelMode === "create" ? "Create conversation" : "Save conversation"}
              </button>
            </div>
          </form>
        </aside>
      ) : null}
    </div>
  );
}
