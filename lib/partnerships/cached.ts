import { unstable_cache } from "next/cache";
import {
  listCompanyDirectory,
  listCompanyDirectoryPage,
  listEvents,
  listMeetingLogs,
  listPartnerDirectory,
  listPartnerDirectoryPage,
  listTouchpoints,
  listUsers,
  listYears,
} from "./repository";
import type { PaginationOptions } from "./types";

export const CRM_DATA_TAG = "crm-data";

const cacheOptions = { tags: [CRM_DATA_TAG], revalidate: 60 };

export const listCachedCompanyDirectory = unstable_cache(listCompanyDirectory, ["crm-company-directory"], cacheOptions);
export const listCachedEvents = unstable_cache(listEvents, ["crm-events"], cacheOptions);
export const listCachedMeetingLogs = unstable_cache(listMeetingLogs, ["crm-meeting-logs"], cacheOptions);
export const listCachedPartnerDirectory = unstable_cache(listPartnerDirectory, ["crm-partner-directory"], cacheOptions);
export const listCachedTouchpoints = unstable_cache(listTouchpoints, ["crm-touchpoints"], cacheOptions);
export const listCachedUsers = unstable_cache(listUsers, ["crm-users"], cacheOptions);
export const listCachedYears = unstable_cache(listYears, ["crm-years"], cacheOptions);

export const listCachedCompanyDirectoryPage = (opts: PaginationOptions = {}) =>
  unstable_cache(
    () => listCompanyDirectoryPage(opts),
    ["crm-company-directory-page", String(opts.page ?? 1), opts.search ?? ""],
    cacheOptions,
  )();

export const listCachedPartnerDirectoryPage = (opts: PaginationOptions = {}) =>
  unstable_cache(
    () => listPartnerDirectoryPage(opts),
    ["crm-partner-directory-page", String(opts.page ?? 1), opts.search ?? ""],
    cacheOptions,
  )();
