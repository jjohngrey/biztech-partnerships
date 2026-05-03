"use client";

import { CompaniesDirectory } from "@/components/partnerships-directory";
import type {
  CompanyDirectoryRecord,
  CrmEventSummary,
  CrmUserSummary,
  MeetingLogRecord,
  PartnerDirectoryRecord,
} from "@/lib/partnerships/types";

type CompaniesClientProps = {
  companies: CompanyDirectoryRecord[];
  events: CrmEventSummary[];
  users: CrmUserSummary[];
  partners: PartnerDirectoryRecord[];
  meetings: MeetingLogRecord[];
  initialCompanyId?: string;
};

export function CompaniesClient(props: CompaniesClientProps) {
  return <CompaniesDirectory {...props} />;
}
