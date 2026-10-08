import type { Locale } from "../constants";

export type LiveReadinessDict = {
  paidPlan: string;
  paidPlanApproved: string;
  dltCreate: string;
  dltComplete: string;
  liveProvider: string;
  complete: string;
  setUp: string;
};

const LIVE_READINESS_DICT: Record<Locale, LiveReadinessDict> = {
  en: {
    paidPlan: "Activate a paid plan (Starter or Pro)",
    paidPlanApproved: "Live messaging approved by platform",
    dltCreate: "Create SMS templates and complete DLT setup",
    dltComplete: "Complete DLT setup for your SMS templates",
    liveProvider: "Connect your own SMS or WhatsApp gateway",
    complete: "Complete",
    setUp: "Set up",
  },
  hi: {
    paidPlan: "पेड प्लान एक्टिवेट करें (Starter या Pro)",
    paidPlanApproved: "प्लेटफ़ॉर्म ने लाइव मेसेजिंग मंज़ूर की है",
    dltCreate: "SMS टेम्पलेट बनाएँ और DLT सेटअप पूरा करें",
    dltComplete: "अपने SMS टेम्पलेट का DLT सेटअप पूरा करें",
    liveProvider: "अपना SMS या WhatsApp गेटवे जोड़ें",
    complete: "पूरा हुआ",
    setUp: "सेट करें",
  },
  mr: {
    paidPlan: "पेड प्लान एक्टिवेट करा (Starter किंवा Pro)",
    paidPlanApproved: "प्लॅटफॉर्मने लाइव्ह मेसेजिंग मंजूर केले आहे",
    dltCreate: "SMS टेम्पलेट तयार करा आणि DLT सेटअप पूर्ण करा",
    dltComplete: "तुमच्या SMS टेम्पलेटचा DLT सेटअप पूर्ण करा",
    liveProvider: "तुमचे स्वतःचे SMS किंवा WhatsApp गेटवे जोडा",
    complete: "पूर्ण",
    setUp: "सेट करा",
  },
};

export function getLiveReadinessDict(locale: Locale): LiveReadinessDict {
  return LIVE_READINESS_DICT[locale];
}
