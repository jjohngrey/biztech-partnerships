import { unstable_cache } from "next/cache";
import {
  getDashboard,
  getEmailSyncSummary,
  listCompanyDirectory,
  listCompanyDirectoryPage,
  listCurrentPipeline,
  listEmailCampaigns,
  listEmailRecipients,
  listEmailRecipientsPage,
  listEmailTemplates,
  listEvents,
  listMeetingLogs,
  listMyAssignedEventIds,
  listMyContactPartners,
  listPartnerDirectory,
  listPartnerDirectoryPage,
  listTouchpoints,
  listUsers,
  listYears,
} from "./repository";
import type { CompanyKind, PaginationOptions } from "./types";

export const CRM_DATA_TAG = "crm-data";

const cacheOptions = { tags: [CRM_DATA_TAG], revalidate: 60 };

export const getCachedDashboard = unstable_cache(getDashboard, ["crm-dashboard"], cacheOptions);
export const getCachedEmailSyncSummary = unstable_cache(getEmailSyncSummary, ["crm-email-sync-summary"], cacheOptions);
export const listCachedCompanyDirectory = unstable_cache(listCompanyDirectory, ["crm-company-directory"], cacheOptions);
export const listCachedCurrentPipeline = unstable_cache(listCurrentPipeline, ["crm-current-pipeline"], cacheOptions);
export const listCachedEmailCampaigns = unstable_cache(listEmailCampaigns, ["crm-email-campaigns"], cacheOptions);
export const listCachedEmailRecipients = unstable_cache(listEmailRecipients, ["crm-email-recipients"], cacheOptions);
export const listCachedEmailTemplates = unstable_cache(listEmailTemplates, ["crm-email-templates"], cacheOptions);
export const listCachedEvents = unstable_cache(listEvents, ["crm-events"], cacheOptions);
export const listCachedMeetingLogs = unstable_cache(listMeetingLogs, ["crm-meeting-logs"], cacheOptions);
export const listCachedPartnerDirectory = unstable_cache(listPartnerDirectory, ["crm-partner-directory"], cacheOptions);
export const listCachedTouchpoints = unstable_cache(listTouchpoints, ["crm-touchpoints"], cacheOptions);
export const listCachedUsers = unstable_cache(listUsers, ["crm-users"], cacheOptions);
export const listCachedYears = unstable_cache(listYears, ["crm-years"], cacheOptions);

export const listCachedMyContactPartners = (userId: string) =>
  unstable_cache(
    () => listMyContactPartners(userId),
    ["crm-my-contact-partners", userId],
    cacheOptions,
  )();

export const listCachedMyAssignedEventIds = (userId: string) =>
  unstable_cache(
    () => listMyAssignedEventIds(userId),
    ["crm-my-assigned-event-ids", userId],
    cacheOptions,
  )();

export const listCachedCompanyDirectoryPage = (opts: PaginationOptions & { kind?: CompanyKind } = {}) =>
  unstable_cache(
    () => listCompanyDirectoryPage(opts),
    ["crm-company-directory-page", String(opts.page ?? 1), opts.kind ?? "", opts.search ?? ""],
    cacheOptions,
  )();

export const listCachedPartnerDirectoryPage = (opts: PaginationOptions = {}) =>
  unstable_cache(
    () => listPartnerDirectoryPage(opts),
    ["crm-partner-directory-page", String(opts.page ?? 1), opts.search ?? ""],
    cacheOptions,
  )();

export const listCachedEmailRecipientsPage = (opts: PaginationOptions = {}) =>
  unstable_cache(
    () => listEmailRecipientsPage(opts),
    ["crm-email-recipients-page", String(opts.page ?? 1), opts.search ?? ""],
    cacheOptions,
  )();
