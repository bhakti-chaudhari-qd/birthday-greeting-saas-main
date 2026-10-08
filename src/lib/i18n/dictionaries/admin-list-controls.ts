import type { Locale } from "../constants";

/** Shared wording for search, filter, sort and paging on Platform Admin lists. */
export type AdminListControlsDict = {
  searchClients: string;
  searchVendors: string;
  statusAll: string;
  statusActive: string;
  statusInactive: string;
  sortNewest: string;
  sortOldest: string;
  sortName: string;
  noMatches: string;
  previous: string;
  next: string;
  pageOf: (page: number, total: number) => string;
  showing: (count: number, total: number) => string;
  signedUp: (date: string) => string;
  contacts: (count: string) => string;
};

const ADMIN_LIST_CONTROLS_DICT: Record<Locale, AdminListControlsDict> = {
  en: {
    searchClients: "Search clients by name…",
    searchVendors: "Search vendors by name or mobile…",
    statusAll: "All statuses",
    statusActive: "Active",
    statusInactive: "Inactive",
    sortNewest: "Newest first",
    sortOldest: "Oldest first",
    sortName: "Name (A–Z)",
    noMatches: "Nothing matches your search.",
    previous: "Previous",
    next: "Next",
    pageOf: (page, total) => `Page ${page} of ${total}`,
    showing: (count, total) => `Showing ${count} of ${total}`,
    signedUp: (date) => `Signed up ${date}`,
    contacts: (count) => `${count} contacts`,
  },
  hi: {
    searchClients: "नाम से क्लायंट खोजें…",
    searchVendors: "नाम या मोबाइल से वेंडर खोजें…",
    statusAll: "सभी स्टेटस",
    statusActive: "एक्टिव",
    statusInactive: "इनएक्टिव",
    sortNewest: "नए पहले",
    sortOldest: "पुराने पहले",
    sortName: "नाम (A–Z)",
    noMatches: "आपकी खोज से कुछ नहीं मिला।",
    previous: "पिछला",
    next: "अगला",
    pageOf: (page, total) => `पेज ${page} / ${total}`,
    showing: (count, total) => `${total} में से ${count} दिख रहे हैं`,
    signedUp: (date) => `${date} को साइन अप`,
    contacts: (count) => `${count} कॉन्टैक्ट`,
  },
  mr: {
    searchClients: "नावाने क्लायंट शोधा…",
    searchVendors: "नाव किंवा मोबाइलने व्हेंडर शोधा…",
    statusAll: "सर्व स्टेटस",
    statusActive: "एक्टिव",
    statusInactive: "इनएक्टिव",
    sortNewest: "नवीन आधी",
    sortOldest: "जुने आधी",
    sortName: "नाव (A–Z)",
    noMatches: "तुमच्या शोधाशी काहीही जुळले नाही.",
    previous: "मागील",
    next: "पुढील",
    pageOf: (page, total) => `पेज ${page} / ${total}`,
    showing: (count, total) => `${total} पैकी ${count} दिसत आहेत`,
    signedUp: (date) => `${date} रोजी साइन अप`,
    contacts: (count) => `${count} कॉन्टॅक्ट`,
  },
};

export function getAdminListControlsDict(locale: Locale): AdminListControlsDict {
  return ADMIN_LIST_CONTROLS_DICT[locale];
}
