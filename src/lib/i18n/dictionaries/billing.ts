import type { Locale } from "../constants";

export type BillingDict = {
  page: {
    title: string;
  };
  loading: string;
  unavailable: string;
  razorpayNotConfigured: string;
  currentPlan: {
    heading: string;
    plan: string;
    status: string;
    contactsLimit: string;
    messagesThisMonth: string;
    includesBonusCredits: (count: string) => string;
    paidUntil: string;
    sendingBlocked: (status: string) => string;
  };
  plans: {
    heading: string;
    perMonth: string;
    contactsSuffix: string;
    messagesPerMonthSuffix: string;
    currentPlanButton: string;
    openingCheckout: string;
    upgradeTo: (label: string) => string;
  };
  creditPacks: {
    heading: string;
    description: string;
    extraMessagesSuffix: string;
    openingCheckout: string;
    buyPack: string;
    requiresActivePlan: string;
  };
  footerNote: string;
  errors: {
    failedToLoad: string;
    razorpayUnavailable: string;
    paymentReceivedConfirmFailed: string;
    planActiveNow: (label: string) => string;
    creditsAdded: (label: string) => string;
    paymentConfirmationFailed: string;
    failedToStartCheckout: string;
    checkoutFailed: string;
  };
};

const BILLING_DICT: Record<Locale, BillingDict> = {
  en: {
    page: { title: "Billing" },
    loading: "Loading billing…",
    unavailable: "Billing unavailable.",
    razorpayNotConfigured:
      "Razorpay isn't configured. Upgrades and credit packs stay disabled until billing keys are set.",
    currentPlan: {
      heading: "Current plan",
      plan: "Plan",
      status: "Status",
      contactsLimit: "Contacts limit",
      messagesThisMonth: "Messages this month",
      includesBonusCredits: (count) => `Includes ${count} bonus credits`,
      paidUntil: "Paid until",
      sendingBlocked: (status) =>
        `Sending is blocked while ${status.toLowerCase()}. Upgrade or contact Platform Admin.`,
    },
    plans: {
      heading: "Plans",
      perMonth: "/ month",
      contactsSuffix: "contacts",
      messagesPerMonthSuffix: "messages / month",
      currentPlanButton: "Current plan",
      openingCheckout: "Opening checkout…",
      upgradeTo: (label) => `Upgrade to ${label}`,
    },
    creditPacks: {
      heading: "Extra messages",
      description:
        "Buy a pack if you hit this month's send limit. Credits apply immediately and reset at the start of the next month (IST). Payment methods (including UPI QR) appear in the Razorpay checkout popup.",
      extraMessagesSuffix: "messages this month",
      openingCheckout: "Opening checkout…",
      buyPack: "Buy pack",
      requiresActivePlan: "Requires ACTIVE paid plan",
    },
    footerNote:
      "Plans and credit packs activate after Razorpay verifies payment. Prices come from the server.",
    errors: {
      failedToLoad: "Failed to load billing",
      razorpayUnavailable: "Razorpay Checkout is unavailable",
      paymentReceivedConfirmFailed:
        "Payment received but confirmation failed. Refresh shortly.",
      planActiveNow: (label) =>
        `${label} is now active. Limits will apply immediately.`,
      creditsAdded: (label) => `${label} added for this month.`,
      paymentConfirmationFailed: "Payment confirmation failed",
      failedToStartCheckout: "Failed to start checkout",
      checkoutFailed: "Checkout failed",
    },
  },
  hi: {
    page: { title: "बिलिंग" },
    loading: "बिलिंग लोड हो रही है…",
    unavailable: "बिलिंग उपलब्ध नहीं है।",
    razorpayNotConfigured:
      "Razorpay कॉन्फ़िगर नहीं है। जब तक बिलिंग कीज़ सेट नहीं की जातीं, अपग्रेड और क्रेडिट पैक बंद रहेंगे।",
    currentPlan: {
      heading: "मौजूदा प्लान",
      plan: "प्लान",
      status: "स्टेटस",
      contactsLimit: "कॉन्टैक्ट लिमिट",
      messagesThisMonth: "इस महीने के मेसेज",
      includesBonusCredits: (count) => `इसमें ${count} बोनस क्रेडिट शामिल हैं`,
      paidUntil: "यहां तक पेड",
      sendingBlocked: (status) =>
        `${status.toLowerCase()} होने के दौरान भेजना बंद है। अपग्रेड करें या प्लेटफ़ॉर्म एडमिन से संपर्क करें।`,
    },
    plans: {
      heading: "प्लान",
      perMonth: "/ महीना",
      contactsSuffix: "कॉन्टैक्ट",
      messagesPerMonthSuffix: "मेसेज / महीना",
      currentPlanButton: "मौजूदा प्लान",
      openingCheckout: "चेकआउट खुल रहा है…",
      upgradeTo: (label) => `${label} में अपग्रेड करें`,
    },
    creditPacks: {
      heading: "अतिरिक्त मेसेज",
      description:
        "अगर इस महीने की भेजने की लिमिट पूरी हो गई है तो पैक खरीदें। क्रेडिट तुरंत लागू होते हैं और अगले महीने की शुरुआत (IST) में रीसेट होते हैं। पेमेंट के तरीके (UPI QR सहित) Razorpay चेकआउट पॉपअप में दिखते हैं।",
      extraMessagesSuffix: "मेसेज इस महीने",
      openingCheckout: "चेकआउट खुल रहा है…",
      buyPack: "पैक खरीदें",
      requiresActivePlan: "ACTIVE पेड प्लान ज़रूरी है",
    },
    footerNote:
      "Razorpay पेमेंट वेरिफ़ाई करने के बाद प्लान और क्रेडिट पैक एक्टिव होते हैं। कीमतें सर्वर से आती हैं।",
    errors: {
      failedToLoad: "बिलिंग लोड नहीं हो सकी",
      razorpayUnavailable: "Razorpay चेकआउट उपलब्ध नहीं है",
      paymentReceivedConfirmFailed:
        "पेमेंट मिल गया लेकिन कन्फ़र्मेशन नहीं हो सका। थोड़ी देर में रीफ़्रेश करें।",
      planActiveNow: (label) =>
        `${label} अब एक्टिव है। लिमिट तुरंत लागू होगी।`,
      creditsAdded: (label) => `${label} इस महीने के लिए जोड़ दिया गया।`,
      paymentConfirmationFailed: "पेमेंट कन्फ़र्मेशन नहीं हो सका",
      failedToStartCheckout: "चेकआउट शुरू नहीं हो सका",
      checkoutFailed: "चेकआउट फेल हो गया",
    },
  },
  mr: {
    page: { title: "बिलिंग" },
    loading: "बिलिंग लोड होत आहे…",
    unavailable: "बिलिंग उपलब्ध नाही.",
    razorpayNotConfigured:
      "Razorpay कॉन्फिगर केलेले नाही. बिलिंग की सेट होईपर्यंत अपग्रेड आणि क्रेडिट पॅक बंद राहतील.",
    currentPlan: {
      heading: "सध्याचा प्लॅन",
      plan: "प्लॅन",
      status: "स्टेटस",
      contactsLimit: "कॉन्टॅक्ट लिमिट",
      messagesThisMonth: "या महिन्याचे मेसेज",
      includesBonusCredits: (count) => `यामध्ये ${count} बोनस क्रेडिट्स समाविष्ट आहेत`,
      paidUntil: "इथपर्यंत पेड",
      sendingBlocked: (status) =>
        `${status.toLowerCase()} असताना पाठवणे बंद आहे. अपग्रेड करा किंवा प्लॅटफॉर्म अ‍ॅडमिनशी संपर्क साधा.`,
    },
    plans: {
      heading: "प्लॅन्स",
      perMonth: "/ महिना",
      contactsSuffix: "कॉन्टॅक्ट्स",
      messagesPerMonthSuffix: "मेसेज / महिना",
      currentPlanButton: "सध्याचा प्लॅन",
      openingCheckout: "चेकआउट उघडत आहे…",
      upgradeTo: (label) => `${label} मध्ये अपग्रेड करा`,
    },
    creditPacks: {
      heading: "जास्तीचे मेसेज",
      description:
        "या महिन्याची पाठवण्याची लिमिट संपली असल्यास पॅक विकत घ्या. क्रेडिट्स लगेच लागू होतात आणि पुढील महिन्याच्या सुरुवातीला (IST) रीसेट होतात. पेमेंट पद्धती (UPI QR सह) Razorpay चेकआउट पॉपअपमध्ये दिसतात.",
      extraMessagesSuffix: "मेसेज या महिन्यासाठी",
      openingCheckout: "चेकआउट उघडत आहे…",
      buyPack: "पॅक विकत घ्या",
      requiresActivePlan: "ACTIVE पेड प्लॅन आवश्यक आहे",
    },
    footerNote:
      "Razorpay पेमेंट व्हेरिफाय केल्यानंतर प्लॅन्स आणि क्रेडिट पॅक्स एक्टिव्ह होतात. किमती सर्व्हरवरून येतात.",
    errors: {
      failedToLoad: "बिलिंग लोड होऊ शकली नाही",
      razorpayUnavailable: "Razorpay चेकआउट उपलब्ध नाही",
      paymentReceivedConfirmFailed:
        "पेमेंट मिळाले पण कन्फर्मेशन होऊ शकले नाही. थोड्या वेळाने रीफ्रेश करा.",
      planActiveNow: (label) =>
        `${label} आता एक्टिव्ह आहे. लिमिट लगेच लागू होईल.`,
      creditsAdded: (label) => `${label} या महिन्यासाठी जोडले गेले.`,
      paymentConfirmationFailed: "पेमेंट कन्फर्मेशन होऊ शकले नाही",
      failedToStartCheckout: "चेकआउट सुरू होऊ शकला नाही",
      checkoutFailed: "चेकआउट अयशस्वी झाला",
    },
  },
};

export function getBillingDict(locale: Locale): BillingDict {
  return BILLING_DICT[locale];
}
