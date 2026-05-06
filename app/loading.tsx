const navRows = ["Dashboard", "Companies", "Partners", "Events", "Contact History", "Pipeline", "Outreach"];

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={["animate-pulse rounded-md bg-white/[0.055]", className].join(" ")} />;
}

export default function Loading() {
  return (
    <main className="min-h-[100dvh] bg-[#0d0d0f] text-zinc-100">
      <div className="flex min-h-[100dvh]">
        <aside className="hidden w-[212px] shrink-0 flex-col border-r border-white/[0.08] bg-[#09090b] px-3 py-4 xl:flex">
          <SkeletonBlock className="h-4 w-36" />
          <div className="mt-8 space-y-1">
            {navRows.map((row) => (
              <div key={row} className="flex h-8 items-center gap-2 rounded-md px-2">
                <SkeletonBlock className="size-4 shrink-0" />
                <SkeletonBlock className="h-3 w-24" />
              </div>
            ))}
          </div>
          <div className="mt-auto border-t border-white/[0.08] pt-4">
            <div className="flex items-center gap-2">
              <SkeletonBlock className="size-7 rounded-full" />
              <div className="space-y-1.5">
                <SkeletonBlock className="h-3 w-20" />
                <SkeletonBlock className="h-3 w-28" />
              </div>
            </div>
          </div>
        </aside>

        <section className="w-0 min-w-0 flex-1 px-3 py-4 sm:px-5 sm:py-5">
          <div className="flex items-center justify-between gap-3">
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="h-8 w-32" />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-md border border-white/[0.08] bg-[#111113] p-4">
                <SkeletonBlock className="h-3 w-24" />
                <SkeletonBlock className="mt-3 h-6 w-20" />
                <SkeletonBlock className="mt-2 h-3 w-32" />
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div className="rounded-md border border-white/[0.08] bg-[#111113] p-4">
              <SkeletonBlock className="h-4 w-40" />
              <div className="mt-5 space-y-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <SkeletonBlock key={index} className="h-10 w-full" />
                ))}
              </div>
            </div>
            <div className="rounded-md border border-white/[0.08] bg-[#111113] p-4">
              <SkeletonBlock className="h-4 w-24" />
              <div className="mt-5 space-y-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <SkeletonBlock key={index} className="h-12 w-full" />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
