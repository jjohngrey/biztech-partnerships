import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  listCompanyDirectory,
  listCurrentPipeline,
  listPartnerDirectory,
} from "@/lib/partnerships/repository";

export const dynamic = "force-dynamic";

function csvCell(value: string | number | null | undefined) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function csvRow(values: Array<string | number | null | undefined>) {
  return values.map(csvCell).join(",");
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [companies, partners, pipeline] = await Promise.all([
    listCompanyDirectory(),
    listPartnerDirectory(),
    listCurrentPipeline(),
  ]);

  const rows = [
    csvRow([
      "record_type",
      "company",
      "partner",
      "email",
      "website",
      "event",
      "status",
      "sponsorship_package",
      "next_outreach",
      "biztech_director",
      "notes",
    ]),
    ...companies.map((company) =>
      csvRow([
        "company",
        company.name,
        company.primaryContact?.name ?? "",
        company.primaryContact?.email ?? "",
        company.website ?? "",
        company.eventAttendances
          .map((attendance) => `${attendance.eventName} (${attendance.eventRole}, ${attendance.eventStatus})`)
          .join("; "),
        company.latestStatus ?? "",
        "",
        company.nextFollowUpDate ?? "",
        "",
        company.notes ?? "",
      ]),
    ),
    ...partners.map((partner) =>
      csvRow([
        "partner",
        partner.companyName,
        partner.name,
        partner.email ?? "",
        "",
        partner.eventAttendances
          .map((attendance) => `${attendance.eventName} (${attendance.eventRole}, ${attendance.eventStatus})`)
          .join("; "),
        partner.latestStatus ?? "",
        "",
        partner.nextFollowUpDate ?? "",
        partner.directors.map((director) => director.name).join("; "),
        partner.notes ?? "",
      ]),
    ),
    ...pipeline.map((deal) =>
      csvRow([
        "conversation",
        deal.partnerName,
        deal.primaryContactName ?? "",
        "",
        "",
        deal.eventName,
        deal.status,
        deal.tier ?? "",
        deal.followUpDate ?? "",
        deal.ownerName ?? "",
        deal.notes ?? "",
      ]),
    ),
  ];

  return new Response(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="partnerships-crm-export.csv"',
    },
  });
}
