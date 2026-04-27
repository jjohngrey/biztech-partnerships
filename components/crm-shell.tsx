export type CrmShellPartner = {
  name: string;
  owner: string;
  stage: string;
  tier: string;
  value: string;
  nextStep: string;
  status: "Active" | "Warm" | "Stalled" | "Renewal";
};

export type CrmShellMetric = {
  label: string;
  value: string;
  delta: string;
  note: string;
};

export type CrmShellPipelineStage = {
  name: string;
  count: number;
  value: string;
  progress: number;
};

export type CrmShellData = {
  overview?: CrmShellMetric[];
  partners?: CrmShellPartner[];
  pipeline?: CrmShellPipelineStage[];
  activity?: string[];
};

type CrmShellProps = {
  displayName: string;
  email?: string;
  data?: CrmShellData;
};

const defaultOverview: CrmShellMetric[] = [
  { label: "Partner revenue", value: "$86.4K", delta: "+18%", note: "against spring target" },
  { label: "Open pipeline", value: "$142K", delta: "31 deals", note: "weighted forecast" },
  { label: "Renewals due", value: "9", delta: "4 high touch", note: "next 30 days" },
  { label: "Response SLA", value: "1.8d", delta: "-0.6d", note: "median sponsor reply" },
];

const defaultPartners: CrmShellPartner[] = [
  {
    name: "Deloitte",
    owner: "Chris",
    stage: "Proposal sent",
    tier: "Platinum",
    value: "$18K",
    nextStep: "Legal review Apr 29",
    status: "Warm",
  },
  {
    name: "TELUS Digital",
    owner: "Jade",
    stage: "Discovery",
    tier: "Gold",
    value: "$11K",
    nextStep: "Scope workshop May 2",
    status: "Active",
  },
  {
    name: "BC Hydro",
    owner: "Jay",
    stage: "Renewal",
    tier: "Gold",
    value: "$14K",
    nextStep: "Confirm invoice owner",
    status: "Renewal",
  },
  {
    name: "RBCx",
    owner: "Nina",
    stage: "Negotiation",
    tier: "Startup",
    value: "$8K",
    nextStep: "Send revised package",
    status: "Warm",
  },
  {
    name: "Clio",
    owner: "Marcus",
    stage: "At risk",
    tier: "Silver",
    value: "$6K",
    nextStep: "Re-engage hiring lead",
    status: "Stalled",
  },
];

const defaultPipeline: CrmShellPipelineStage[] = [
  { name: "Prospecting", count: 24, value: "$41K", progress: 64 },
  { name: "Discovery", count: 12, value: "$38K", progress: 52 },
  { name: "Proposal", count: 7, value: "$46K", progress: 43 },
  { name: "Committed", count: 5, value: "$17K", progress: 81 },
];

const defaultActivity = [
  "All Hands sponsor slide draft due tonight",
  "Formal intro cleanup pending for 3 new leads",
  "Portfolio package refresh ready for review",
  "Two invoices need finance confirmation",
];

const navItems = ["Overview", "Partners", "Pipeline", "Tasks", "Reports"];

function getStatusClass(status: CrmShellPartner["status"]) {
  switch (status) {
    case "Active":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
    case "Warm":
      return "border-sky-400/25 bg-sky-400/10 text-sky-200";
    case "Renewal":
      return "border-amber-400/25 bg-amber-400/10 text-amber-200";
    case "Stalled":
      return "border-rose-400/25 bg-rose-400/10 text-rose-200";
  }
}

