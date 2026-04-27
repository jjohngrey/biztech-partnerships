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
          </div>

          <div className="mt-8 px-2 text-[13px] font-medium text-zinc-500">
            Partnerships CRM
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
