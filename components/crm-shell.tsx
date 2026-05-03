"use client";

import type React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  Gauge,
  Handshake,
  LogOut,
  MailPlus,
  MessageSquarePlus,
  Moon,
  Settings,
  Sun,
  UsersRound,
} from "lucide-react";

type CrmShellProps = {
  displayName: string;
  activeSection?: "dashboard" | "companies" | "partners" | "events" | "touchpoints" | "pipeline" | "outreach" | "settings" | "home";
  children?: React.ReactNode;
};

const primaryNavItems = [
  { href: "/dashboard", label: "Dashboard", key: "dashboard", icon: Gauge },
  { href: "/companies", label: "Companies", key: "companies", icon: Building2 },
  { href: "/partners", label: "Partners", key: "partners", icon: UsersRound },
  { href: "/events", label: "Events", key: "events", icon: CalendarDays },
  { href: "/contact-log", label: "Contact history", key: "touchpoints", icon: MessageSquarePlus },
  { href: "/pipeline", label: "Pipeline", key: "pipeline", icon: Handshake },
  { href: "/outreach", label: "Outreach", key: "outreach", icon: MailPlus },
] as const;

const settingsNavItem = { href: "/settings", label: "Settings", key: "settings", icon: Settings } as const;
type ThemeMode = "dark" | "light";

export function CrmShell({
  displayName,
  activeSection = "home",
  children,
}: CrmShellProps) {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  useEffect(() => {
    const stored = window.localStorage.getItem("crm-theme");
    const initial = stored === "light" || stored === "dark" ? stored : "dark";
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("crm-theme", next);
  }

  const ThemeIcon = theme === "dark" ? Sun : Moon;

  return (
    <main className="min-h-[100dvh] bg-[#0d0d0f] text-zinc-100">
      <div className="flex min-h-[100dvh]">
        <aside className="hidden w-[212px] shrink-0 border-r border-white/[0.08] bg-[#09090b] px-3 py-4 xl:flex xl:flex-col">
          <div className="flex h-8 items-center gap-2 px-2">
            <div className="grid size-6 shrink-0 place-items-center rounded-md border border-white/[0.08] bg-white/[0.045] text-[10px] font-semibold tracking-[-0.01em] text-zinc-200">
              BT
            </div>
            <div className="min-w-0 leading-none">
              <p className="truncate text-[12px] font-medium tracking-[-0.01em] text-zinc-100">
                BizTech
              </p>
              <p className="mt-0.5 truncate text-[10px] font-medium text-zinc-500">
                Partnerships
              </p>
            </div>
          </div>

          <nav className="mt-7 space-y-0.5">
            {primaryNavItems.map((item) => {
              const active = activeSection === item.key;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition",
                    active ? "bg-white/[0.075] text-white" : "text-zinc-500 hover:bg-white/[0.045] hover:text-zinc-200",
                  ].join(" ")}
                >
                  <Icon className={["size-4 shrink-0", active ? "text-zinc-100" : "text-zinc-500"].join(" ")} strokeWidth={1.8} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-white/[0.08] pt-4">
            <div className="flex items-center gap-2.5 px-1">
              <div className="grid size-7 place-items-center rounded-full bg-white/[0.09] text-[10px] font-medium text-zinc-200">
                {initials || "BT"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-zinc-100">{displayName}</p>
                <p className="truncate text-[11px] text-zinc-500">BizTech Director</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-white/[0.08] px-2 text-[12px] font-medium text-zinc-500 transition hover:bg-white/[0.045] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
              >
                <ThemeIcon className="size-3.5" strokeWidth={1.8} />
                {theme === "dark" ? "Light" : "Dark"}
              </button>
              <Link
                href={settingsNavItem.href}
                className={[
                  "flex h-8 items-center justify-center gap-1.5 rounded-md border border-white/[0.08] px-2 text-[12px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500",
                  activeSection === settingsNavItem.key
                    ? "bg-white/[0.075] text-white"
                    : "text-zinc-500 hover:bg-white/[0.045] hover:text-zinc-200",
                ].join(" ")}
              >
                <Settings className="size-3.5" strokeWidth={1.8} />
                Settings
              </Link>
            </div>
            <form action="/auth/signout" method="post" className="mt-1.5">
              <button
                type="submit"
                className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-white/[0.08] px-2 text-[12px] font-medium text-zinc-500 transition hover:border-red-400/20 hover:bg-red-500/10 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
              >
                <LogOut className="size-3.5" strokeWidth={1.8} />
                Sign out
              </button>
            </form>
          </div>
        </aside>

        <section className="w-0 min-w-0 flex-1 overflow-x-hidden">
          <div className="min-h-[100dvh] bg-[#0d0d0f]">
            <div className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#09090b]/95 px-2 py-2 backdrop-blur xl:hidden">
              <nav className="flex min-w-0 gap-1.5 overflow-x-auto">
                {primaryNavItems.map((item) => {
                  const active = activeSection === item.key;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={[
                        "inline-flex h-8 shrink-0 items-center rounded-md border text-[12px] font-medium transition",
                        "w-8 justify-center px-0",
                        active
                          ? "border-white/15 bg-white/[0.08] text-white"
                          : "border-white/[0.08] bg-white/[0.03] text-zinc-400",
                      ].join(" ")}
                      title={item.label}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className="size-3.5 shrink-0" strokeWidth={1.8} />
                      <span className="sr-only">{item.label}</span>
                    </Link>
                  );
                })}
                <Link
                  href={settingsNavItem.href}
                  className={[
                    "inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-white/[0.08] text-[12px] font-medium transition",
                    activeSection === settingsNavItem.key
                      ? "bg-white/[0.08] text-white"
                      : "bg-white/[0.03] text-zinc-400 hover:bg-white/[0.055] hover:text-zinc-200",
                  ].join(" ")}
                  title={settingsNavItem.label}
                  aria-label={settingsNavItem.label}
                >
                  <Settings className="size-3.5 shrink-0" strokeWidth={1.8} />
                  <span className="sr-only">{settingsNavItem.label}</span>
                </Link>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-zinc-400 transition hover:bg-white/[0.055] hover:text-zinc-200"
                  title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                >
                  <ThemeIcon className="size-3.5 shrink-0" strokeWidth={1.8} />
                </button>
              </nav>
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
