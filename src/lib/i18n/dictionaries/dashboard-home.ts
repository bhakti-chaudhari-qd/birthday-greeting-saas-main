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
      heading: "Today's Occasions",
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
    systemStatus: {
      heading: "सिस्टम स्टेटस",
      automation: "ऑटोमेशन",
      running: "चल रहा है",
      paused: "रुका हुआ है",
      nextRun: "अगला रन",
      todaysGreetings: "आज की ग्रीटिंग",
      scheduledToday: "आज शेड्यूल",
      contacts: "संपर्क",
      activeContacts: "सक्रिय संपर्क",
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
      heading: "आज के अवसर",
      viewAll: "सभी देखें",
      empty: "आज के लिए कोई संदेश शेड्यूल नहीं है।",
    },
    runningAutomations: {
      heading: "चल रहे ऑटोमेशन",
      manage: "प्रबंधित करें",
      emptyTitle: "अभी तक कोई ऑटोमेशन नहीं।",
      emptyDescription:
        "अपने आप ग्रीटिंग भेजना शुरू करने के लिए अपना पहला ऑटोमेशन बनाएँ।",
      createAutomation: "ऑटोमेशन बनाएँ",
      active: "सक्रिय",
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
    systemStatus: {
      heading: "सिस्टम स्टेटस",
      automation: "ऑटोमेशन",
      running: "सुरू आहे",
      paused: "थांबले आहे",
      nextRun: "पुढचा रन",
      todaysGreetings: "आजच्या ग्रीटिंग",
      scheduledToday: "आज शेड्यूल्ड",
      contacts: "संपर्क",
      activeContacts: "सक्रिय संपर्क",
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
      heading: "आजचे प्रसंग",
      viewAll: "सर्व पाहा",
      empty: "आजसाठी कोणताही संदेश शेड्यूल्ड नाही.",
    },
    runningAutomations: {
      heading: "सुरू असलेले ऑटोमेशन",
      manage: "व्यवस्थापित करा",
      emptyTitle: "अजून कोणतेही ऑटोमेशन नाही.",
      emptyDescription:
        "आपोआप ग्रीटिंग पाठवणे सुरू करण्यासाठी तुमचे पहिले ऑटोमेशन तयार करा.",
      createAutomation: "ऑटोमेशन तयार करा",
      active: "सक्रिय",
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
