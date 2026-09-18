import type { OccasionHumanStatus } from "@/lib/queue/occasions-status";

import type { Locale } from "../constants";

export type DashboardHomeDict = {
  welcome: (firstName: string) => string;
  subtitle: string;
  refreshDashboard: string;
  missedQueue: {
    message: (count: number) => string;
    retryQueue: string;
    retrying: string;
  };
  alerts: {
    automationPaused: { message: string; cta: string };
    smsNotConfigured: { message: string; cta: string };
    whatsappNotConnected: { message: string; cta: string };
    failedToday: { message: (count: number) => string; cta: string };
    greetingRoutesOff: { message: (count: number) => string; cta: string };
  };
  systemStatus: {
    heading: string;
    automation: string;
    running: string;
    paused: string;
    nextRun: string;
    todaysGreetings: string;
    scheduledToday: string;
    contacts: string;
    activeContacts: string;
    channels: string;
    whatsapp: string;
    sms: string;
    connected: string;
    notConnected: string;
  };
  attention: {
    heading: string;
    allGood: string;
    noActionRequired: string;
  };
  todaysOccasions: {
    heading: string;
    viewAll: string;
    empty: string;
  };
  runningAutomations: {
    heading: string;
    manage: string;
    emptyTitle: string;
    emptyDescription: string;
    createAutomation: string;
    active: string;
    category: string;
    channel: string;
    sendTime: string;
  };
  occasionStatus: Record<OccasionHumanStatus, string>;
};