export function CrmShell({ displayName, email, data }: CrmShellProps) {
  const overview = data?.overview ?? defaultOverview;
  const partners = data?.partners ?? defaultPartners;
  const pipeline = data?.pipeline ?? defaultPipeline;
  const activity = data?.activity ?? defaultActivity;

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <main className="min-h-screen bg-[#07090d] text-zinc-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-white/[0.08] bg-[#0a0d12]/95 px-4 py-5 lg:flex lg:flex-col">
          <div className="flex items-center gap-3 px-2">
            <div className="grid size-8 place-items-center rounded-md bg-white text-sm font-semibold text-zinc-950">
              B
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">BizTech CRM</p>
              <p className="text-xs text-zinc-500">Partnerships</p>
            </div>
          </div>

          <nav className="mt-8 space-y-1">
            {navItems.map((item, index) => (
              <a
                href="#"
                key={item}
                className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition ${
                  index === 0
                    ? "bg-white/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]"
                    : "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200"
                }`}
              >
                <span>{item}</span>
                {item === "Tasks" ? (
                  <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-[10px] text-emerald-200">
                    8
                  </span>
                ) : null}
              </a>
            ))}
          </nav>

          <div className="mt-auto rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
            <p className="text-xs font-medium text-zinc-300">Spring target</p>
            <div className="mt-3 h-1.5 rounded-full bg-white/[0.08]">
              <div className="h-full w-[72%] rounded-full bg-emerald-300" />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-zinc-500">$86.4K booked</span>
              <span className="text-zinc-300">72%</span>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 border-b border-white/[0.08] bg-[#07090d]/88 px-4 py-3 backdrop-blur-xl sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Partnerships workspace
                </p>
                <h1 className="mt-1 truncate text-lg font-semibold tracking-tight text-white sm:text-xl">
                  Revenue command center
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 sm:block">
                  {email}
                </div>
                <div className="grid size-8 place-items-center rounded-md bg-zinc-800 text-xs font-semibold text-zinc-200">
                  {initials || "BT"}
                </div>
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </header>

          <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 space-y-4">
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {overview.map((item) => (
                  <article
                    key={item.label}
                    className="rounded-lg border border-white/[0.08] bg-[#0d1117] p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-medium text-zinc-500">{item.label}</p>
                      <span className="rounded border border-emerald-300/20 bg-emerald-300/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200">
                        {item.delta}
                      </span>
                    </div>
                    <p className="mt-3 text-2xl font-semibold tracking-tight text-white">
                      {item.value}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{item.note}</p>
                  </article>
                ))}
              </section>

              <section className="rounded-lg border border-white/[0.08] bg-[#0d1117]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Partner directory</h2>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Current outreach, renewals, and sponsor package status.
                    </p>
                  </div>
                  <button className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200">
                    New partner
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
                    <thead className="text-xs text-zinc-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Partner</th>
                        <th className="px-4 py-3 font-medium">Owner</th>
                        <th className="px-4 py-3 font-medium">Stage</th>
                        <th className="px-4 py-3 font-medium">Tier</th>
                        <th className="px-4 py-3 font-medium">Value</th>
                        <th className="px-4 py-3 font-medium">Next step</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partners.map((partner) => (
                        <tr
                          key={partner.name}
                          className="border-t border-white/[0.08] text-zinc-300"
                        >
                          <td className="border-t border-white/[0.08] px-4 py-3 font-medium text-white">
                            {partner.name}
                          </td>
                          <td className="border-t border-white/[0.08] px-4 py-3">
                            {partner.owner}
                          </td>
                          <td className="border-t border-white/[0.08] px-4 py-3">
                            {partner.stage}
                          </td>
                          <td className="border-t border-white/[0.08] px-4 py-3">
                            {partner.tier}
                          </td>
                          <td className="border-t border-white/[0.08] px-4 py-3 text-zinc-100">
                            {partner.value}
                          </td>
                          <td className="border-t border-white/[0.08] px-4 py-3 text-zinc-400">
                            {partner.nextStep}
                          </td>
                          <td className="border-t border-white/[0.08] px-4 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${getStatusClass(
                                partner.status,
                              )}`}
                            >
                              {partner.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <aside className="space-y-4">
              <section className="rounded-lg border border-white/[0.08] bg-[#0d1117] p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">Pipeline</h2>
                  <span className="text-xs text-zinc-500">Weighted by stage</span>
                </div>
                <div className="mt-4 divide-y divide-white/[0.07]">
                  {pipeline.map((stage) => (
                    <div key={stage.name} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div>
                          <p className="font-medium text-zinc-200">{stage.name}</p>
                          <p className="text-xs text-zinc-500">{stage.count} accounts</p>
                        </div>
                        <p className="font-semibold text-white">{stage.value}</p>
                      </div>
                      <div className="mt-2 h-px bg-white/[0.08]">
                        <div
                          className="h-px bg-sky-300"
                          style={{ width: `${stage.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-white/[0.08] bg-[#0d1117]">
                <div className="border-b border-white/[0.08] px-4 py-3">
                  <h2 className="text-sm font-semibold text-white">Priority detail</h2>
                </div>
                <div className="border-l-2 border-emerald-300/60 bg-emerald-300/[0.045] px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-emerald-100">
                        BC Hydro renewal
                      </p>
                      <p className="mt-2 text-xs leading-5 text-zinc-400">
                        Sponsor is ready to renew once invoice ownership and event
                        placement are confirmed.
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium text-emerald-200">
                      $14K
                    </span>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 border-t border-emerald-100/[0.12] pt-3 text-xs">
                    <div>
                      <dt className="text-zinc-500">Close date</dt>
                      <dd className="mt-1 font-medium text-zinc-200">May 9</dd>
                    </div>
                    <div className="border-l border-emerald-100/[0.12] pl-4">
                      <dt className="text-zinc-500">Owner</dt>
                      <dd className="mt-1 font-medium text-zinc-200">Jay</dd>
                    </div>
                  </dl>
                </div>
              </section>

              <section className="rounded-lg border border-white/[0.08] bg-[#0d1117]">
                <div className="border-b border-white/[0.08] px-4 py-3">
                  <h2 className="text-sm font-semibold text-white">Team queue</h2>
                </div>
                <div className="divide-y divide-white/[0.07]">
                  {activity.map((item) => (
                    <div
                      key={item}
                      className="px-4 py-3 text-xs leading-5 text-zinc-400"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
