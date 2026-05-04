import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  companies,
  contactActivities,
  contactActivityAttendees,
  contactActivityCompanies,
  contactActivityPartners,
  partners,
  users,
} from "@/lib/db/schema";

export const dynamic = "force-dynamic";

type SyncMessage = {
  actorEmail?: string;
  companyName?: string;
  partnerEmail?: string;
  partnerName?: string;
  subject?: string;
  summary?: string;
  direction?: "inbound" | "outbound";
  occurredAt?: string;
  messageId?: string;
  threadId?: string;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function fullName(firstName: string, lastName: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ");
}

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.PARTNERSHIPS_EMAIL_INGEST_SECRET;
  const body = await request.json().catch(() => null) as
    | { secret?: string; messages?: SyncMessage[] }
    | SyncMessage[]
    | SyncMessage
    | null;
  const suppliedSecret =
    request.headers.get("x-crm-ingest-secret") ??
    (body && !Array.isArray(body) && "secret" in body ? normalize(body.secret) : "");

  if (!configuredSecret) {
    return NextResponse.json(
      { error: "PARTNERSHIPS_EMAIL_INGEST_SECRET is not configured." },
      { status: 503 },
    );
  }

  if (suppliedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const messages = Array.isArray(body)
    ? body
    : body && "messages" in body && Array.isArray(body.messages)
      ? body.messages
      : body
        ? [body as SyncMessage]
        : [];

  if (!messages.length) {
    return NextResponse.json({ received: 0, imported: 0, skipped: 0, unmatched: 0 });
  }

  const [userRows, companyRows, partnerRows] = await Promise.all([
    db.select().from(users),
    db.select().from(companies),
    db.select().from(partners),
  ]);

  let imported = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const message of messages) {
    const actorEmail = normalize(message.actorEmail).toLowerCase();
    const partnerEmail = normalize(message.partnerEmail).toLowerCase();
    const companyName = normalize(message.companyName).toLowerCase();
    const partnerName = normalize(message.partnerName).toLowerCase();
    const subject = normalize(message.subject) || "Gmail conversation";
    const externalMessageId = normalize(message.messageId);
    const externalThreadId = normalize(message.threadId);

    if (externalMessageId) {
      const [existing] = await db
        .select({ id: contactActivities.id })
        .from(contactActivities)
        .where(eq(contactActivities.externalMessageId, externalMessageId))
        .limit(1);
      if (existing) {
        skipped += 1;
        continue;
      }
    }

    const owner = userRows.find((user) => user.email.toLowerCase() === actorEmail);
    if (!owner) {
      unmatched += 1;
      continue;
    }

    const partner =
      partnerRows.find((row) => row.email?.toLowerCase() === partnerEmail) ??
      partnerRows.find((row) => fullName(row.firstName, row.lastName).toLowerCase() === partnerName) ??
      null;
    const company =
      (partner ? companyRows.find((row) => row.id === partner.companyId) : null) ??
      companyRows.find((row) => row.name.toLowerCase() === companyName) ??
      null;

    if (!company) {
      unmatched += 1;
      continue;
    }

    const occurredAtValue = normalize(message.occurredAt);
    const occurredAt = occurredAtValue ? new Date(occurredAtValue) : new Date();

    await db.transaction(async (tx) => {
      const [activity] = await tx.insert(contactActivities).values({
        type: "email",
        direction: message.direction === "inbound" ? "inbound" : "outbound",
        subject,
        notes: normalize(message.summary) || null,
        occurredAt: Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
        source: "gmail_sync",
        externalMessageId: externalMessageId || null,
        externalThreadId: externalThreadId || null,
        primaryCompanyId: company.id,
        primaryPartnerId: partner?.id ?? null,
        primaryUserId: owner.id,
        createdBy: owner.id,
      }).returning();

      await tx
        .insert(contactActivityCompanies)
        .values({ activityId: activity.id, companyId: company.id })
        .onConflictDoNothing();
      if (partner) {
        await tx
          .insert(contactActivityPartners)
          .values({ activityId: activity.id, partnerId: partner.id })
          .onConflictDoNothing();
      }
      await tx
        .insert(contactActivityAttendees)
        .values({ activityId: activity.id, userId: owner.id })
        .onConflictDoNothing();
    });
    imported += 1;
  }

  return NextResponse.json({
    received: messages.length,
    imported,
    skipped,
    unmatched,
  });
}
