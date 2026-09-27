import type { Locale } from "../constants";

export type DeliveriesDict = {
  deliveries: {
    pageTitle: string;
    exporting: string;
    exportReport: string;
    viewScheduled: string;
    testMessagesNote: string;
    errors: {
      couldNotLoad: string;
      couldNotLoadRetry: string;
      couldNotExport: string;
      couldNotExportRetry: string;
      failedToRefreshStatus: string;
    };
    refreshedStatus: string;
    checkedStatus: string;
    statusLabel: string;
    ariaLabelStatusFilters: string;
    searchContact: string;
    moreStatusesLabel: string;
    moreStatusesOption: string;
    channelFilterLabel: string;
    allChannels: string;
    providerFilterLabel: string;
    allProviders: string;
    testProvider: string;
    liveCustomHttp: string;
    exportFollowsFilters: string;
    loadingResults: string;
    emptyTitleFiltered: string;
    emptyTitleDefault: string;
    emptyDescFiltered: string;
    emptyDescDefault: string;
    sendMessageAction: string;
    viewPendingAction: string;
    table: {
      contact: string;
      mobile: string;
      template: string;
      channel: string;
      provider: string;
      status: string;
      when: string;
      actionsSr: string;
    };
    simulatedWithVideo: string;
    submittedWithVideo: string;
    refreshing: string;
    refresh: string;
    pageOf: (page: number, totalPages: number, total: number) => string;
    previous: string;
    next: string;
  };
  generatedDocuments: {
    pageTitle: string;
    pageDescription: string;
    errors: {
      couldNotLoad: string;
      couldNotLoadRetry: string;
      couldNotDelete: string;
      couldNotDeleteRetry: string;
    };
    loading: string;
    emptyState: string;
    table: {
      file: string;
      template: string;
      generated: string;
      expires: string;
      status: string;
      actionsSr: string;
    };
    statusExpired: string;
    statusActive: string;
    view: string;
    download: string;
    deleting: string;
    delete: string;
    confirmDelete: (fileName: string) => string;
  };
};

