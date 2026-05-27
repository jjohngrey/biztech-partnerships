"use client";

import { useMemo, useState } from "react";
import type { CrmUserSummary } from "@/lib/partnerships/types";

function compareText(left: string | null | undefined, right: string | null | undefined) {
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, { sensitivity: "base" });
}

export function DirectorCheckboxes({
  users,
  selectedIds = [],
  currentUserId,
}: {
  users: CrmUserSummary[];
  selectedIds?: string[];
  currentUserId?: string;
}) {
  const [query, setQuery] = useState("");

  const sortedUsers = useMemo(() => {
    return [...users].sort((left, right) => {
      if (left.id === currentUserId) return -1;
      if (right.id === currentUserId) return 1;
      return compareText(left.name, right.name);
    });
  }, [users, currentUserId]);

  const normalizedQuery = query.trim().toLowerCase();

  return (
    <div className="rounded-md border border-white/8 bg-[#101114] p-3">
      <p className="text-[12px] font-medium text-zinc-300">BizTech Directors POC</p>
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search directors…"
        className="mt-3 w-full rounded-md border border-white/8 bg-[#0b0c0e] px-2 py-1.5 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
      />
      <div className="mt-2 grid max-h-36 gap-1 overflow-y-auto">
        {sortedUsers.map((user) => {
          const isCurrentUser = user.id === currentUserId;
          const haystack = `${user.name} ${user.email}`.toLowerCase();
          const matches = !normalizedQuery || haystack.includes(normalizedQuery);
          return (
            <label
              key={user.id}
              className={`items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-zinc-300 hover:bg-white/4 cursor-pointer ${matches ? "flex" : "hidden"}`}
            >
              <input
                name="directorUserIds"
                value={user.id}
                type="checkbox"
                defaultChecked={selectedIds.includes(user.id)}
                className="size-4 accent-zinc-300"
              />
              <span className="min-w-0 truncate">{user.name}</span>
              {isCurrentUser && <span className="shrink-0 text-[11px] text-zinc-500">(You)</span>}
            </label>
          );
        })}
        {!users.length && <p className="text-[13px] text-zinc-500">No BizTech Directors found.</p>}
      </div>
    </div>
  );
}
