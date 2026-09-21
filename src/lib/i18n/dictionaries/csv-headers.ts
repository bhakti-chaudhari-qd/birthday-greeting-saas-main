import type { Locale } from "../constants";

const CONTACT_KEYS = [
  "name",
  "mobile",
  "email",
  "category",
  "address",
  "note",
  "isActive",
] as const;
const ACTIVITY_UPCOMING_KEYS = [
  "contactName",
  "contactMobile",
  "categoryName",
  "occasion",
  "channel",
  "templateName",
  "status",
  "sendTime",
  "preview",
] as const;
const ACTIVITY_FAILED_KEYS = [
  "source",
  "contactName",
  "contactMobile",
  "templateName",
  "channel",
  "status",
  "scheduledDate",
  "error",
  "preview",
] as const;
const DELIVERY_KEYS = [
  "contactName",
  "contactMobile",
  "templateName",
  "channel",
  "provider",
  "status",
  "attemptNumber",
  "providerMessageId",
  "errorMessage",
  "createdAt",
  "preview",
] as const;

export type CsvHeaderSets = {
  contacts: Record<(typeof CONTACT_KEYS)[number], string>;
  activityUpcoming: Record<(typeof ACTIVITY_UPCOMING_KEYS)[number], string>;
  activityFailed: Record<(typeof ACTIVITY_FAILED_KEYS)[number], string>;
  deliveries: Record<(typeof DELIVERY_KEYS)[number], string>;
};

/** English output is the raw column keys, exactly as the exports always produced. */
function identity<K extends string>(keys: readonly K[]): Record<K, string> {
  return Object.fromEntries(keys.map((key) => [key, key])) as unknown as Record<K, string>;
}

const CSV_HEADERS: Record<Locale, CsvHeaderSets> = {
  en: {
    contacts: identity(CONTACT_KEYS),
    activityUpcoming: identity(ACTIVITY_UPCOMING_KEYS),
    activityFailed: identity(ACTIVITY_FAILED_KEYS),
    deliveries: identity(DELIVERY_KEYS),
  },
  hi: {
    contacts: {
      name: "नाम",
      mobile: "मोबाइल",
      email: "ईमेल",
      category: "श्रेणी",
      address: "पता",
      note: "नोट",
      isActive: "एक्टिव",
    },
    activityUpcoming: {
      contactName: "कॉन्टैक्ट का नाम",
      contactMobile: "कॉन्टैक्ट मोबाइल",
      categoryName: "श्रेणी",
      occasion: "अवसर",
      channel: "चैनल",
      templateName: "टेम्पलेट का नाम",
      status: "स्टेटस",
      sendTime: "भेजने का समय",
      preview: "प्रीव्यू",
    },
    activityFailed: {
      source: "स्रोत",
      contactName: "कॉन्टैक्ट का नाम",
      contactMobile: "कॉन्टैक्ट मोबाइल",
      templateName: "टेम्पलेट का नाम",
      channel: "चैनल",
      status: "स्टेटस",
      scheduledDate: "शेड्यूल्ड तारीख",
      error: "एरर",
      preview: "प्रीव्यू",
    },
    deliveries: {
      contactName: "कॉन्टैक्ट का नाम",
      contactMobile: "कॉन्टैक्ट मोबाइल",
      templateName: "टेम्पलेट का नाम",
      channel: "चैनल",
      provider: "प्रोवाइडर",
      status: "स्टेटस",
      attemptNumber: "प्रयास संख्या",
      providerMessageId: "प्रोवाइडर मेसेज ID",
      errorMessage: "एरर मेसेज",
      createdAt: "बनाने का समय",
      preview: "प्रीव्यू",
    },
  },
  mr: {
    contacts: {
      name: "नाव",
      mobile: "मोबाइल",
      email: "ईमेल",
      category: "श्रेणी",
      address: "पत्ता",
      note: "नोंद",
      isActive: "अ‍ॅक्टिव्ह",
    },
    activityUpcoming: {
      contactName: "कॉन्टॅक्टचे नाव",
      contactMobile: "कॉन्टॅक्ट मोबाइल",
      categoryName: "श्रेणी",
      occasion: "प्रसंग",
      channel: "चॅनेल",
      templateName: "टेम्पलेटचे नाव",
      status: "स्टेटस",
      sendTime: "पाठवण्याची वेळ",
      preview: "प्रीव्ह्यू",
    },
    activityFailed: {
      source: "स्रोत",
      contactName: "कॉन्टॅक्टचे नाव",
      contactMobile: "कॉन्टॅक्ट मोबाइल",
      templateName: "टेम्पलेटचे नाव",
      channel: "चॅनेल",
      status: "स्टेटस",
      scheduledDate: "शेड्यूल्ड तारीख",
      error: "एरर",
      preview: "प्रीव्ह्यू",
    },
    deliveries: {
      contactName: "कॉन्टॅक्टचे नाव",
      contactMobile: "कॉन्टॅक्ट मोबाइल",
      templateName: "टेम्पलेटचे नाव",
      channel: "चॅनेल",
      provider: "प्रोव्हायडर",
      status: "स्टेटस",
      attemptNumber: "प्रयत्न क्रमांक",
      providerMessageId: "प्रोव्हायडर मेसेज ID",
      errorMessage: "एरर मेसेज",
      createdAt: "तयार केल्याची वेळ",
      preview: "प्रीव्ह्यू",
    },
  },
};

export function getCsvHeaders(locale: Locale): CsvHeaderSets {
  return CSV_HEADERS[locale];
}