const DASHBOARD_HOME_DICT: Record<Locale, DashboardHomeDict> = {
  en: {
    welcome: (firstName) => `Welcome, ${firstName}`,
    subtitle: "Manage your birthday automations from one place.",
    refreshDashboard: "Refresh dashboard",
    missedQueue: {
      message: (count) =>
        `Some greetings could not be processed yesterday (${count} ${count === 1 ? "person" : "people"} missed).`,
      retryQueue: "Retry Queue",
      retrying: "Retrying…",
    },
    alerts: {
      automationPaused: {
        message: "Automation is paused - no active automations are configured.",
        cta: "Configure",
      },
      smsNotConfigured: {
        message: "SMS provider not configured.",
        cta: "Configure",
      },
      whatsappNotConnected: {
        message: "WhatsApp is not connected.",
        cta: "Configure",
      },
      failedToday: {
        message: (count) =>
          count === 1 ? "1 failed greeting today." : `${count} failed greetings today.`,
        cta: "Review failed",
      },
      greetingRoutesOff: {
        message: (count) =>
          `${count} ${count === 1 ? "person has" : "people have"} an occasion today, but greeting routes are off.`,
        cta: "Set up automatic greetings",
      },
    },
    systemStatus: {
      heading: "System Status",
      automation: "Automation",
      running: "Running",
      paused: "Paused",
      nextRun: "Next Run",
      todaysGreetings: "Today's Greetings",
      scheduledToday: "Scheduled Today",
      contacts: "Contacts",
      activeContacts: "Active Contacts",
      channels: "Channels",
      whatsapp: "WhatsApp",
      sms: "SMS",
      connected: "Connected",
      notConnected: "Not connected",
    },
    attention: {
      heading: "Attention Required",
      allGood: "Everything looks good.",
      noActionRequired: "No action required today.",
    },
    todaysOccasions: {
      heading: "Today's Scheduled",
      viewAll: "View all",
      empty: "No messages scheduled for today.",
    },
    runningAutomations: {
      heading: "Running Automations",
      manage: "Manage",
      emptyTitle: "No automations yet.",
      emptyDescription:
        "Create your first automation to start sending greetings automatically.",
      createAutomation: "Create Automation",
      active: "Active",
      category: "Category",
      channel: "Channel",
      sendTime: "Send Time",
    },
    occasionStatus: {
      not_set_up: "Not set up",
      will_send: "Scheduled",
      pending: "Pending",
      sending: "Sending",
      sent: "Submitted",
      failed: "Failed",
      skipped: "Skipped",
    },
  },
  hi: {
    welcome: (firstName) => `नमस्ते, ${firstName}`,
    subtitle: "अपने जन्मदिन ऑटोमेशन एक ही जगह से प्रबंधित करें।",
    refreshDashboard: "डैशबोर्ड रीफ़्रेश करें",
    missedQueue: {
      message: (count) =>
        `कल कुछ ग्रीटिंग प्रोसेस नहीं हो सकीं (${count} ${count === 1 ? "व्यक्ति" : "लोग"} छूटे)।`,
      retryQueue: "कतार फिर से कोशिश करें",
      retrying: "फिर से कोशिश हो रही है…",
    },
    alerts: {
      automationPaused: {
        message: "ऑटोमेशन रुका हुआ है - कोई एक्टिव ऑटोमेशन सेट नहीं है।",
        cta: "सेट करें",
      },
      smsNotConfigured: {
        message: "SMS प्रोवाइडर सेट नहीं है।",
        cta: "सेट करें",
      },
      whatsappNotConnected: {
        message: "WhatsApp कनेक्ट नहीं है।",
        cta: "सेट करें",
      },
      failedToday: {
        message: (count) =>
          count === 1 ? "आज 1 ग्रीटिंग असफल रही।" : `आज ${count} ग्रीटिंग असफल रहीं।`,
        cta: "असफल देखें",
      },
      greetingRoutesOff: {
        message: (count) =>
          `${count} ${count === 1 ? "व्यक्ति को" : "लोगों को"} आज अवसर है, लेकिन greeting routes बंद हैं।`,
        cta: "ऑटोमेटिक ग्रीटिंग सेट करें",
      },
    },
    systemStatus: {
      heading: "सिस्टम स्टेटस",
      automation: "ऑटोमेशन",
      running: "चल रहा है",
      paused: "रुका हुआ है",
      nextRun: "अगला रन",
      todaysGreetings: "आज की ग्रीटिंग",
      scheduledToday: "आज शेड्यूल",
      contacts: "कॉन्टैक्ट्स",
      activeContacts: "एक्टिव कॉन्टैक्ट्स",
      channels: "चैनल",
      whatsapp: "WhatsApp",
      sms: "SMS",
      connected: "कनेक्टेड",
      notConnected: "कनेक्टेड नहीं",
    },
    attention: {
      heading: "ध्यान देने योग्य",
      allGood: "सब कुछ ठीक है।",
      noActionRequired: "आज कोई कार्रवाई ज़रूरी नहीं।",
    },
    todaysOccasions: {
      heading: "आज के शेड्यूल्ड",
      viewAll: "सभी देखें",
      empty: "आज के लिए कोई मेसेज शेड्यूल नहीं है।",
    },
    runningAutomations: {
      heading: "चल रहे ऑटोमेशन",
      manage: "प्रबंधित करें",
      emptyTitle: "अभी तक कोई ऑटोमेशन नहीं।",
      emptyDescription:
        "अपने आप ग्रीटिंग भेजना शुरू करने के लिए अपना पहला ऑटोमेशन बनाएँ।",
      createAutomation: "ऑटोमेशन बनाएँ",
      active: "एक्टिव",
      category: "श्रेणी",
      channel: "चैनल",
      sendTime: "भेजने का समय",
    },
    occasionStatus: {
      not_set_up: "सेट नहीं है",
      will_send: "शेड्यूल्ड",
      pending: "पेंडिंग",
      sending: "भेजा जा रहा है",
      sent: "सबमिटेड",
      failed: "असफल",
      skipped: "स्किप्ड",
    },
  },
  mr: {
    welcome: (firstName) => `नमस्कार, ${firstName}`,
    subtitle: "तुमचे वाढदिवस ऑटोमेशन एकाच ठिकाणाहून व्यवस्थापित करा.",
    refreshDashboard: "डॅशबोर्ड रिफ्रेश करा",
    missedQueue: {
      message: (count) =>
        `काल काही ग्रीटिंग प्रोसेस होऊ शकल्या नाहीत (${count} ${count === 1 ? "व्यक्ती" : "लोक"} चुकले).`,
      retryQueue: "रांग पुन्हा प्रयत्न करा",
      retrying: "पुन्हा प्रयत्न होत आहे…",
    },
    alerts: {
      automationPaused: {
        message: "ऑटोमेशन थांबले आहे - कोणतेही अ‍ॅक्टिव्ह ऑटोमेशन सेट केलेले नाही.",
        cta: "सेट करा",
      },
      smsNotConfigured: {
        message: "SMS प्रोव्हायडर सेट केलेला नाही.",
        cta: "सेट करा",
      },
      whatsappNotConnected: {
        message: "WhatsApp कनेक्ट केलेले नाही.",
        cta: "सेट करा",
      },
      failedToday: {
        message: (count) =>
          count === 1 ? "आज 1 ग्रीटिंग अयशस्वी झाली." : `आज ${count} ग्रीटिंग अयशस्वी झाल्या.`,
        cta: "अयशस्वी पाहा",
      },
      greetingRoutesOff: {
        message: (count) =>
          `${count} ${count === 1 ? "व्यक्तीला" : "लोकांना"} आज प्रसंग आहे, पण greeting routes बंद आहेत.`,
        cta: "ऑटोमॅटिक ग्रीटिंग सेट करा",
      },
    },
    systemStatus: {
      heading: "सिस्टम स्टेटस",
      automation: "ऑटोमेशन",
      running: "सुरू आहे",
      paused: "थांबले आहे",
      nextRun: "पुढचा रन",
      todaysGreetings: "आजच्या ग्रीटिंग",
      scheduledToday: "आज शेड्यूल्ड",
      contacts: "कॉन्टॅक्ट्स",
      activeContacts: "अ‍ॅक्टिव्ह कॉन्टॅक्ट्स",
      channels: "चॅनेल्स",
      whatsapp: "WhatsApp",
      sms: "SMS",
      connected: "कनेक्टेड",
      notConnected: "कनेक्टेड नाही",
    },
    attention: {
      heading: "लक्ष देण्याची गरज",
      allGood: "सर्व काही व्यवस्थित आहे.",
      noActionRequired: "आज कोणतीही कृती आवश्यक नाही.",
    },
    todaysOccasions: {
      heading: "आजचे शेड्यूल्ड",
      viewAll: "सर्व पाहा",
      empty: "आजसाठी कोणताही मेसेज शेड्यूल्ड नाही.",
    },
    runningAutomations: {
      heading: "सुरू असलेले ऑटोमेशन",
      manage: "व्यवस्थापित करा",
      emptyTitle: "अजून कोणतेही ऑटोमेशन नाही.",
      emptyDescription:
        "आपोआप ग्रीटिंग पाठवणे सुरू करण्यासाठी तुमचे पहिले ऑटोमेशन तयार करा.",
      createAutomation: "ऑटोमेशन तयार करा",
      active: "अ‍ॅक्टिव्ह",
      category: "श्रेणी",
      channel: "चॅनेल",
      sendTime: "पाठवण्याची वेळ",
    },
    occasionStatus: {
      not_set_up: "सेट केलेले नाही",
      will_send: "शेड्यूल्ड",
      pending: "पेंडिंग",
      sending: "पाठवत आहे",
      sent: "सबमिट केले",
      failed: "अयशस्वी",
      skipped: "वगळले",
    },
  },
};

export function getDashboardHomeDict(locale: Locale): DashboardHomeDict {
  return DASHBOARD_HOME_DICT[locale];
}
