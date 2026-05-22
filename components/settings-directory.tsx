"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, X } from "lucide-react";
import { createDirectorAction, updateDirectorAction } from "@/lib/partnerships/actions";
import type { CrmUserRole, CrmUserSummary, CrmUserTeam, CrmYear } from "@/lib/partnerships/types";

const teamOptions: Array<{ value: CrmUserTeam; label: string }> = [
  { value: "partnerships", label: "Partnerships" },
  { value: "experiences", label: "Experiences" },
  { value: "mmd", label: "MMD" },
  { value: "internal", label: "Internal" },
  { value: "dev", label: "Dev" },
];

const roleOptions: Array<{ value: CrmUserRole; label: string }> = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
];

function inputClass(extra = "") {
  return [
    "h-9 w-full min-w-0 max-w-full rounded-md border border-white/9 bg-[#0d0e11] px-3 text-[13px] text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-400/70 focus:ring-2 focus:ring-zinc-400/15",
    extra,
  ].join(" ");
}

function labelClass() {
  return "grid min-w-0 gap-1.5 text-[12px] font-medium text-zinc-400";
}

function YearChecklist({
  availableYears,
  selectedYearIds,
}: {
  availableYears: CrmYear[];
  selectedYearIds: string[];
}) {
  const selected = new Set(selectedYearIds);
  if (!availableYears.length) {
    return <p className="text-[12px] text-zinc-500">No years configured.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {availableYears.map((year) => (
        <label
          key={year.id}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-white/9 bg-[#0d0e11] px-2.5 text-[12px] text-zinc-300 transition hover:bg-white/4 has-checked:border-zinc-400/70 has-checked:bg-white/[0.07] has-checked:text-white"
        >
          <input
            type="checkbox"
            name="yearIds"
            value={year.id}
            defaultChecked={selected.has(year.id)}
            className="size-3.5 accent-zinc-300"
          />
          {year.label}
        </label>
      ))}
    </div>
  );
}

function readDirectorForm(form: HTMLFormElement) {
  const data = new FormData(form);
  return {
    firstName: String(data.get("firstName") ?? ""),
    lastName: String(data.get("lastName") ?? ""),
    email: String(data.get("email") ?? ""),
    team: String(data.get("team") ?? "partnerships") as CrmUserTeam,
    role: String(data.get("role") ?? "member") as CrmUserRole,
    yearIds: data.getAll("yearIds").map(String).filter(Boolean),
  };
}

export function SettingsDirectory({
  directors,
  availableYears,
}: {
  directors: CrmUserSummary[];
  availableYears: CrmYear[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [editingDirectorId, setEditingDirectorId] = useState<string | null>(null);
  const [activeYearId, setActiveYearId] = useState<string | "all">(
    availableYears.length > 0 ? availableYears[availableYears.length - 1].id : "all"
  );

  const visibleDirectors =
    activeYearId === "all"
      ? directors
      : directors.filter((d) => d.yearIds.includes(activeYearId));

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = readDirectorForm(form);
    startTransition(async () => {
      await createDirectorAction(input);
      form.reset();
      setShowCreate(false);
      router.refresh();
    });
  }

  function submitUpdate(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const input = readDirectorForm(event.currentTarget);
    startTransition(async () => {
      await updateDirectorAction({ id, ...input });
      setEditingDirectorId(null);
      router.refresh();
    });
  }

  return (
    <div className="max-h-screen w-full max-w-full overflow-x-hidden bg-[#0d0d0f] px-3 py-4 text-zinc-100 sm:px-5 sm:py-5">
      <h2 className="text-[15px] font-medium text-zinc-100">Settings</h2>

      {availableYears.length > 0 && (
        <div className="mt-4 flex gap-1 overflow-x-auto">
          {[...availableYears].reverse().map((year) => (
            <button
              key={year.id}
              type="button"
              onClick={() => setActiveYearId(year.id)}
              className={[
                "shrink-0 rounded-md px-3 py-1.5 text-[12px] font-medium transition cursor-pointer",
                activeYearId === year.id
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:bg-white/5.5 hover:text-zinc-200",
              ].join(" ")}
            >
              {year.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setActiveYearId("all")}
            className={[
              "shrink-0 rounded-md px-3 py-1.5 text-[12px] font-medium transition cursor-pointer",
              activeYearId === "all"
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:bg-white/5.5 hover:text-zinc-200",
            ].join(" ")}
          >
            All
          </button>
        </div>
      )}

      <section className="mt-3 rounded-md border border-white/9 bg-[#111113]">
        <div className="grid gap-2 border-b border-white/8 px-4 py-3 lg:flex lg:items-center lg:justify-between lg:gap-3">
          <p className="text-[13px] font-medium text-zinc-200">BizTech Directors</p>
          <button
            type="button"
            onClick={() => setShowCreate((current) => !current)}
            className="inline-flex h-8 w-fit shrink-0 items-center gap-1.5 rounded-md border border-white/9 px-2.5 text-[12px] font-medium text-zinc-300 transition hover:bg-white/5.5 hover:text-white cursor-pointer"
          >
            {showCreate ? <X className="size-3.5" strokeWidth={1.8} /> : <Plus className="size-3.5" strokeWidth={1.8} />}
            {showCreate ? "Cancel" : "Add director"}
          </button>
        </div>

        {showCreate ? (
          <form onSubmit={submitCreate} className="grid gap-3 border-b border-white/8 p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(180px,0.9fr)_130px_118px_118px] lg:items-end">
              <label className={labelClass()}>
                First name
                <input name="firstName" required className={inputClass()} />
              </label>
              <label className={labelClass()}>
                Last name
                <input name="lastName" className={inputClass()} />
              </label>
              <label className={labelClass()}>
                Email
                <input name="email" required type="email" className={inputClass()} />
              </label>
              <label className={labelClass()}>
                Team
                <select name="team" defaultValue="partnerships" className={inputClass()}>
                  {teamOptions.map((team) => (
                    <option key={team.value} value={team.value}>{team.label}</option>
                  ))}
                </select>
              </label>
              <label className={labelClass()}>
                Access
                <select name="role" defaultValue="member" className={inputClass()}>
                  {roleOptions.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </label>
              <button
                disabled={isPending}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-zinc-700 px-3 text-[13px] font-medium text-white transition hover:bg-zinc-600 disabled:opacity-60 cursor-pointer">
                <Plus className="size-4" strokeWidth={1.8} />
                Add director
              </button>
            </div>
            <div className={labelClass()}>
              Years
              <YearChecklist availableYears={availableYears} selectedYearIds={[]} />
            </div>
          </form>
        ) : null}

        <div className="divide-y divide-white/6">
          {visibleDirectors.map((director) => (
            editingDirectorId === director.id ? (
              <form
                key={director.id}
                onSubmit={(event) => submitUpdate(event, director.id)}
                className="grid gap-3 px-4 py-3"
              >
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(180px,0.9fr)_130px_120px_auto_auto] lg:items-end">
                  <label className={labelClass()}>
                    First name
                    <input name="firstName" required defaultValue={director.firstName} className={inputClass()} />
                  </label>
                  <label className={labelClass()}>
                    Last name
                    <input name="lastName" defaultValue={director.lastName} className={inputClass()} />
                  </label>
                  <label className={labelClass()}>
                    Email
                    <input name="email" required type="email" defaultValue={director.email} className={inputClass()} />
                  </label>
                  <label className={labelClass()}>
                    Team
                    <select name="team" defaultValue={director.team} className={inputClass()}>
                      {teamOptions.map((team) => (
                        <option key={team.value} value={team.value}>{team.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass()}>
                    Access
                    <select name="role" defaultValue={director.role} className={inputClass()}>
                      {roleOptions.map((role) => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    disabled={isPending}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-zinc-700 px-3 text-[13px] font-medium text-white transition hover:bg-zinc-600 disabled:opacity-60 cursor-pointer">
                    <Check className="size-4" strokeWidth={1.8} />
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingDirectorId(null)}
                    className="h-9 rounded-md border border-white/9 px-3 text-[13px] font-medium text-zinc-400 transition hover:bg-white/4.5 hover:text-zinc-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
                <div className={labelClass()}>
                  Years
                  <YearChecklist availableYears={availableYears} selectedYearIds={director.yearIds} />
                </div>
              </form>
            ) : (
              <div
                key={director.id}
                className="grid min-w-0 gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_1fr_auto] md:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-zinc-200">{director.name}</p>
                  <p className="mt-1 truncate text-[12px] text-zinc-500 md:hidden">{director.email}</p>
                </div>
                <p className="hidden min-w-0 truncate text-[13px] text-zinc-400 md:block">{director.email}</p>
                <p className="min-w-0 truncate text-[13px] text-zinc-400">
                  {teamOptions.find((team) => team.value === director.team)?.label ?? director.team}
                  <span className="text-zinc-600"> · </span>
                  <span className="text-zinc-500">{roleOptions.find((role) => role.value === director.role)?.label ?? director.role}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setEditingDirectorId(director.id)}
                  aria-label={`Edit ${director.name}`}
                  title={`Edit ${director.name}`}
                  className="grid size-8 shrink-0 place-items-center rounded-md border border-white/9 text-zinc-400 transition hover:bg-white/4.5 hover:text-zinc-100 cursor-pointer"
                >
                  <Pencil className="size-3.5" strokeWidth={1.8} />
                </button>
              </div>
            )
          ))}
          {!visibleDirectors.length && (
            <p className="px-4 py-4 text-[13px] text-zinc-500">
              {activeYearId === "all" ? "No BizTech Directors yet." : "No directors for this year."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
