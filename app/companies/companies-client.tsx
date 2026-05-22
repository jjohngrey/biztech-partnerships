"use client";

import { CompaniesDirectory } from "@/components/partnerships-directory";
import type {
  CompanyDirectoryRecord,
  CompanyKind,
  CrmEventSummary,
  CrmUserSummary,
  MeetingLogRecord,
  PaginationMeta,
  PartnerDirectoryRecord,
} from "@/lib/partnerships/types";

type CompaniesClientProps = {
  companiesResult: PaginationMeta & {
    data: CompanyDirectoryRecord[];
    kindCounts: { sponsors: number; inKind: number; previous: number };
  };
  events: CrmEventSummary[];
  users: CrmUserSummary[];
  partners: PartnerDirectoryRecord[];
  meetings: MeetingLogRecord[];
  initialCompanyId?: string;
  initialKind?: CompanyKind;
};

export function CompaniesClient({ companiesResult, initialKind, ...props }: CompaniesClientProps) {
  return (
    <CompaniesDirectory
      companies={companiesResult.data}
      paginationMeta={companiesResult}
      kindCounts={companiesResult.kindCounts}
      initialKind={initialKind}
      {...props}
    />
  );
}
