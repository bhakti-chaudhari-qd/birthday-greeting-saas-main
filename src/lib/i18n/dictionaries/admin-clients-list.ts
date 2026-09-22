import type { Locale } from "../constants";

export type AdminClientsListDict = {
  title: string;
  description: string;
  addClient: string;
  colClient: string;
  colVendor: string;
  colHealth: string;
  colMessaging: string;
  noClientsYet: string;
  noPlan: string;
  noConnectedVendor: string;
  referredBy: (vendorName: string) => string;
  noReferral: string;
  noDeliveriesThisMonth: string;
  successThisMonth: (percent: number) => string;
  failedThisMonth: (count: string) => string;
  queuedNow: (count: string) => string;
  stuckNeedAttention: (count: string) => string;
  retrying: (count: string) => string;
};

const ADMIN_CLIENTS_LIST_DICT: Record<Locale, AdminClientsListDict> = {
  en: {
    title: "Clients",
    description:
      "All clients on the platform. Open a row to manage status, plan, limits, and users.",
    addClient: "Add client",
    colClient: "Client",
    colVendor: "Vendor",
    colHealth: "Health",
    colMessaging: "Messaging",
    noClientsYet: "No clients yet.",
    noPlan: "No plan",
    noConnectedVendor: "No connected vendor",
    referredBy: (vendorName) => `Referred by ${vendorName}`,
    noReferral: "No referral",
    noDeliveriesThisMonth: "No deliveries this month",
    successThisMonth: (percent) => `${percent}% success this month`,
    failedThisMonth: (count) => `${count} failed this month`,
    queuedNow: (count) => `${count} queued now`,
    stuckNeedAttention: (count) => `${count} stuck, need attention`,
    retrying: (count) => `${count} retrying`,
  },
  hi: {
    title: "क्लायंट",
    description:
      "प्लेटफ़ॉर्म के सभी क्लायंट। स्टेटस, प्लान, लिमिट और यूज़र मैनेज करने के लिए कोई रो खोलें।",
    addClient: "क्लायंट जोड़ें",
    colClient: "क्लायंट",
    colVendor: "वेंडर",
    colHealth: "हेल्थ",
    colMessaging: "मेसेजिंग",
    noClientsYet: "अभी तक कोई क्लायंट नहीं।",
    noPlan: "कोई प्लान नहीं",
    noConnectedVendor: "कोई वेंडर कनेक्टेड नहीं",
    referredBy: (vendorName) => `${vendorName} द्वारा रेफ़र किया गया`,
    noReferral: "कोई रेफ़रल नहीं",
    noDeliveriesThisMonth: "इस महीने कोई डिलीवरी नहीं",
    successThisMonth: (percent) => `इस महीने ${percent}% सक्सेस`,
    failedThisMonth: (count) => `इस महीने ${count} फ़ेल`,
    queuedNow: (count) => `अभी ${count} क्यू में`,
    stuckNeedAttention: (count) => `${count} अटके हुए, ध्यान चाहिए`,
    retrying: (count) => `${count} फिर कोशिश हो रही`,
  },
  mr: {
    title: "क्लायंट",
    description:
      "प्लॅटफॉर्मवरील सर्व क्लायंट. स्टेटस, प्लॅन, लिमिट आणि युजर्स व्यवस्थापित करण्यासाठी एखादी रो उघडा.",
    addClient: "क्लायंट जोडा",
    colClient: "क्लायंट",
    colVendor: "व्हेंडर",
    colHealth: "हेल्थ",
    colMessaging: "मेसेजिंग",
    noClientsYet: "अजून कोणतेही क्लायंट नाहीत.",
    noPlan: "प्लॅन नाही",
    noConnectedVendor: "कोणताही व्हेंडर कनेक्ट केलेला नाही",
    referredBy: (vendorName) => `${vendorName} द्वारे रेफर केले`,
    noReferral: "रेफरल नाही",
    noDeliveriesThisMonth: "या महिन्यात कोणतीही डिलिव्हरी नाही",
    successThisMonth: (percent) => `या महिन्यात ${percent}% यशस्वी`,
    failedThisMonth: (count) => `या महिन्यात ${count} फेल`,
    queuedNow: (count) => `आत्ता ${count} क्यूमध्ये`,
    stuckNeedAttention: (count) => `${count} अडकलेले, लक्ष द्यावे`,
    retrying: (count) => `${count} पुन्हा प्रयत्न होत आहे`,
  },
};

export function getAdminClientsListDict(locale: Locale): AdminClientsListDict {
  return ADMIN_CLIENTS_LIST_DICT[locale];
}
