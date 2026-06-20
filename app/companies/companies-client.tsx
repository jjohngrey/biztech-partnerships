"use client";

import { CompaniesDirectory } from "@/components/partnerships-directory";
import type {
  CompanyDirectoryRecord,
  CrmEventSummary,
  CrmUserSummary,
  MeetingLogRecord,
  PaginationMeta,
  PartnerDirectoryRecord,
} from "@/lib/partnerships/types";

type CompaniesClientProps = {
  companiesResult: PaginationMeta & {
    data: CompanyDirectoryRecord[];
  };
  events: CrmEventSummary[];
  users: CrmUserSummary[];
  partners: PartnerDirectoryRecord[];
  meetings: MeetingLogRecord[];
  initialCompanyId?: string;
  currentUserId?: string;
};

export function CompaniesClient({ companiesResult, ...props }: CompaniesClientProps) {
  return (
    <CompaniesDirectory
      companies={companiesResult.data}
      paginationMeta={companiesResult}
      {...props}
    />
  );
}
