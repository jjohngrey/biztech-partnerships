import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[#0d0d0f] px-6 text-zinc-100">
      <div className="max-w-sm text-center">
        <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-zinc-500">404</p>
        <h1 className="mt-3 text-xl font-medium">Page not found</h1>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-9 items-center rounded-md border border-white/[0.1] px-3 text-[13px] text-zinc-300 transition hover:bg-white/[0.055] hover:text-white"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
