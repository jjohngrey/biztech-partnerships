"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function TouchpointsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/contact-log");
  }, [router]);

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[#0d0d0f] px-4 text-zinc-100">
      <Link
        href="/contact-log"
        className="rounded-md border border-white/[0.09] px-3 py-2 text-[13px] font-medium text-zinc-300 transition hover:bg-white/[0.055] hover:text-white"
      >
        Open contact history
      </Link>
    </main>
  );
}
