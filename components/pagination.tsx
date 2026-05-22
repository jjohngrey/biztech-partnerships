"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PaginationMeta } from "@/lib/partnerships/types";

type PaginationProps = PaginationMeta & {
  onPageChange: (page: number) => void;
};

export function Pagination({ total, page, pageSize, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const pages: Array<number | "..."> = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3">
      <p className="text-[12px] text-zinc-500">
        {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="grid size-7 place-items-center rounded text-zinc-400 transition hover:bg-white/[0.055] hover:text-zinc-100 disabled:pointer-events-none disabled:opacity-30 cursor-pointer"
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" strokeWidth={1.8} />
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1 text-[12px] text-zinc-600">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p as number)}
              className={[
                "grid size-7 place-items-center rounded text-[12px] transition cursor-pointer",
                p === page
                  ? "bg-white/[0.08] text-zinc-100"
                  : "text-zinc-400 hover:bg-white/[0.055] hover:text-zinc-100",
              ].join(" ")}
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="grid size-7 place-items-center rounded text-zinc-400 transition hover:bg-white/[0.055] hover:text-zinc-100 disabled:pointer-events-none disabled:opacity-30 cursor-pointer"
          aria-label="Next page"
        >
          <ChevronRight className="size-4" strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
