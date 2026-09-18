import type { Locale } from "../constants";

export type ActivityDict = {
  header: {
    title: string;
    subtitle: string;
    exportCsv: string;
    refreshAria: string;
  };
  summary: {
    todayTotal: string;
    periodTotal: (period: string) => string;
    sentSuccessfully: string;
    failed: string;
    pending: string;
  };
  filters: {
    searchRecipient: string;
    searchPlaceholder: string;
    statusFilter: string;
    allStatuses: string;
    sent: string;
    failed: string;
    pending: string;
    occasionFilter: string;
    allOccasions: string;
    channelFilter: string;
    allChannels: string;
    fromDate: string;
    toDate: string;
    moreFilters: string;
    category: string;
    allGroups: string;
  };
  chips: {
    statusPrefix: string;
    occasionFallback: string;
    categoryFallback: string;
  };
  emptyState: {
    title: string;
    description: string;
    clearFilters: string;
  };
  group: {
    hideDetails: string;
    viewDetails: string;
    sentCount: string;
    failedCount: string;
    pendingCount: string;
    colRecipient: string;
    colChannel: string;
    colStatus: string;
    colTime: string;
    colDetailsSr: string;
    retry: string;
    retrying: string;
    statusSuccess: string;
    statusFailed: string;
    statusProcessing: string;
    statusPending: string;
    today: string;
  };
  loadMore: {
    loading: string;
    loadMore: string;
  };
  messages: {
    couldNotLoadActivity: string;
    couldNotLoadActivityConn: string;
    retryConfirm: (name: string) => string;
    retryConfirmAmbiguous: (name: string) => string;
    couldNotRetry: string;
    couldNotRetryConn: string;
  };
  loadingAria: string;
};

