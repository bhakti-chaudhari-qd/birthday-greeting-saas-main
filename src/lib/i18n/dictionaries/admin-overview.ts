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
  expiringPlansTitle: (days: number) => string;
  expiringPlansHint: string;
  noExpiringPlans: string;
  daysLeft: (days: number) => string;
  endsOn: (date: string) => string;
  exhaustedTitle: string;
  exhaustedHint: string;
  noExhausted: string;
  allChannels: string;
  viewList: string;
  hideList: string;
  channel: { SMS: string; WHATSAPP: string; EMAIL: string; CALL: string };
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
    expiringPlansTitle: (days) => `Plans expiring in ${days} days`,
    expiringPlansHint: "Paid plans ending soon. Renew them before the client loses access.",
    noExpiringPlans: "No plan ends in the next few days.",
    daysLeft: (days) => (days === 1 ? "1 day left" : `${days} days left`),
    endsOn: (date) => `Ends ${date}`,
    exhaustedTitle: "Message limits used up",
    exhaustedHint: "Clients that have sent every message their plan allows this month on a channel.",
    noExhausted: "No client has used up a limit this month.",
    allChannels: "All channels",
    viewList: "View list",
    hideList: "Hide list",
    channel: { SMS: "SMS", WHATSAPP: "WhatsApp", EMAIL: "Email", CALL: "Call" },
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
    expiringPlansTitle: (days) => `${days} दिनों में ख़त्म होने वाले प्लान`,
    expiringPlansHint: "जल्द ख़त्म होने वाले पेड प्लान। क्लायंट की एक्सेस बंद होने से पहले रिन्यू करें।",
    noExpiringPlans: "अगले कुछ दिनों में कोई प्लान ख़त्म नहीं हो रहा।",
    daysLeft: (days) => (days === 1 ? "1 दिन बाकी" : `${days} दिन बाकी`),
    endsOn: (date) => `${date} को ख़त्म`,
    exhaustedTitle: "मेसेज लिमिट पूरी हो गई",
    exhaustedHint: "जिन क्लायंट ने इस महीने किसी चैनल पर प्लान के सारे मेसेज भेज दिए हैं।",
    noExhausted: "इस महीने किसी क्लायंट की लिमिट पूरी नहीं हुई।",
    allChannels: "सभी चैनल",
    viewList: "लिस्ट देखें",
    hideList: "लिस्ट छिपाएँ",
    channel: { SMS: "SMS", WHATSAPP: "WhatsApp", EMAIL: "ईमेल", CALL: "कॉल" },
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
    expiringPlansTitle: (days) => `${days} दिवसांत संपणारे प्लान`,
    expiringPlansHint: "लवकरच संपणारे पेड प्लान. क्लायंटची अ‍ॅक्सेस बंद होण्याआधी रिन्यू करा.",
    noExpiringPlans: "पुढच्या काही दिवसांत कोणताही प्लान संपत नाही.",
    daysLeft: (days) => (days === 1 ? "1 दिवस बाकी" : `${days} दिवस बाकी`),
    endsOn: (date) => `${date} ला संपतो`,
    exhaustedTitle: "मेसेज लिमिट संपली",
    exhaustedHint: "ज्या क्लायंटनी या महिन्यात एखाद्या चॅनेलवर प्लानचे सर्व मेसेज पाठवले आहेत.",
    noExhausted: "या महिन्यात कोणत्याही क्लायंटची लिमिट संपलेली नाही.",
    allChannels: "सर्व चॅनेल्स",
    viewList: "यादी पहा",
    hideList: "यादी लपवा",
    channel: { SMS: "SMS", WHATSAPP: "WhatsApp", EMAIL: "ईमेल", CALL: "कॉल" },
  },
};

export function getAdminOverviewDict(locale: Locale): AdminOverviewDict {
  return ADMIN_OVERVIEW_DICT[locale];
}
