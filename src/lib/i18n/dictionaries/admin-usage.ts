import type { Locale } from "../constants";

export type AdminUsageDict = {
  title: string;
  description: string;
  stat: {
    deliveriesToday: string;
    deliveriesTodayHint: string;
    deliveriesThisMonth: string;
    deliveriesThisMonthHint: string;
    successfulThisMonth: string;
    successfulThisMonthHint: string;
    failedThisMonth: string;
    failedThisMonthHint: string;
  };
  reconciliation: (
    successful: string,
    failed: string,
    stillSending: string,
    deliveriesThisMonth: string,
  ) => string;
  queue: {
    title: string;
    subtitle: string;
    pending: string;
    sending: string;
    failedRetryable: string;
    failedStuck: string;
  };
  byStatus: {
    title: string;
    subtitle: string;
    empty: string;
  };
  byChannel: {
    title: string;
    subtitle: string;
    empty: string;
  };
  deliveryStatusLabels: Record<string, string>;
  nearContactLimit: string;
  nearMessageLimit: string;
  showingOf: (shown: number, total: string) => string;
  limitTable: {
    client: string;
    usage: string;
    status: string;
    empty: string;
    active: string;
    inactive: string;
  };
};

const ADMIN_USAGE_DICT: Record<Locale, AdminUsageDict> = {
  en: {
    title: "Usage",
    description:
      "Platform-wide delivery health, queue pressure, and tenants near their limits. No client contact details are shown. All time frames below (today, this month) are Indian Standard Time (IST).",
    stat: {
      deliveriesToday: "Deliveries today",
      deliveriesTodayHint: "Since midnight IST",
      deliveriesThisMonth: "Deliveries this month",
      deliveriesThisMonthHint: "Since the 1st of this month, IST",
      successfulThisMonth: "Successful this month",
      successfulThisMonthHint: "Submitted, delivered, or read",
      failedThisMonth: "Failed this month",
      failedThisMonthHint: "Failed or not delivered",
    },
    reconciliation: (successful, failed, stillSending, deliveriesThisMonth) =>
      `Successful (${successful}) + Failed (${failed}) + still sending (${stillSending}) = Deliveries this month (${deliveriesThisMonth}).`,
    queue: {
      title: "Queue right now",
      subtitle:
        'Live counts, not a monthly total - unrelated to "Failed this month" above, which counts finished attempts instead',
      pending: "Pending",
      sending: "Sending",
      failedRetryable: "Failed - will retry automatically",
      failedStuck: "Failed - needs attention",
    },
    byStatus: {
      title: "By status",
      subtitle: "This month, IST",
      empty: "No deliveries yet.",
    },
    byChannel: {
      title: "By channel",
      subtitle: "This month, IST",
      empty: "No deliveries yet.",
    },
    deliveryStatusLabels: {
      SENT: "Submitted",
      DELIVERED: "Delivered",
      UNDELIVERED: "Not delivered",
      FAILED: "Failed",
      QUEUED: "Sending",
      READ: "Read",
    },
    nearContactLimit: "Near contact limit (≥80%)",
    nearMessageLimit: "Near message limit (≥80% of this month's limit)",
    showingOf: (shown, total) => `Showing ${shown} of ${total}`,
    limitTable: {
      client: "Client",
      usage: "Usage",
      status: "Status",
      empty: "No clients near this limit.",
      active: "Active",
      inactive: "Inactive",
    },
  },
  hi: {
    title: "उपयोग",
    description:
      "प्लेटफ़ॉर्म-वाइड डिलीवरी हेल्थ, क्यू प्रेशर, और लिमिट के करीब पहुँच रहे क्लायंट। किसी क्लायंट की कॉन्टैक्ट डिटेल यहाँ नहीं दिखती। नीचे सभी टाइम फ़्रेम (आज, इस महीने) IST में हैं।",
    stat: {
      deliveriesToday: "आज की डिलीवरी",
      deliveriesTodayHint: "IST के अनुसार आधी रात से",
      deliveriesThisMonth: "इस महीने की डिलीवरी",
      deliveriesThisMonthHint: "इस महीने की 1 तारीख से, IST",
      successfulThisMonth: "इस महीने सफल",
      successfulThisMonthHint: "सबमिट, डिलीवर, या पढ़ी गईं",
      failedThisMonth: "इस महीने फ़ेल",
      failedThisMonthHint: "फ़ेल या डिलीवर नहीं हुईं",
    },
    reconciliation: (successful, failed, stillSending, deliveriesThisMonth) =>
      `सफल (${successful}) + फ़ेल (${failed}) + अभी भेजी जा रही (${stillSending}) = इस महीने की डिलीवरी (${deliveriesThisMonth}).`,
    queue: {
      title: "क्यू अभी",
      subtitle:
        "लाइव काउंट, महीने का टोटल नहीं - ऊपर के \"इस महीने फ़ेल\" से अलग है, जो पूरे हो चुके प्रयास गिनता है",
      pending: "पेंडिंग",
      sending: "भेजी जा रही",
      failedRetryable: "फ़ेल - अपने आप फिर कोशिश होगी",
      failedStuck: "फ़ेल - ध्यान चाहिए",
    },
    byStatus: {
      title: "स्टेटस के अनुसार",
      subtitle: "इस महीने, IST",
      empty: "अभी तक कोई डिलीवरी नहीं।",
    },
    byChannel: {
      title: "चैनल के अनुसार",
      subtitle: "इस महीने, IST",
      empty: "अभी तक कोई डिलीवरी नहीं।",
    },
    deliveryStatusLabels: {
      SENT: "सबमिट",
      DELIVERED: "डिलीवर्ड",
      UNDELIVERED: "डिलीवर नहीं हुआ",
      FAILED: "फ़ेल",
      QUEUED: "भेजी जा रही",
      READ: "पढ़ा गया",
    },
    nearContactLimit: "कॉन्टैक्ट लिमिट के करीब (≥80%)",
    nearMessageLimit: "मेसेज लिमिट के करीब (इस महीने की लिमिट का ≥80%)",
    showingOf: (shown, total) => `${total} में से ${shown} दिखाए जा रहे`,
    limitTable: {
      client: "क्लायंट",
      usage: "उपयोग",
      status: "स्टेटस",
      empty: "इस लिमिट के करीब कोई क्लायंट नहीं।",
      active: "एक्टिव",
      inactive: "इनएक्टिव",
    },
  },
  mr: {
    title: "वापर",
    description:
      "प्लॅटफॉर्म-वाइड डिलिव्हरी हेल्थ, क्यू प्रेशर, आणि लिमिटच्या जवळ पोहोचलेले क्लायंट. कोणत्याही क्लायंटचा कॉन्टॅक्ट तपशील इथे दाखवला जात नाही. खालील सर्व टाइम फ्रेम (आज, या महिन्यात) IST मध्ये आहेत.",
    stat: {
      deliveriesToday: "आजच्या डिलिव्हरी",
      deliveriesTodayHint: "IST नुसार मध्यरात्रीपासून",
      deliveriesThisMonth: "या महिन्याच्या डिलिव्हरी",
      deliveriesThisMonthHint: "या महिन्याच्या 1 तारखेपासून, IST",
      successfulThisMonth: "या महिन्यात यशस्वी",
      successfulThisMonthHint: "सबमिट, डिलिव्हर, किंवा वाचलेल्या",
      failedThisMonth: "या महिन्यात फेल",
      failedThisMonthHint: "फेल किंवा डिलिव्हर न झालेल्या",
    },
    reconciliation: (successful, failed, stillSending, deliveriesThisMonth) =>
      `यशस्वी (${successful}) + फेल (${failed}) + अजून पाठवल्या जात आहेत (${stillSending}) = या महिन्याच्या डिलिव्हरी (${deliveriesThisMonth}).`,
    queue: {
      title: "क्यू आत्ता",
      subtitle:
        "लाइव्ह काउंट, महिन्याची बेरीज नाही - वरील \"या महिन्यात फेल\" पेक्षा वेगळे आहे, जे पूर्ण झालेले प्रयत्न मोजते",
      pending: "पेंडिंग",
      sending: "पाठवले जात आहे",
      failedRetryable: "फेल - आपोआप पुन्हा प्रयत्न होईल",
      failedStuck: "फेल - लक्ष द्यावे",
    },
    byStatus: {
      title: "स्टेटसनुसार",
      subtitle: "या महिन्यात, IST",
      empty: "अजून कोणतीही डिलिव्हरी नाही.",
    },
    byChannel: {
      title: "चॅनेलनुसार",
      subtitle: "या महिन्यात, IST",
      empty: "अजून कोणतीही डिलिव्हरी नाही.",
    },
    deliveryStatusLabels: {
      SENT: "सबमिट",
      DELIVERED: "डिलिव्हर्ड",
      UNDELIVERED: "डिलिव्हर झाले नाही",
      FAILED: "फेल",
      QUEUED: "पाठवले जात आहे",
      READ: "वाचले",
    },
    nearContactLimit: "कॉन्टॅक्ट लिमिटच्या जवळ (≥80%)",
    nearMessageLimit: "मेसेज लिमिटच्या जवळ (या महिन्याच्या लिमिटच्या ≥80%)",
    showingOf: (shown, total) => `${total} पैकी ${shown} दाखवत आहे`,
    limitTable: {
      client: "क्लायंट",
      usage: "वापर",
      status: "स्टेटस",
      empty: "या लिमिटच्या जवळ कोणतेही क्लायंट नाहीत.",
      active: "अ‍ॅक्टिव्ह",
      inactive: "इनअ‍ॅक्टिव्ह",
    },
  },
};

export function getAdminUsageDict(locale: Locale): AdminUsageDict {
  return ADMIN_USAGE_DICT[locale];
}
