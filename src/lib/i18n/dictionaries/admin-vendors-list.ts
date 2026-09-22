import type { Locale } from "../constants";

export type AdminVendorsListDict = {
  title: string;
  description: string;
  createVendor: string;
  colName: string;
  colMobile: string;
  colLifecycle: string;
  colLatestInvitation: string;
  colAccount: string;
  colUsers: string;
  colReferrals: string;
  colCurrentActiveConnections: string;
  colCurrentRoutedDeliveries: string;
  noVendorsYet: string;
  active: string;
  suspended: string;
  noDecidedDeliveries: string;
  successPercent: (percent: number) => string;
};

const ADMIN_VENDORS_LIST_DICT: Record<Locale, AdminVendorsListDict> = {
  en: {
    title: "Vendors",
    description: "Manage channel partners from invitation through approval.",
    createVendor: "Create vendor",
    colName: "Name",
    colMobile: "Mobile",
    colLifecycle: "Lifecycle",
    colLatestInvitation: "Latest invitation",
    colAccount: "Account",
    colUsers: "Users",
    colReferrals: "Referrals",
    colCurrentActiveConnections: "Current active connections",
    colCurrentRoutedDeliveries: "Current-routed deliveries this month (IST)",
    noVendorsYet: "No vendors yet.",
    active: "Active",
    suspended: "Suspended",
    noDecidedDeliveries: "No decided deliveries",
    successPercent: (percent) => `${percent}% success`,
  },
  hi: {
    title: "वेंडर",
    description: "इनविटेशन से लेकर अप्रूवल तक चैनल पार्टनर मैनेज करें।",
    createVendor: "वेंडर बनाएँ",
    colName: "नाम",
    colMobile: "मोबाइल",
    colLifecycle: "लाइफ़साइकल",
    colLatestInvitation: "पिछला इनविटेशन",
    colAccount: "अकाउंट",
    colUsers: "यूज़र",
    colReferrals: "रेफ़रल",
    colCurrentActiveConnections: "करंट एक्टिव कनेक्शन",
    colCurrentRoutedDeliveries: "करंट-रूटेड डिलीवरी इस महीने (IST)",
    noVendorsYet: "अभी तक कोई वेंडर नहीं।",
    active: "एक्टिव",
    suspended: "सस्पेंडेड",
    noDecidedDeliveries: "कोई तय डिलीवरी नहीं",
    successPercent: (percent) => `${percent}% सक्सेस`,
  },
  mr: {
    title: "व्हेंडर",
    description: "इनव्हिटेशनपासून अ‍ॅप्रूव्हलपर्यंत चॅनेल पार्टनर व्यवस्थापित करा.",
    createVendor: "व्हेंडर तयार करा",
    colName: "नाव",
    colMobile: "मोबाइल",
    colLifecycle: "लाइफसायकल",
    colLatestInvitation: "मागील इनव्हिटेशन",
    colAccount: "अकाउंट",
    colUsers: "युजर्स",
    colReferrals: "रेफरल्स",
    colCurrentActiveConnections: "करंट अ‍ॅक्टिव्ह कनेक्शन्स",
    colCurrentRoutedDeliveries: "करंट-राउटेड डिलिव्हरी या महिन्यात (IST)",
    noVendorsYet: "अजून कोणतेही व्हेंडर नाहीत.",
    active: "अ‍ॅक्टिव्ह",
    suspended: "सस्पेंडेड",
    noDecidedDeliveries: "कोणतीही ठरलेली डिलिव्हरी नाही",
    successPercent: (percent) => `${percent}% यशस्वी`,
  },
};

export function getAdminVendorsListDict(locale: Locale): AdminVendorsListDict {
  return ADMIN_VENDORS_LIST_DICT[locale];
}
