import type { Locale } from "../constants";

export type AdminOverviewDict = {
  title: string;
  description: string;
  viewClients: string;
  stat: {
    clients: string;
    clientsHint: (active: string, inactive: string) => string;
    users: string;
    usersHint: string;
    contacts: string;
    contactsHint: string;
    messagesThisMonth: string;
    messagesThisMonthHint: string;
    deliveriesToday: string;
    deliveriesThisMonth: string;
    successRate: string;
    successRateHint: (ok: string, failed: string) => string;
    queue: string;
    queueHint: (sending: string, stuck: string) => string;
  };
  planMix: string;
  noSubscriptionsYet: string;
  clientsPanelTitle: string;
  viewAll: string;
  noClientsYet: string;
  noPlan: string;
  active: string;
  inactive: string;
  suspended: string;
  vendorsPanelTitle: string;
  vendorsCountHint: (total: string, activeApproved: string) => string;
  noVendorsYet: string;
  usersCount: (n: string) => string;
  referralsCount: (n: string) => string;
  currentActiveConnections: (n: string) => string;
  currentRoutedDeliveries: (n: string) => string;
  noDecidedDeliveries: string;
  successPercent: (pct: number) => string;
};

const ADMIN_OVERVIEW_DICT: Record<Locale, AdminOverviewDict> = {
  en: {
    title: "Overview",
    description:
      "Platform snapshot across all clients. Client workspaces stay separate from this portal.",
    viewClients: "View clients",
    stat: {
      clients: "Clients",
      clientsHint: (active, inactive) => `${active} active · ${inactive} inactive`,
      users: "Users",
      usersHint: "Across all clients",
      contacts: "Contacts",
      contactsHint: "Stored in Client portals",
      messagesThisMonth: "Messages this month",
      messagesThisMonthHint: "Sum of subscription counters",
      deliveriesToday: "Deliveries today",
      deliveriesThisMonth: "Deliveries this month",
      successRate: "Success rate",
      successRateHint: (ok, failed) => `${ok} ok · ${failed} failed`,
      queue: "Queue",
      queueHint: (sending, stuck) => `${sending} sending · ${stuck} failed (needs attention)`,
    },
    planMix: "Plan mix",
    noSubscriptionsYet: "No subscriptions yet.",
    clientsPanelTitle: "Clients",
    viewAll: "View all",
    noClientsYet: "No clients yet.",
    noPlan: "No plan",
    active: "Active",
    inactive: "Inactive",
    suspended: "Suspended",
    vendorsPanelTitle: "Vendors",
    vendorsCountHint: (total, activeApproved) => `${total} total · ${activeApproved} approved and active`,
    noVendorsYet: "No vendors yet.",
    usersCount: (n) => `${n} users`,
    referralsCount: (n) => `${n} referrals`,
    currentActiveConnections: (n) => `${n} current active connections`,
    currentRoutedDeliveries: (n) => `${n} current-routed deliveries this month (IST)`,
    noDecidedDeliveries: "No decided deliveries",
    successPercent: (pct) => `${pct}% success`,
  },
  hi: {
    title: "ओवरव्यू",
    description:
      "सभी क्लायंट का प्लेटफ़ॉर्म स्नैपशॉट। क्लायंट वर्कस्पेस इस पोर्टल से अलग रहते हैं।",
    viewClients: "क्लायंट देखें",
    stat: {
      clients: "क्लायंट",
      clientsHint: (active, inactive) => `${active} एक्टिव · ${inactive} इनएक्टिव`,
      users: "यूज़र",
      usersHint: "सभी क्लायंट में",
      contacts: "कॉन्टैक्ट्स",
      contactsHint: "क्लायंट पोर्टल में सेव",
      messagesThisMonth: "इस महीने के मेसेज",
      messagesThisMonthHint: "सब्सक्रिप्शन काउंटर का योग",
      deliveriesToday: "आज की डिलीवरी",
      deliveriesThisMonth: "इस महीने की डिलीवरी",
      successRate: "सक्सेस रेट",
      successRateHint: (ok, failed) => `${ok} ओके · ${failed} फ़ेल`,
      queue: "क्यू",
      queueHint: (sending, stuck) => `${sending} भेजे जा रहे · ${stuck} फ़ेल (ध्यान चाहिए)`,
    },
    planMix: "प्लान मिक्स",
    noSubscriptionsYet: "अभी तक कोई सब्सक्रिप्शन नहीं।",
    clientsPanelTitle: "क्लायंट",
    viewAll: "सभी देखें",
    noClientsYet: "अभी तक कोई क्लायंट नहीं।",
    noPlan: "कोई प्लान नहीं",
    active: "एक्टिव",
    inactive: "इनएक्टिव",
    suspended: "सस्पेंडेड",
    vendorsPanelTitle: "वेंडर",
    vendorsCountHint: (total, activeApproved) => `कुल ${total} · ${activeApproved} अप्रूव्ड और एक्टिव`,
    noVendorsYet: "अभी तक कोई वेंडर नहीं।",
    usersCount: (n) => `${n} यूज़र`,
    referralsCount: (n) => `${n} रेफ़रल`,
    currentActiveConnections: (n) => `${n} करंट एक्टिव कनेक्शन`,
    currentRoutedDeliveries: (n) => `${n} करंट-रूटेड डिलीवरी इस महीने (IST)`,
    noDecidedDeliveries: "कोई तय डिलीवरी नहीं",
    successPercent: (pct) => `${pct}% सक्सेस`,
  },
  mr: {
    title: "ओव्हरव्ह्यू",
    description:
      "सर्व क्लायंटचा प्लॅटफॉर्म स्नॅपशॉट. क्लायंट वर्कस्पेस या पोर्टलपासून वेगळे राहतात.",
    viewClients: "क्लायंट पहा",
    stat: {
      clients: "क्लायंट",
      clientsHint: (active, inactive) => `${active} अ‍ॅक्टिव्ह · ${inactive} इनअ‍ॅक्टिव्ह`,
      users: "युजर्स",
      usersHint: "सर्व क्लायंटमध्ये",
      contacts: "कॉन्टॅक्ट्स",
      contactsHint: "क्लायंट पोर्टलमध्ये साठवलेले",
      messagesThisMonth: "या महिन्याचे मेसेज",
      messagesThisMonthHint: "सबस्क्रिप्शन काउंटरची बेरीज",
      deliveriesToday: "आजच्या डिलिव्हरी",
      deliveriesThisMonth: "या महिन्याच्या डिलिव्हरी",
      successRate: "सक्सेस रेट",
      successRateHint: (ok, failed) => `${ok} ओके · ${failed} फेल`,
      queue: "क्यू",
      queueHint: (sending, stuck) => `${sending} पाठवले जात आहेत · ${stuck} फेल (लक्ष द्यावे)`,
    },
    planMix: "प्लॅन मिक्स",
    noSubscriptionsYet: "अजून कोणतेही सबस्क्रिप्शन नाही.",
    clientsPanelTitle: "क्लायंट",
    viewAll: "सर्व पहा",
    noClientsYet: "अजून कोणतेही क्लायंट नाहीत.",
    noPlan: "प्लॅन नाही",
    active: "अ‍ॅक्टिव्ह",
    inactive: "इनअ‍ॅक्टिव्ह",
    suspended: "सस्पेंडेड",
    vendorsPanelTitle: "व्हेंडर",
    vendorsCountHint: (total, activeApproved) => `एकूण ${total} · ${activeApproved} अ‍ॅप्रूव्ह्ड आणि अ‍ॅक्टिव्ह`,
    noVendorsYet: "अजून कोणतेही व्हेंडर नाहीत.",
    usersCount: (n) => `${n} युजर्स`,
    referralsCount: (n) => `${n} रेफरल्स`,
    currentActiveConnections: (n) => `${n} करंट अ‍ॅक्टिव्ह कनेक्शन्स`,
    currentRoutedDeliveries: (n) => `${n} करंट-राउटेड डिलिव्हरी या महिन्यात (IST)`,
    noDecidedDeliveries: "कोणतीही ठरलेली डिलिव्हरी नाही",
    successPercent: (pct) => `${pct}% यशस्वी`,
  },
};

export function getAdminOverviewDict(locale: Locale): AdminOverviewDict {
  return ADMIN_OVERVIEW_DICT[locale];
}
