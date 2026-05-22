"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function ContactsCopyButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="group inline-flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-[12px] text-zinc-500 transition bg-white/5.5 hover:text-zinc-200"
    >
      {copied ? (
        <>
          <Check className="size-3.5" strokeWidth={1.8} />
          Copied
        </>
      ) : (
        <>
          <Copy className="size-3.5 opacity-70 transition group-hover:opacity-100 text-white" strokeWidth={1.8} />
          {email}
        </>
      )}
    </button>
  );
}
