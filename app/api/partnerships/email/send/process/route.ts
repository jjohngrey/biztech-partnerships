/**
 * Background worker tick for mass-email send.
 *
 * Triggered by:
 *   - Supabase pg_cron every minute (free tier — see README setup section)
 *   - Vercel Cron (Pro plan only at minute granularity)
 *   - Manual smoke tests via curl
 *
 * Auth model is a shared secret in PARTNERSHIPS_EMAIL_WORKER_SECRET. This is
 * the same lightweight pattern as the Gmail sync ingest endpoint and inherits
 * the same TODO from the V1 audit: replace the static secret with HMAC-signed
 * payloads (timestamp + signature) before exposing the URL beyond pg_cron.
 *
 * Each call processes at most BATCH_SIZE recipients from a single campaign,
 * then returns. The cron cadence drives drainage to completion.
 */

import { NextResponse, type NextRequest } from "next/server";
import { processNextBatch } from "@/lib/partnerships/email-worker";

export const dynamic = "force-dynamic";
// Give Vercel some breathing room: BATCH_SIZE × (~400 ms send + 200 ms pause)
// = ~6 s steady state, but a slow Gmail call could push us higher.
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.PARTNERSHIPS_EMAIL_WORKER_SECRET;
  if (!configuredSecret) {
    return NextResponse.json(
      { error: "PARTNERSHIPS_EMAIL_WORKER_SECRET is not configured." },
      { status: 503 },
    );
  }

  const supplied =
    request.headers.get("x-crm-worker-secret") ??
    new URL(request.url).searchParams.get("secret") ??
    "";
  if (supplied.trim() !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processNextBatch();
    return NextResponse.json(result);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Worker tick failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
