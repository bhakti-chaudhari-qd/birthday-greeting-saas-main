import type { VendorOnboardingStatus } from "@prisma/client";

import type { Locale } from "../constants";

export type AdminVendorDict = {
  lifecycleLabels: Record<VendorOnboardingStatus, string>;
  latestInvite: {
    noInvitationSent: string;
    invitationNotSent: string;
    smsSendPending: string;
    invitationRevoked: string;
    invitationExpired: string;
    deliveryUncertain: string;
    smsSentExpires: (expiresDate: string) => string;
  };
};

const ADMIN_VENDOR_DICT: Record<Locale, AdminVendorDict> = {
  en: {
    lifecycleLabels: {
      DRAFT: "DRAFT",
      INVITED: "INVITED",
      PENDING: "PENDING",
      APPROVED: "APPROVED",
      REJECTED: "REJECTED",
    },
    latestInvite: {
      noInvitationSent: "No invitation sent",
      invitationNotSent: "Invitation not sent",
      smsSendPending: "SMS send pending",
      invitationRevoked: "Latest invitation revoked",
      invitationExpired: "Latest invitation expired",
      deliveryUncertain: "SMS delivery uncertain · invitation remains valid",
      smsSentExpires: (expiresDate) => `SMS sent · expires ${expiresDate}`,
    },
  },
  hi: {
    lifecycleLabels: {
      DRAFT: "ड्राफ़्ट",
      INVITED: "इनवाइटेड",
      PENDING: "पेंडिंग",
      APPROVED: "अप्रूव्ड",
      REJECTED: "रिजेक्टेड",
    },
    latestInvite: {
      noInvitationSent: "कोई इनविटेशन नहीं भेजा गया",
      invitationNotSent: "इनविटेशन नहीं भेजा गया",
      smsSendPending: "SMS भेजना पेंडिंग है",
      invitationRevoked: "पिछला इनविटेशन रद्द किया गया",
      invitationExpired: "पिछला इनविटेशन एक्सपायर हो गया",
      deliveryUncertain: "SMS डिलीवरी अनिश्चित · इनविटेशन अभी भी मान्य है",
      smsSentExpires: (expiresDate) => `SMS भेजा गया · ${expiresDate} को एक्सपायर होगा`,
    },
  },
  mr: {
    lifecycleLabels: {
      DRAFT: "ड्राफ्ट",
      INVITED: "इनव्हाइटेड",
      PENDING: "पेंडिंग",
      APPROVED: "अ‍ॅप्रूव्ह्ड",
      REJECTED: "रिजेक्टेड",
    },
    latestInvite: {
      noInvitationSent: "कोणतेही इनव्हिटेशन पाठवलेले नाही",
      invitationNotSent: "इनव्हिटेशन पाठवले गेले नाही",
      smsSendPending: "SMS पाठवणे पेंडिंग आहे",
      invitationRevoked: "मागील इनव्हिटेशन रद्द केले",
      invitationExpired: "मागील इनव्हिटेशन एक्सपायर झाले",
      deliveryUncertain: "SMS डिलिव्हरी अनिश्चित · इनव्हिटेशन अजून वैध आहे",
      smsSentExpires: (expiresDate) => `SMS पाठवला · ${expiresDate} रोजी एक्सपायर होईल`,
    },
  },
};

export function getAdminVendorDict(locale: Locale): AdminVendorDict {
  return ADMIN_VENDOR_DICT[locale];
}
