import { CrmShell } from "@/components/crm-shell";
import { ContactsCopyButton } from "@/components/contacts-copy-button";
import { requireDisplayUser } from "@/lib/auth/session-display";
import {
  getCachedDashboard,
  listCachedCurrentPipeline,
  listCachedMyAssignedEventIds,
  listCachedMyContactPartners,
} from "@/lib/partnerships/cached";
import type { CurrentPipelineRecord } from "@/lib/partnerships/types";

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format((value ?? 0) / 100);
}

function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

function sum(records: CurrentPipelineRecord[]) {
  return records.reduce((total, record) => total + (record.amount ?? 0), 0);
}

function partnerGoalText(event: {
  confirmedPartnerCount: number;
  confirmedPartnerGoal: number | null;
}) {
  if (event.confirmedPartnerGoal)
    return `${event.confirmedPartnerCount}/${event.confirmedPartnerGoal} confirmed`;
  return `${event.confirmedPartnerCount} confirmed`;
}

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
    <div className="rounded-md border border-white/8 bg-[#111113] px-4 py-3">
      <p className="text-[12px] font-medium text-zinc-500">{label}</p>
      <p className="mt-2 text-[20px] font-medium tracking-tight text-zinc-100">
        {value}
      </p>
      <p className="mt-1 truncate text-[12px] text-zinc-500">{subtext}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const { id: currentUserId, displayName, role } = await requireDisplayUser();
  const [dashboard, records, myContacts, myEventIds] = await Promise.all([
    getCachedDashboard(),
    listCachedCurrentPipeline(),
    listCachedMyContactPartners(currentUserId),
    listCachedMyAssignedEventIds(currentUserId),
  ]);
  const myEventIdSet = new Set(myEventIds);
  const myEvents = dashboard.events
    .filter((event) => myEventIdSet.has(event.id) && !event.archived)
    .map((event) => ({
      ...event,
      progress: event.sponsorshipGoal
        ? Math.min(
            100,
            Math.round((event.securedValue / event.sponsorshipGoal) * 100)
          )
        : 0,
    }))
    .sort((left, right) => left.startDate.localeCompare(right.startDate));

  const paid = records.filter((record) => record.status === "paid");

  return (
    <CrmShell displayName={displayName} activeSection="dashboard" isAdmin={role === "admin"}>
      <div className="min-h-dvh w-full max-w-full overflow-x-hidden bg-[#0d0d0f] px-3 py-4 text-zinc-100 sm:px-5 sm:py-5">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-[15px] font-medium text-zinc-100">Dashboard</h2>
        </div>

        <section className="mt-4 rounded-md border border-white/8 bg-[#111113]">
          <div className="border-b border-white/[0.07] px-4 py-3">
            <p className="text-[14px] font-medium text-zinc-200">Individual</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-white/6">
            <div>
              <div className="border-b border-white/[0.07] px-4 py-2.5">
                <p className="text-[12px] font-medium text-zinc-400">
                  Contacts · {myContacts.length}
                </p>
              </div>
              {myContacts.length === 0 ? (
                <p className="px-4 py-4 text-[12px] text-zinc-500">
                  No logged contact yet. Log a meeting or touchpoint to populate
                  this.
                </p>
              ) : (
                <ul className="divide-y divide-white/6">
                  {myContacts.map((contact) => (
                    <li
                      key={contact.partnerId}
                      className="px-4 py-3 flex justify-between"
                    >
                      <div>
                        <span className="block truncate font-semibold text-sm text-zinc-100">
                          {contact.partnerName}
                        </span>
                        <p className="mt-1 text-[12px] text-zinc-500">
                          {contact.companyName} · last contact{" "}
                          {formatShortDate(contact.lastContactedAt)}
                        </p>
                      </div>
                      {contact.email && (
                        <div className="mt-1">
                          <ContactsCopyButton email={contact.email} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="border-b border-white/[0.07] px-4 py-2.5">
                <p className="text-[12px] font-medium text-zinc-400">
                  Events · {myEvents.length}
                </p>
              </div>
              {myEvents.length === 0 ? (
                <p className="px-4 py-4 text-[12px] text-zinc-500">
                  No events assigned. Ask an admin to add you to an event.
                </p>
              ) : (
                <ul className="divide-y divide-white/6">
                  {myEvents.map((event) => (
                    <li
                      key={event.id}
                      className="grid gap-2 px-4 py-3 text-[13px]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate font-medium text-zinc-100">
                          {event.name}
                        </span>
                        <span className="shrink-0 text-[12px] text-zinc-400">
                          {event.progress}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                        <div
                          className="h-full rounded-full bg-zinc-300"
                          style={{ width: `${event.progress}%` }}
                        />
                      </div>
                      <p className="text-[12px] text-zinc-500">
                        {formatCurrency(event.securedValue)}
                        {event.sponsorshipGoal
                          ? ` of ${formatCurrency(event.sponsorshipGoal)}`
                          : " raised"}{" "}
                        · {partnerGoalText(event)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-md border border-white/8 bg-[#111113]">
          <div className="border-b border-white/[0.07] px-4 py-3">
            <p className="text-[14px] font-medium text-zinc-200">
              Overall Status
            </p>
          </div>
          <div className="space-y-4 p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StatusCard
                label="Total raised"
                value={formatCurrency(dashboard.securedValue)}
                subtext={`${formatCurrency(sum(paid))} paid`}
              />
            </div>
          </div>
        </section>
      </div>
    </CrmShell>
  );
}
