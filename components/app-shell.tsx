"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const NAV_SECTIONS = [
  {
    heading: "MAIN",
    links: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/events", label: "Events" },
    ],
  },
  {
    heading: "CONTACT",
    links: [
      { href: "/companies", label: "Companies" },
      { href: "/partners", label: "Partners" },
    ],
  },
  {
    heading: "OUTREACH",
    links: [
      { href: "/pipeline", label: "Pipeline" },
      { href: "/contact-log", label: "Contact History" },
      { href: "/outreach", label: "Outreach" },
    ],
  },
];

// Routes that render full-screen without the sidebar
const SKIP_SHELL = ["/login", "/auth/"];

function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-screen w-52 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <div className="flex h-14 items-center border-b border-neutral-200 px-4">
        <span className="text-sm font-semibold text-neutral-900">Hermes</span>
      </div>
      <nav className="flex flex-col gap-4 p-2 pt-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.heading}>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
              {section.heading}
            </p>
            {section.links.map(({ href, label }) => {
              const isActive = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-neutral-100 text-neutral-900"
                      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const skipShell = SKIP_SHELL.some((prefix) => pathname.startsWith(prefix));

  if (skipShell) return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