const ACTIVITY_DICT: Record<Locale, ActivityDict> = {
  en: {
    header: {
      title: "Activity",
      subtitle: "Track greeting deliveries and message history.",
      exportCsv: "Export CSV",
      refreshAria: "Refresh activity",
    },
    summary: {
      todayTotal: "Today's Total",
      periodTotal: (period) => `${period} Total`,
      sentSuccessfully: "Sent Successfully",
      failed: "Failed",
      pending: "Pending",
    },
    filters: {
      searchRecipient: "Search recipient",
      searchPlaceholder: "Search recipient...",
      statusFilter: "Status filter",
      allStatuses: "All statuses",
      sent: "Sent",
      failed: "Failed",
      pending: "Pending",
      occasionFilter: "Occasion filter",
      allOccasions: "All occasions",
      channelFilter: "Channel filter",
      allChannels: "All channels",
      fromDate: "From date",
      toDate: "To date",
      moreFilters: "More Filters",
      category: "Category",
      allGroups: "All groups",
    },
    chips: {
      statusPrefix: "Status:",
      occasionFallback: "Occasion",
      categoryFallback: "Category",
    },
    emptyState: {
      title: "No activity found",
      description:
        "Greeting deliveries will appear here once automations start sending messages.",
      clearFilters: "Clear Filters",
    },
    group: {
      hideDetails: "Hide Details",
      viewDetails: "View Details ›",
      sentCount: "Sent",
      failedCount: "Failed",
      pendingCount: "Pending",
      colRecipient: "Recipient",
      colChannel: "Channel",
      colStatus: "Status",
      colTime: "Time",
      colDetailsSr: "Details",
      retry: "Retry",
      retrying: "Retrying…",
      statusSuccess: "Success",
      statusFailed: "Failed",
      statusProcessing: "Processing",
      statusPending: "Pending",
      today: "Today",
    },
    loadMore: {
      loading: "Loading more…",
      loadMore: "Load more activity",
    },
    messages: {
      couldNotLoadActivity: "Could not load activity. Try again.",
      couldNotLoadActivityConn:
        "Could not load activity. Check your connection and try again.",
      retryConfirm: (name) => `Retry the greeting for ${name}?`,
      retryConfirmAmbiguous: (name) =>
        `Retry the greeting for ${name}?\n\nThis may send a second message if the first already went through.`,
      couldNotRetry: "Could not retry greeting.",
      couldNotRetryConn: "Could not retry greeting. Check your connection and try again.",
    },
    loadingAria: "Loading activity",
  },
  hi: {
    header: {
      title: "एक्टिविटी",
      subtitle: "ग्रीटिंग डिलीवरी और मेसेज इतिहास देखें।",
      exportCsv: "CSV एक्सपोर्ट करें",
      refreshAria: "एक्टिविटी रीफ़्रेश करें",
    },
    summary: {
      todayTotal: "आज का कुल",
      periodTotal: (period) => `${period} का कुल`,
      sentSuccessfully: "सफलतापूर्वक भेजे गए",
      failed: "असफल",
      pending: "पेंडिंग",
    },
    filters: {
      searchRecipient: "प्राप्तकर्ता खोजें",
      searchPlaceholder: "प्राप्तकर्ता खोजें...",
      statusFilter: "स्टेटस फ़िल्टर",
      allStatuses: "सभी स्टेटस",
      sent: "भेजा गया",
      failed: "असफल",
      pending: "पेंडिंग",
      occasionFilter: "अवसर फ़िल्टर",
      allOccasions: "सभी अवसर",
      channelFilter: "चैनल फ़िल्टर",
      allChannels: "सभी चैनल",
      fromDate: "से तारीख",
      toDate: "तक तारीख",
      moreFilters: "और फ़िल्टर",
      category: "श्रेणी",
      allGroups: "सभी समूह",
    },
    chips: {
      statusPrefix: "स्टेटस:",
      occasionFallback: "अवसर",
      categoryFallback: "श्रेणी",
    },
    emptyState: {
      title: "कोई एक्टिविटी नहीं मिली",
      description:
        "ऑटोमेशन से मेसेज भेजना शुरू होते ही ग्रीटिंग डिलीवरी यहाँ दिखेंगी।",
      clearFilters: "फ़िल्टर हटाएँ",
    },
    group: {
      hideDetails: "विवरण छिपाएँ",
      viewDetails: "विवरण देखें ›",
      sentCount: "भेजा गया",
      failedCount: "असफल",
      pendingCount: "पेंडिंग",
      colRecipient: "प्राप्तकर्ता",
      colChannel: "चैनल",
      colStatus: "स्टेटस",
      colTime: "समय",
      colDetailsSr: "विवरण",
      retry: "फिर कोशिश करें",
      retrying: "फिर कोशिश हो रही है…",
      statusSuccess: "सफल",
      statusFailed: "असफल",
      statusProcessing: "प्रोसेस हो रहा है",
      statusPending: "पेंडिंग",
      today: "आज",
    },
    loadMore: {
      loading: "और लोड हो रहा है…",
      loadMore: "और एक्टिविटी लोड करें",
    },
    messages: {
      couldNotLoadActivity: "एक्टिविटी लोड नहीं हो सकी। फिर कोशिश करें।",
      couldNotLoadActivityConn:
        "एक्टिविटी लोड नहीं हो सकी। अपना कनेक्शन जाँचें और फिर कोशिश करें।",
      retryConfirm: (name) => `${name} के लिए ग्रीटिंग फिर भेजें?`,
      retryConfirmAmbiguous: (name) =>
        `${name} के लिए ग्रीटिंग फिर भेजें?\n\nअगर पहला मेसेज पहले ही पहुँच चुका है, तो यह दूसरा मेसेज भेज सकता है।`,
      couldNotRetry: "ग्रीटिंग फिर से नहीं भेजी जा सकी।",
      couldNotRetryConn:
        "ग्रीटिंग फिर से नहीं भेजी जा सकी। अपना कनेक्शन जाँचें और फिर कोशिश करें।",
    },
    loadingAria: "एक्टिविटी लोड हो रही है",
  },
  mr: {
    header: {
      title: "अ‍ॅक्टिव्हिटी",
      subtitle: "ग्रीटिंग डिलिव्हरी आणि मेसेज इतिहास पाहा.",
      exportCsv: "CSV एक्सपोर्ट करा",
      refreshAria: "अ‍ॅक्टिव्हिटी रिफ्रेश करा",
    },
    summary: {
      todayTotal: "आजचे एकूण",
      periodTotal: (period) => `${period} चे एकूण`,
      sentSuccessfully: "यशस्वीरित्या पाठवले",
      failed: "अयशस्वी",
      pending: "पेंडिंग",
    },
    filters: {
      searchRecipient: "प्राप्तकर्ता शोधा",
      searchPlaceholder: "प्राप्तकर्ता शोधा...",
      statusFilter: "स्टेटस फिल्टर",
      allStatuses: "सर्व स्टेटस",
      sent: "पाठवले",
      failed: "अयशस्वी",
      pending: "पेंडिंग",
      occasionFilter: "प्रसंग फिल्टर",
      allOccasions: "सर्व प्रसंग",
      channelFilter: "चॅनेल फिल्टर",
      allChannels: "सर्व चॅनेल",
      fromDate: "पासूनची तारीख",
      toDate: "पर्यंतची तारीख",
      moreFilters: "अधिक फिल्टर",
      category: "श्रेणी",
      allGroups: "सर्व गट",
    },
    chips: {
      statusPrefix: "स्टेटस:",
      occasionFallback: "प्रसंग",
      categoryFallback: "श्रेणी",
    },
    emptyState: {
      title: "कोणतीही अ‍ॅक्टिव्हिटी सापडली नाही",
      description:
        "ऑटोमेशनने मेसेज पाठवणे सुरू केल्यावर ग्रीटिंग डिलिव्हरी इथे दिसतील.",
      clearFilters: "फिल्टर हटवा",
    },
    group: {
      hideDetails: "तपशील लपवा",
      viewDetails: "तपशील पाहा ›",
      sentCount: "पाठवले",
      failedCount: "अयशस्वी",
      pendingCount: "पेंडिंग",
      colRecipient: "प्राप्तकर्ता",
      colChannel: "चॅनेल",
      colStatus: "स्टेटस",
      colTime: "वेळ",
      colDetailsSr: "तपशील",
      retry: "पुन्हा प्रयत्न करा",
      retrying: "पुन्हा प्रयत्न होत आहे…",
      statusSuccess: "यशस्वी",
      statusFailed: "अयशस्वी",
      statusProcessing: "प्रोसेस होत आहे",
      statusPending: "पेंडिंग",
      today: "आज",
    },
    loadMore: {
      loading: "अधिक लोड होत आहे…",
      loadMore: "अधिक अ‍ॅक्टिव्हिटी लोड करा",
    },
    messages: {
      couldNotLoadActivity: "अ‍ॅक्टिव्हिटी लोड होऊ शकली नाही. पुन्हा प्रयत्न करा.",
      couldNotLoadActivityConn:
        "अ‍ॅक्टिव्हिटी लोड होऊ शकली नाही. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.",
      retryConfirm: (name) => `${name} साठी ग्रीटिंग पुन्हा पाठवायची?`,
      retryConfirmAmbiguous: (name) =>
        `${name} साठी ग्रीटिंग पुन्हा पाठवायची?\n\nपहिला मेसेज आधीच पोहोचला असेल, तर हा दुसरा मेसेज पाठवू शकतो.`,
      couldNotRetry: "ग्रीटिंग पुन्हा पाठवता आली नाही.",
      couldNotRetryConn:
        "ग्रीटिंग पुन्हा पाठवता आली नाही. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.",
    },
    loadingAria: "अ‍ॅक्टिव्हिटी लोड होत आहे",
  },
};

export function getActivityDict(locale: Locale): ActivityDict {
  return ACTIVITY_DICT[locale];
}
