import type { Locale } from "../constants";

export type AdminChannelStatusDict = {
  heading: string;
  description: string;
  channel: { SMS: string; WHATSAPP: string; EMAIL: string };
  source: { own: string; platform_default: string; none: string };
  switchedOff: string;
  checkHealth: string;
  checking: string;
  failedToCheck: string;
  canSend: string;
  canSendValue: { AVAILABLE: string; LIMITED: string; BLOCKED: string };
  number: string;
  numberStatus: string;
  displayName: string;
  quality: string;
  mode: string;
  sandboxNote: string;
  noIssues: string;
  issuesHeading: string;
};

const ADMIN_CHANNEL_STATUS_DICT: Record<Locale, AdminChannelStatusDict> = {
  en: {
    heading: "Channels",
    description:
      "Which gateway this client's messages go through on each channel.",
    channel: { SMS: "SMS", WHATSAPP: "WhatsApp", EMAIL: "Email" },
    source: {
      own: "Own gateway",
      platform_default: "Platform default",
      none: "Not set up",
    },
    switchedOff: "Switched off by the client",
    checkHealth: "Check with Meta",
    checking: "Checking…",
    failedToCheck: "Could not check WhatsApp health",
    canSend: "Can send messages",
    canSendValue: { AVAILABLE: "Yes", LIMITED: "Limited", BLOCKED: "Blocked" },
    number: "Number",
    numberStatus: "Number status",
    displayName: "Display name",
    quality: "Quality",
    mode: "Mode",
    sandboxNote: "Test number - only reaches phones on Meta's allow-list.",
    noIssues: "Meta reports no problems with this number.",
    issuesHeading: "What Meta reports",
  },
  hi: {
    heading: "चैनल",
    description: "हर चैनल पर इस क्लायंट के मेसेज किस गेटवे से जाते हैं।",
    channel: { SMS: "SMS", WHATSAPP: "WhatsApp", EMAIL: "Email" },
    source: {
      own: "अपना गेटवे",
      platform_default: "प्लेटफ़ॉर्म डिफ़ॉल्ट",
      none: "सेट नहीं है",
    },
    switchedOff: "क्लायंट ने बंद किया है",
    checkHealth: "Meta से जाँचें",
    checking: "जाँच हो रही है…",
    failedToCheck: "WhatsApp की स्थिति जाँची नहीं जा सकी",
    canSend: "मेसेज भेज सकता है",
    canSendValue: { AVAILABLE: "हाँ", LIMITED: "सीमित", BLOCKED: "ब्लॉक" },
    number: "नंबर",
    numberStatus: "नंबर की स्थिति",
    displayName: "डिस्प्ले नाम",
    quality: "क्वालिटी",
    mode: "मोड",
    sandboxNote: "टेस्ट नंबर - केवल Meta की allow-list वाले फ़ोन तक पहुँचता है।",
    noIssues: "Meta इस नंबर में कोई समस्या नहीं बता रहा।",
    issuesHeading: "Meta क्या बता रहा है",
  },
  mr: {
    heading: "चॅनेल",
    description: "प्रत्येक चॅनेलवर या क्लायंटचे मेसेज कोणत्या गेटवेमधून जातात.",
    channel: { SMS: "SMS", WHATSAPP: "WhatsApp", EMAIL: "Email" },
    source: {
      own: "स्वतःचे गेटवे",
      platform_default: "प्लॅटफॉर्म डिफॉल्ट",
      none: "सेट केलेले नाही",
    },
    switchedOff: "क्लायंटने बंद केले आहे",
    checkHealth: "Meta कडून तपासा",
    checking: "तपासत आहे…",
    failedToCheck: "WhatsApp ची स्थिती तपासता आली नाही",
    canSend: "मेसेज पाठवू शकतो",
    canSendValue: { AVAILABLE: "होय", LIMITED: "मर्यादित", BLOCKED: "ब्लॉक" },
    number: "नंबर",
    numberStatus: "नंबरची स्थिती",
    displayName: "डिस्प्ले नाव",
    quality: "क्वालिटी",
    mode: "मोड",
    sandboxNote: "टेस्ट नंबर - फक्त Meta च्या allow-list मधील फोनपर्यंत पोहोचतो.",
    noIssues: "Meta या नंबरमध्ये कोणतीही समस्या दाखवत नाही.",
    issuesHeading: "Meta काय सांगत आहे",
  },
};

export function getAdminChannelStatusDict(locale: Locale): AdminChannelStatusDict {
  return ADMIN_CHANNEL_STATUS_DICT[locale];
}