const DELIVERIES_DICT: Record<Locale, DeliveriesDict> = {
  en: {
    deliveries: {
      pageTitle: "Submitted",
      exporting: "Exporting…",
      exportReport: "Export report",
      viewScheduled: "View Scheduled",
      testMessagesNote: "Test messages are simulated. Nothing was actually sent.",
      errors: {
        couldNotLoad: "Could not load delivery results.",
        couldNotLoadRetry: "Could not load delivery results. Try again.",
        couldNotExport: "Could not export submitted history. Try again.",
        couldNotExportRetry:
          "Could not export submitted history. Check your connection and try again.",
        failedToRefreshStatus: "Failed to refresh delivery status",
      },
      refreshedStatus: "Delivery status refreshed",
      checkedStatus: "Delivery status checked",
      statusLabel: "Status",
      ariaLabelStatusFilters: "Delivery status report filters",
      searchContact: "Search contact",
      moreStatusesLabel: "More statuses",
      moreStatusesOption: "More statuses…",
      channelFilterLabel: "Channel filter",
      allChannels: "All channels",
      providerFilterLabel: "Provider filter",
      allProviders: "All providers",
      testProvider: "Test",
      liveCustomHttp: "Live / Custom HTTP",
      exportFollowsFilters:
        "Export report follows your current filters (up to 5,000 rows).",
      loadingResults: "Loading delivery results…",
      emptyTitleFiltered: "No matching results",
      emptyTitleDefault: "No delivery results yet",
      emptyDescFiltered: "Try another filter, or clear filters.",
      emptyDescDefault: "Results appear after messages are processed.",
      sendMessageAction: "Send Message",
      viewPendingAction: "View Pending",
      table: {
        contact: "Contact",
        mobile: "Mobile",
        template: "Template",
        channel: "Channel",
        provider: "Provider",
        status: "Status",
        when: "When",
        actionsSr: "Actions",
      },
      simulatedWithVideo: "Simulated with video",
      submittedWithVideo: "Submitted with video",
      refreshing: "Refreshing…",
      refresh: "Refresh",
      pageOf: (page, totalPages, total) =>
        `Page ${page} of ${totalPages} (${total} total)`,
      previous: "Previous",
      next: "Next",
    },
    generatedDocuments: {
      pageTitle: "Generated Documents",
      pageDescription:
        "Personalized PDFs generated from your document templates. Kept for 7 days, then removed.",
      errors: {
        couldNotLoad: "Could not load generated documents.",
        couldNotLoadRetry:
          "Could not load generated documents. Check your connection and try again.",
        couldNotDelete: "Could not delete document.",
        couldNotDeleteRetry:
          "Could not delete document. Check your connection and try again.",
      },
      loading: "Loading generated documents...",
      emptyState:
        "No generated documents yet. Generate one from a document template's editor.",
      table: {
        file: "File",
        template: "Template",
        generated: "Generated",
        expires: "Expires",
        status: "Status",
        actionsSr: "Actions",
      },
      statusExpired: "Expired",
      statusActive: "Active",
      view: "View",
      download: "Download",
      deleting: "Deleting...",
      delete: "Delete",
      confirmDelete: (fileName) => `Delete "${fileName}"? This cannot be undone.`,
    },
  },
  hi: {
    deliveries: {
      pageTitle: "सबमिटेड",
      exporting: "एक्सपोर्ट हो रहा है…",
      exportReport: "रिपोर्ट एक्सपोर्ट करें",
      viewScheduled: "शेड्यूल्ड देखें",
      testMessagesNote: "टेस्ट मेसेज सिम्युलेटेड हैं। असल में कुछ भी नहीं भेजा गया।",
      errors: {
        couldNotLoad: "डिलीवरी रिज़ल्ट लोड नहीं हो सके।",
        couldNotLoadRetry: "डिलीवरी रिज़ल्ट लोड नहीं हो सके। फिर से कोशिश करें।",
        couldNotExport: "सबमिटेड हिस्ट्री एक्सपोर्ट नहीं हो सकी। फिर से कोशिश करें।",
        couldNotExportRetry:
          "सबमिटेड हिस्ट्री एक्सपोर्ट नहीं हो सकी। अपना कनेक्शन जांचें और फिर से कोशिश करें।",
        failedToRefreshStatus: "डिलीवरी स्टेटस रीफ़्रेश नहीं हो सका",
      },
      refreshedStatus: "डिलीवरी स्टेटस रीफ़्रेश हो गया",
      checkedStatus: "डिलीवरी स्टेटस चेक हो गया",
      statusLabel: "स्टेटस",
      ariaLabelStatusFilters: "डिलीवरी स्टेटस रिपोर्ट फ़िल्टर",
      searchContact: "कॉन्टैक्ट खोजें",
      moreStatusesLabel: "अन्य स्टेटस",
      moreStatusesOption: "अन्य स्टेटस…",
      channelFilterLabel: "चैनल फ़िल्टर",
      allChannels: "सभी चैनल",
      providerFilterLabel: "प्रोवाइडर फ़िल्टर",
      allProviders: "सभी प्रोवाइडर",
      testProvider: "टेस्ट",
      liveCustomHttp: "लाइव / कस्टम HTTP",
      exportFollowsFilters:
        "एक्सपोर्ट रिपोर्ट आपके मौजूदा फ़िल्टर के हिसाब से बनती है (5,000 रो तक)।",
      loadingResults: "डिलीवरी रिज़ल्ट लोड हो रहे हैं…",
      emptyTitleFiltered: "कोई मैचिंग रिज़ल्ट नहीं",
      emptyTitleDefault: "अभी तक कोई डिलीवरी रिज़ल्ट नहीं है",
      emptyDescFiltered: "कोई अन्य फ़िल्टर आज़माएं, या फ़िल्टर हटाएं।",
      emptyDescDefault: "मेसेज प्रोसेस होने के बाद रिज़ल्ट यहां दिखेंगे।",
      sendMessageAction: "मेसेज भेजें",
      viewPendingAction: "पेंडिंग देखें",
      table: {
        contact: "कॉन्टैक्ट",
        mobile: "मोबाइल",
        template: "टेम्पलेट",
        channel: "चैनल",
        provider: "प्रोवाइडर",
        status: "स्टेटस",
        when: "कब",
        actionsSr: "एक्शन",
      },
      simulatedWithVideo: "वीडियो के साथ सिम्युलेटेड",
      submittedWithVideo: "वीडियो के साथ सबमिटेड",
      refreshing: "रीफ़्रेश हो रहा है…",
      refresh: "रीफ़्रेश करें",
      pageOf: (page, totalPages, total) =>
        `पेज ${page} में से ${totalPages} (कुल ${total})`,
      previous: "पिछला",
      next: "अगला",
    },
    generatedDocuments: {
      pageTitle: "जनरेटेड डॉक्यूमेंट्स",
      pageDescription:
        "आपके डॉक्यूमेंट टेम्पलेट से बनाए गए पर्सनलाइज़्ड PDF। 7 दिनों तक रखे जाते हैं, फिर हटा दिए जाते हैं।",
      errors: {
        couldNotLoad: "जनरेटेड डॉक्यूमेंट लोड नहीं हो सके।",
        couldNotLoadRetry:
          "जनरेटेड डॉक्यूमेंट लोड नहीं हो सके। अपना कनेक्शन जांचें और फिर से कोशिश करें।",
        couldNotDelete: "डॉक्यूमेंट डिलीट नहीं हो सका।",
        couldNotDeleteRetry:
          "डॉक्यूमेंट डिलीट नहीं हो सका। अपना कनेक्शन जांचें और फिर से कोशिश करें।",
      },
      loading: "जनरेटेड डॉक्यूमेंट लोड हो रहे हैं...",
      emptyState:
        "अभी तक कोई जनरेटेड डॉक्यूमेंट नहीं है। किसी डॉक्यूमेंट टेम्पलेट के एडिटर से एक बनाएं।",
      table: {
        file: "फाइल",
        template: "टेम्पलेट",
        generated: "जनरेट किया गया",
        expires: "एक्सपायर होगा",
        status: "स्टेटस",
        actionsSr: "एक्शन",
      },
      statusExpired: "एक्सपायर हो गया",
      statusActive: "एक्टिव",
      view: "देखें",
      download: "डाउनलोड करें",
      deleting: "डिलीट हो रहा है...",
      delete: "डिलीट करें",
      confirmDelete: (fileName) => `"${fileName}" डिलीट करें? इसे वापस नहीं लिया जा सकता।`,
    },
  },
  mr: {
    deliveries: {
      pageTitle: "सबमिट केलेले",
      exporting: "एक्सपोर्ट होत आहे…",
      exportReport: "रिपोर्ट एक्सपोर्ट करा",
      viewScheduled: "शेड्यूल्ड पहा",
      testMessagesNote: "टेस्ट मेसेज सिम्युलेटेड आहेत. प्रत्यक्षात काहीही पाठवले गेले नाही.",
      errors: {
        couldNotLoad: "डिलिव्हरी निकाल लोड होऊ शकले नाहीत.",
        couldNotLoadRetry: "डिलिव्हरी निकाल लोड होऊ शकले नाहीत. पुन्हा प्रयत्न करा.",
        couldNotExport: "सबमिट केलेला इतिहास एक्सपोर्ट होऊ शकला नाही. पुन्हा प्रयत्न करा.",
        couldNotExportRetry:
          "सबमिट केलेला इतिहास एक्सपोर्ट होऊ शकला नाही. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.",
        failedToRefreshStatus: "डिलिव्हरी स्टेटस रीफ्रेश होऊ शकला नाही",
      },
      refreshedStatus: "डिलिव्हरी स्टेटस रीफ्रेश झाला",
      checkedStatus: "डिलिव्हरी स्टेटस तपासला गेला",
      statusLabel: "स्टेटस",
      ariaLabelStatusFilters: "डिलिव्हरी स्टेटस रिपोर्ट फिल्टर",
      searchContact: "कॉन्टॅक्ट शोधा",
      moreStatusesLabel: "इतर स्टेटस",
      moreStatusesOption: "इतर स्टेटस…",
      channelFilterLabel: "चॅनल फिल्टर",
      allChannels: "सर्व चॅनल",
      providerFilterLabel: "प्रोव्हायडर फिल्टर",
      allProviders: "सर्व प्रोव्हायडर",
      testProvider: "टेस्ट",
      liveCustomHttp: "लाइव्ह / कस्टम HTTP",
      exportFollowsFilters:
        "एक्सपोर्ट रिपोर्ट तुमच्या सध्याच्या फिल्टरनुसार तयार होते (5,000 रो पर्यंत).",
      loadingResults: "डिलिव्हरी निकाल लोड होत आहेत…",
      emptyTitleFiltered: "कोणतेही जुळणारे निकाल नाहीत",
      emptyTitleDefault: "अजून कोणतेही डिलिव्हरी निकाल नाहीत",
      emptyDescFiltered: "दुसरा फिल्टर वापरून पहा, किंवा फिल्टर काढा.",
      emptyDescDefault: "मेसेज प्रोसेस झाल्यानंतर निकाल इथे दिसतील.",
      sendMessageAction: "मेसेज पाठवा",
      viewPendingAction: "पेंडिंग पहा",
      table: {
        contact: "कॉन्टॅक्ट",
        mobile: "मोबाइल",
        template: "टेम्पलेट",
        channel: "चॅनल",
        provider: "प्रोव्हायडर",
        status: "स्टेटस",
        when: "कधी",
        actionsSr: "क्रिया",
      },
      simulatedWithVideo: "व्हिडिओसह सिम्युलेटेड",
      submittedWithVideo: "व्हिडिओसह सबमिट केले",
      refreshing: "रीफ्रेश होत आहे…",
      refresh: "रीफ्रेश करा",
      pageOf: (page, totalPages, total) =>
        `पान ${page} पैकी ${totalPages} (एकूण ${total})`,
      previous: "मागील",
      next: "पुढील",
    },
    generatedDocuments: {
      pageTitle: "जनरेट केलेले डॉक्युमेंट्स",
      pageDescription:
        "तुमच्या डॉक्युमेंट टेम्पलेट्समधून तयार केलेले पर्सनलाइज्ड PDF. 7 दिवस ठेवले जातात, नंतर काढले जातात.",
      errors: {
        couldNotLoad: "जनरेट केलेले डॉक्युमेंट्स लोड होऊ शकले नाहीत.",
        couldNotLoadRetry:
          "जनरेट केलेले डॉक्युमेंट्स लोड होऊ शकले नाहीत. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.",
        couldNotDelete: "डॉक्युमेंट डिलीट होऊ शकला नाही.",
        couldNotDeleteRetry:
          "डॉक्युमेंट डिलीट होऊ शकला नाही. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.",
      },
      loading: "जनरेट केलेले डॉक्युमेंट्स लोड होत आहेत...",
      emptyState:
        "अजून कोणतेही जनरेट केलेले डॉक्युमेंट नाही. डॉक्युमेंट टेम्पलेटच्या एडिटरमधून एक तयार करा.",
      table: {
        file: "फाइल",
        template: "टेम्पलेट",
        generated: "जनरेट केले",
        expires: "एक्सपायर होईल",
        status: "स्टेटस",
        actionsSr: "क्रिया",
      },
      statusExpired: "एक्सपायर झाले",
      statusActive: "एक्टिव्ह",
      view: "पहा",
      download: "डाउनलोड करा",
      deleting: "डिलीट होत आहे...",
      delete: "डिलीट करा",
      confirmDelete: (fileName) => `"${fileName}" डिलीट करायचे? हे परत घेता येणार नाही.`,
    },
  },
};

export function getDeliveriesDict(locale: Locale): DeliveriesDict {
  return DELIVERIES_DICT[locale];
}
