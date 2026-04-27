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

const primaryNavItems = [
  { label: "Inbox", active: true, count: "3" },
  { label: "My partners" },
];

const workspaceNavItems = ["Partners", "Events", "Pipeline", "Documents", "Email Ops"];
const teamNavItems = ["Accounts", "Contacts", "Sponsorships"];
const utilityNavItems = ["Import / export", "Gmail sync"];

function SidebarIcon({ active = false }: { active?: boolean }) {
  return (
    <span
      className={`size-4 shrink-0 rounded-[4px] border ${
        active
          ? "border-zinc-100 bg-zinc-100/10"
          : "border-zinc-500/70 bg-transparent"
      }`}
    />
  );
}

export function CrmShell({ displayName, email }: CrmShellProps) {
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <main className="min-h-screen bg-[#07090d] text-zinc-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-[272px] shrink-0 border-r border-white/[0.07] bg-[#060607] px-3 py-3 lg:flex lg:flex-col">
          <div className="flex h-10 items-center gap-2 px-2">
            <div className="grid size-6 place-items-center text-sm font-semibold text-blue-500">
              B
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold tracking-tight text-zinc-100">
                UBC BizTech
              </p>
            </div>
            <button
              type="button"
              aria-label="Search"
              className="grid size-7 place-items-center rounded-md text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200"
            >
              <span className="size-3.5 rounded-full border border-current" />
            </button>
            <button
              type="button"
              aria-label="New"
              className="grid size-7 place-items-center rounded-md bg-white/[0.08] text-sm text-zinc-100 transition hover:bg-white/[0.12]"
            >
              +
            </button>
          </div>

          <nav className="mt-5 space-y-0.5">
            {primaryNavItems.map((item) => (
              <a
                href="#"
                key={item.label}
                className={`flex h-8 items-center gap-2 rounded-md px-2 text-[14px] font-medium transition ${
                  item.active
                    ? "bg-white/[0.105] text-zinc-50"
                    : "text-zinc-500 hover:bg-white/[0.055] hover:text-zinc-200"
                }`}
              >
                <SidebarIcon active={item.active} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.count ? (
                  <span className="text-xs font-medium text-zinc-500">{item.count}</span>
                ) : null}
              </a>
            ))}
          </nav>

          <nav className="mt-7">
            <div className="mb-1 flex h-7 items-center px-2 text-[13px] font-semibold text-zinc-500">
              Workspace
            </div>
            <div className="space-y-0.5">
              {workspaceNavItems.map((item) => (
                <a
                  href="#"
                  key={item}
                  className="flex h-8 items-center gap-2 rounded-md px-2 text-[14px] font-medium text-zinc-500 transition hover:bg-white/[0.055] hover:text-zinc-200"
                >
                  <SidebarIcon />
                  <span className="truncate">{item}</span>
                </a>
              ))}
            </div>
          </nav>

          <nav className="mt-7">
            <div className="mb-1 flex h-7 items-center px-2 text-[13px] font-semibold text-zinc-500">
              Your team
            </div>
            <a
              href="#"
              className="flex h-8 items-center gap-2 rounded-md px-2 text-[14px] font-semibold text-zinc-400 transition hover:bg-white/[0.055] hover:text-zinc-200"
            >
              <span className="size-4 rounded-[4px] border border-rose-400" />
              <span className="min-w-0 flex-1 truncate">UBC BizTech</span>
            </a>
            <div className="mt-1 space-y-0.5 pl-6">
              {teamNavItems.map((item) => (
                <a
                  href="#"
                  key={item}
                  className="flex h-8 items-center gap-2 rounded-md px-2 text-[14px] font-medium text-zinc-500 transition hover:bg-white/[0.055] hover:text-zinc-200"
                >
                  <SidebarIcon />
                  <span className="truncate">{item}</span>
                </a>
              ))}
            </div>
          </nav>

          <nav className="mt-7">
            <div className="mb-1 flex h-7 items-center px-2 text-[13px] font-semibold text-zinc-500">
              Try
            </div>
            <div className="space-y-0.5">
              {utilityNavItems.map((item) => (
                <a
                  href="#"
                  key={item}
                  className="flex h-8 items-center gap-2 rounded-md px-2 text-[14px] font-medium text-zinc-500 transition hover:bg-white/[0.055] hover:text-zinc-200"
                >
                  <SidebarIcon />
                  <span className="truncate">{item}</span>
                </a>
              ))}
            </div>
          </nav>

          <div className="mt-auto rounded-lg bg-white/[0.055] px-3 py-3">
            <p className="text-[13px] font-medium text-zinc-500">Next up</p>
            <p className="mt-1 truncate text-sm font-medium text-zinc-200">
              Gmail send workflow
            </p>
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

          <div className="min-h-[calc(100vh-65px)]" />
        </section>
      </div>
    </main>
  );
}
