import type { CrmShellData, CrmShellPartner } from "@/components/crm-shell";
import {
  getDashboard,
  listPartnerAccounts,
  listPipelineDeals,
} from "@/lib/partnerships/repository";
import type { CrmStatus } from "@/lib/partnerships/types";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value / 100);

const statusToUi = (status: CrmStatus | null): CrmShellPartner["status"] => {
  switch (status) {
    case "confirmed":
    case "paid":
      return "Active";
    case "declined":
    case "backed_out":
      return "Stalled";
    case "followed_up":
    case "in_conversation":
    case "shortlist":
      return "Warm";
    default:
      return "Renewal";
  }
};

export async function getCrmShellData(): Promise<CrmShellData> {
  let dashboard;
  let partners;
  let deals;

  try {
    [dashboard, partners, deals] = await Promise.all([
      getDashboard(),
      listPartnerAccounts(),
      listPipelineDeals(),
    ]);
  } catch (error) {
    console.warn("[partnerships/view-model] using static CRM fallback", error);
    return {};
  }

  return {
    overview: [
      {
        label: "Partner revenue",
        value: formatCurrency(dashboard.securedValue),
        delta: `${Math.round(dashboard.annualProgressPct)}%`,
        note: "secured toward current goals",
      },
      {
        label: "Open pipeline",
        value: formatCurrency(dashboard.openPipelineValue),
        delta: `${deals.length} deals`,
        note: "active sponsorship opportunities",
      },
      {
        label: "Partners",
        value: String(dashboard.partnerCount),
        delta: `${dashboard.eventCount} events`,
        note: "active accounts in CRM",
      },
      {
        label: "Follow-ups due",
        value: String(dashboard.followUpsDueCount),
        delta: "7 days",
        note: "next actions in window",
      },
    ],
    partners: partners.slice(0, 8).map((partner) => ({
      name: partner.name,
      owner: partner.primaryContact?.name ?? "Unassigned",
      stage: partner.latestStatus
        ? partner.latestStatus.replaceAll("_", " ")
        : "No deal yet",
      tier: partner.tier ?? "Unscored",
      value: formatCurrency(partner.pipelineValue + partner.securedValue),
      nextStep: partner.nextFollowUpDate
        ? `Follow up ${partner.nextFollowUpDate}`
        : "No follow-up set",
      status: statusToUi(partner.latestStatus),
    })),
    pipeline: dashboard.pipelineByStatus.slice(0, 5).map((stage) => ({
      name: stage.status.replaceAll("_", " "),
      count: stage.count,
      value: formatCurrency(stage.value),
      progress:
        dashboard.openPipelineValue > 0
          ? Math.max(
              8,
              Math.round((stage.value / dashboard.openPipelineValue) * 100),
            )
          : 0,
    })),
    activity: dashboard.upcomingFollowUps.length
      ? dashboard.upcomingFollowUps.map(
          (deal) =>
            `${deal.partnerName}: ${deal.eventName} follow-up ${deal.followUpDate}`,
        )
      : ["No follow-ups due this week"],
  };
}
