import Link from "next/link";
import { CrmShell } from "@/components/crm-shell";
import { requireDisplayUser } from "@/lib/auth/session-display";
import {
  getCachedDashboard,
  listCachedCurrentPipeline,
} from "@/lib/partnerships/cached";
import type { CrmStatus, CurrentPipelineRecord } from "@/lib/partnerships/types";

const activeStatuses = new Set<CrmStatus>([
  "prospecting",
  "pitched",
  "reached_out",
  "shortlist",
  "in_conversation",
  "followed_up",
]);

const securedStatuses = new Set<CrmStatus>(["confirmed", "paid"]);

const statusLabels: Record<CrmStatus, string> = {
  prospecting: "In conversation",
  pitched: "In conversation",
  reached_out: "In conversation",
  shortlist: "In conversation",
  in_conversation: "In conversation",
  followed_up: "Needs outreach",
  confirmed: "Awaiting payment",
  paid: "Paid",
  declined: "Declined",
  backed_out: "Backed out",
};

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format((value ?? 0) / 100);
}

function formatDate(value: string | null) {
  if (!value) return "No reminder";
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function dueLevel(value: string | null) {
  if (!value) return "none";
  const today = new Date().toISOString().slice(0, 10);
  if (value < today) return "overdue";
  if (value === today) return "today";
  return "scheduled";
}

function sum(records: CurrentPipelineRecord[]) {
  return records.reduce((total, record) => total + (record.amount ?? 0), 0);
}

function partnerGoalText(event: { confirmedPartnerCount: number; confirmedPartnerGoal: number | null }) {
  if (event.confirmedPartnerGoal) return `${event.confirmedPartnerCount}/${event.confirmedPartnerGoal} confirmed`;
  return `${event.confirmedPartnerCount} confirmed`;
}

function groupPipelineStatus(status: CrmStatus) {
  if (["prospecting", "pitched", "reached_out", "shortlist", "in_conversation"].includes(status)) return "In conversation";
  if (status === "followed_up") return "Needs outreach";
  if (status === "confirmed") return "Awaiting payment";
  return statusLabels[status];
}

const conversationOrder = new Map([
  ["In conversation", 0],
  ["Needs outreach", 1],
  ["Awaiting payment", 2],
  ["Paid", 3],
  ["Declined", 4],
  ["Backed out", 5],
]);

function StatusCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <div className="rounded-md border border-white/[0.08] bg-[#111113] px-4 py-3">
      <p className="text-[12px] font-medium text-zinc-500">{label}</p>
      <p className="mt-2 text-[20px] font-medium tracking-tight text-zinc-100">{value}</p>
      <p className="mt-1 truncate text-[12px] text-zinc-500">{subtext}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const [{ displayName }, dashboard, records] = await Promise.all([
    requireDisplayUser(),
    getCachedDashboard(),
    listCachedCurrentPipeline(),
  ]);

  const active = records.filter((record) => activeStatuses.has(record.status));
  const secured = records.filter((record) => securedStatuses.has(record.status) && (record.amount ?? 0) > 0);
  const acceptedUnpaid = records.filter((record) => record.status === "confirmed" && (record.amount ?? 0) > 0);
  const paid = records.filter((record) => record.status === "paid");
  const due = active
    .filter((record) => {
      const level = dueLevel(record.followUpDate);
      return level === "overdue" || level === "today";
    })
    .sort((left, right) => String(left.followUpDate).localeCompare(String(right.followUpDate)));
  const upcoming = dashboard.upcomingFollowUps.slice(0, 6);
  const securedByEvent = dashboard.events
    .filter((event) => !event.archived)
    .map((event) => {
      const progress = event.sponsorshipGoal
        ? Math.min(100, Math.round((event.securedValue / event.sponsorshipGoal) * 100))
        : 0;
      return { ...event, progress };
    })
    .sort((left, right) => right.securedValue - left.securedValue)
    .slice(0, 5);
  const conversationMix = Array.from(
    records.reduce((map, record) => {
      if (record.status === "confirmed" && (record.amount ?? 0) <= 0) return map;
      const label = groupPipelineStatus(record.status);
      const current = map.get(label) ?? { label, count: 0, value: 0 };
      current.count += 1;
      current.value += record.amount ?? 0;
      map.set(label, current);
      return map;
    }, new Map<string, { label: string; count: number; value: number }>()),
  ).map(([, value]) => value)
    .sort((left, right) => (conversationOrder.get(left.label) ?? 99) - (conversationOrder.get(right.label) ?? 99));

  return (
    <CrmShell
      displayName={displayName}
      activeSection="dashboard"
    >
      <div className="min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-[#0d0d0f] px-3 py-4 text-zinc-100 sm:px-5 sm:py-5">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-[15px] font-medium text-zinc-100">Dashboard</h2>
          <div className="flex w-full min-w-0 flex-col gap-2 lg:w-auto lg:items-center lg:justify-end">
            <p className="text-[12px] text-zinc-500">
              {active.length} open · {acceptedUnpaid.length} awaiting payment · {due.length} due
            </p>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Link
                href="/pipeline"
                className="inline-flex h-8 items-center rounded-md border border-white/[0.09] px-3 text-[12px] font-medium text-zinc-400 transition hover:bg-white/[0.045] hover:text-zinc-100"
              >
                Open pipeline
              </Link>
              <Link
                href="/outreach"
                className="inline-flex h-8 items-center rounded-md bg-zinc-700 px-3 text-[12px] font-medium text-white transition hover:bg-zinc-600"
              >
                Outreach
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatusCard
            label="Total raised"
            value={formatCurrency(dashboard.securedValue)}
            subtext={`${formatCurrency(sum(paid))} paid`}
          />
          <StatusCard
            label="Open conversations"
            value={String(active.length)}
            subtext={`${formatCurrency(dashboard.openPipelineValue)} in known asks`}
          />
          <StatusCard
            label="Awaiting payment"
            value={String(acceptedUnpaid.length)}
            subtext={`${formatCurrency(sum(acceptedUnpaid))} waiting on payment`}
          />
          <StatusCard
            label="Outreach due"
            value={String(due.length)}
            subtext={due.length ? "Needs action now" : "No reminders due"}
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <section className="min-w-0 rounded-md border border-white/[0.08] bg-[#111113]">
            <div className="border-b border-white/[0.07] px-4 py-3">
              <p className="text-[13px] font-medium text-zinc-200">Event status</p>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {securedByEvent.map((event) => (
                <div key={event.id} className="grid gap-3 px-4 py-3 text-[13px] md:grid-cols-[minmax(0,1fr)_150px_90px] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-100">{event.name}</p>
                    <p className="mt-1 text-[12px] text-zinc-500">
                      {formatCurrency(event.securedValue)} raised · {partnerGoalText(event)}
                    </p>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <div className="h-full rounded-full bg-zinc-300" style={{ width: `${event.progress}%` }} />
                  </div>
                  <p className="text-right text-[12px] text-zinc-500">{event.progress}%</p>
                </div>
              ))}
              {!securedByEvent.length && (
                <p className="px-4 py-4 text-[13px] text-zinc-500">No event goals yet.</p>
              )}
            </div>
          </section>

          <section className="min-w-0 rounded-md border border-white/[0.08] bg-[#111113]">
            <div className="border-b border-white/[0.07] px-4 py-3">
              <p className="text-[13px] font-medium text-zinc-200">Outreach queue</p>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {upcoming.map((record) => {
                const level = dueLevel(record.followUpDate);
                return (
                  <div key={record.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-zinc-100">{record.partnerName}</p>
                        <p className="mt-1 truncate text-[12px] text-zinc-500">{record.eventName ?? "No event"}</p>
                      </div>
                      <span
                        className={[
                          "shrink-0 rounded px-2 py-1 text-[11px]",
                          level === "overdue"
                            ? "bg-red-400/10 text-red-200"
                            : level === "today"
                              ? "bg-amber-300/10 text-amber-100"
                              : "bg-white/[0.055] text-zinc-400",
                        ].join(" ")}
                      >
                        {formatDate(record.followUpDate)}
                      </span>
                    </div>
                  </div>
                );
              })}
              {!upcoming.length && (
                <p className="px-4 py-4 text-[13px] text-zinc-500">No outreach due this week.</p>
              )}
            </div>
          </section>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <section className="min-w-0 rounded-md border border-white/[0.08] bg-[#111113]">
            <div className="border-b border-white/[0.07] px-4 py-3">
              <p className="text-[13px] font-medium text-zinc-200">Sponsor commitments</p>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {secured.slice(0, 6).map((record) => (
                <div key={record.id} className="grid gap-2 px-4 py-3 text-[13px] sm:grid-cols-[minmax(0,1fr)_120px_124px] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-100">{record.partnerName}</p>
                    <p className="mt-1 truncate text-[12px] text-zinc-500">{record.eventName ?? "No event"}</p>
                  </div>
                  <p className="text-zinc-400">{formatCurrency(record.amount)}</p>
                  <span className="w-fit whitespace-nowrap rounded bg-white/[0.055] px-2 py-1 text-[11px] text-zinc-400">
                    {statusLabels[record.status]}
                  </span>
                </div>
              ))}
              {!secured.length && (
                <p className="px-4 py-4 text-[13px] text-zinc-500">No sponsor commitments yet.</p>
              )}
            </div>
          </section>

          <section className="min-w-0 rounded-md border border-white/[0.08] bg-[#111113]">
            <div className="border-b border-white/[0.07] px-4 py-3">
              <p className="text-[13px] font-medium text-zinc-200">Live conversations</p>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {conversationMix.map((stage) => (
                <div key={stage.label} className="grid grid-cols-[minmax(0,1fr)_60px_100px] gap-3 px-4 py-3 text-[13px]">
                  <p className="truncate text-zinc-200">{stage.label}</p>
                  <p className="text-right text-zinc-500">{stage.count}</p>
                  <p className="text-right text-zinc-400">{formatCurrency(stage.value)}</p>
                </div>
              ))}
              {!conversationMix.length && (
                <p className="px-4 py-4 text-[13px] text-zinc-500">No conversations yet.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </CrmShell>
  );
}
