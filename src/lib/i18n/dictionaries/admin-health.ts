import type { HealthReason } from "@/lib/admin/organization-health";

import type { Locale } from "../constants";

export type AdminHealthDict = {
  clientInactive: string;
  noRoutesEnabled: string;
  routesNeedSetup: string;
  someRoutesNeedSetup: string;
  queueFailedItems: (count: number) => string;
  lowSuccessRate: string;
  noIssues: string;
  queuedItemsNoIssues: (count: number) => string;
  healthy: string;
  needsAttention: string;
  inactive: string;
};

const ADMIN_HEALTH_DICT: Record<Locale, AdminHealthDict> = {
  en: {
    clientInactive: "Client is inactive",
    noRoutesEnabled: "No automation routes are enabled",
    routesNeedSetup: "Enabled routes need a template or active channel",
    someRoutesNeedSetup: "Some enabled routes need a template or active channel",
    queueFailedItems: (count) => `${count} failed queue item(s) need attention`,
    lowSuccessRate: "Monthly delivery success is below 90%",
    noIssues: "No health issues detected",
    queuedItemsNoIssues: (count) => `${count} queued item(s); no health issues detected`,
    healthy: "HEALTHY",
    needsAttention: "NEEDS ATTENTION",
    inactive: "INACTIVE",
  },
  hi: {
    clientInactive: "क्लायंट इनएक्टिव है",
    noRoutesEnabled: "कोई ऑटोमेशन रूट एक्टिव नहीं है",
    routesNeedSetup: "एक्टिव रूट्स को टेम्पलेट या एक्टिव चैनल चाहिए",
    someRoutesNeedSetup: "कुछ एक्टिव रूट्स को टेम्पलेट या एक्टिव चैनल चाहिए",
    queueFailedItems: (count) => `${count} फ़ेल क्यू आइटम को ध्यान चाहिए`,
    lowSuccessRate: "इस महीने की डिलीवरी सफलता 90% से कम है",
    noIssues: "कोई हेल्थ इश्यू नहीं मिला",
    queuedItemsNoIssues: (count) => `${count} क्यू में; कोई हेल्थ इश्यू नहीं मिला`,
    healthy: "हेल्दी",
    needsAttention: "ध्यान चाहिए",
    inactive: "इनएक्टिव",
  },
  mr: {
    clientInactive: "क्लायंट इनअ‍ॅक्टिव्ह आहे",
    noRoutesEnabled: "कोणताही ऑटोमेशन रूट अ‍ॅक्टिव्ह नाही",
    routesNeedSetup: "अ‍ॅक्टिव्ह रूट्सना टेम्पलेट किंवा अ‍ॅक्टिव्ह चॅनेल हवे",
    someRoutesNeedSetup: "काही अ‍ॅक्टिव्ह रूट्सना टेम्पलेट किंवा अ‍ॅक्टिव्ह चॅनेल हवे",
    queueFailedItems: (count) => `${count} फेल क्यू आयटमकडे लक्ष द्यावे`,
    lowSuccessRate: "या महिन्याचे डिलिव्हरी यश 90% पेक्षा कमी आहे",
    noIssues: "कोणतीही हेल्थ इश्यू आढळली नाही",
    queuedItemsNoIssues: (count) => `${count} क्यूमध्ये; कोणतीही हेल्थ इश्यू आढळली नाही`,
    healthy: "हेल्दी",
    needsAttention: "लक्ष द्यावे",
    inactive: "इनअ‍ॅक्टिव्ह",
  },
};

export function getAdminHealthDict(locale: Locale): AdminHealthDict {
  return ADMIN_HEALTH_DICT[locale];
}

export function translateHealthReason(
  reason: HealthReason,
  locale: Locale,
): string {
  const dict = getAdminHealthDict(locale);
  switch (reason.code) {
    case "CLIENT_INACTIVE":
      return dict.clientInactive;
    case "NO_ROUTES_ENABLED":
      return dict.noRoutesEnabled;
    case "ROUTES_NEED_SETUP":
      return dict.routesNeedSetup;
    case "SOME_ROUTES_NEED_SETUP":
      return dict.someRoutesNeedSetup;
    case "QUEUE_FAILED_ITEMS":
      return dict.queueFailedItems(reason.count);
    case "LOW_SUCCESS_RATE":
      return dict.lowSuccessRate;
    case "NO_ISSUES":
      return dict.noIssues;
    case "QUEUED_ITEMS_NO_ISSUES":
      return dict.queuedItemsNoIssues(reason.count);
  }
}

export function translateHealthLabel(
  label: "HEALTHY" | "NEEDS_ATTENTION" | "INACTIVE",
  locale: Locale,
): string {
  const dict = getAdminHealthDict(locale);
  switch (label) {
    case "HEALTHY":
      return dict.healthy;
    case "NEEDS_ATTENTION":
      return dict.needsAttention;
    case "INACTIVE":
      return dict.inactive;
  }
}
