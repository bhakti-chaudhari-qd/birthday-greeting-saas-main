import type { Locale } from "../constants";

export type ShellDict = {
  skipToMainContent: string;
  menu: string;
  close: string;
  organizationPortalLabel: string;
  platformAdminPortalLabel: string;
  /** Keyed by nav href (stable), for items that link somewhere. */
  navLabelsByHref: Record<string, string>;
  /** Keyed by the group's English label (there's only one group, "Settings"). */
  navGroupLabelsByEnglishLabel: Record<string, string>;
  signOut: {
    signOut: string;
    signingOut: string;
    signOutOptions: string;
    signOutThisDevice: string;
    signOutEverywhere: string;
    confirmEverywhere: string;
  };
};

const SHELL_DICT: Record<Locale, ShellDict> = {
  en: {
    skipToMainContent: "Skip to main content",
    menu: "Menu",
    close: "Close",
    organizationPortalLabel: "Organization",
    platformAdminPortalLabel: "Platform Admin",
    navLabelsByHref: {
      "/dashboard": "Home",
      "/dashboard/contacts": "Contacts",
      "/dashboard/messages": "Send Messages",
      "/dashboard/activity": "Activity",
      "/dashboard/settings/channels": "Channels",
      "/dashboard/templates": "Manage Templates",
      "/dashboard/settings/occasions": "Occasion Management",
      "/dashboard/settings/contact-fields": "Contact Fields",
      "/dashboard/settings/billing": "Billing",
      "/admin": "Overview",
      "/admin/usage": "Usage",
      "/admin/organizations": "Clients",
      "/admin/vendors": "Vendors",
      "/admin/settings/plan-catalogue": "Settings",
    },
    navGroupLabelsByEnglishLabel: {
      Settings: "Settings",
    },
    signOut: {
      signOut: "Sign out",
      signingOut: "Signing out...",
      signOutOptions: "Sign out options",
      signOutThisDevice: "Sign out of this device",
      signOutEverywhere: "Sign out everywhere",
      confirmEverywhere:
        "Sign out of every device for your Owner account? You'll need to sign in again here.",
    },
  },
  hi: {
    skipToMainContent: "मुख्य सामग्री पर जाएँ",
    menu: "मेनू",
    close: "बंद करें",
    organizationPortalLabel: "संगठन",
    platformAdminPortalLabel: "प्लेटफ़ॉर्म एडमिन",
    navLabelsByHref: {
      "/dashboard": "होम",
      "/dashboard/contacts": "कॉन्टैक्ट्स",
      "/dashboard/messages": "मेसेज भेजें",
      "/dashboard/activity": "एक्टिविटी",
      "/dashboard/settings/channels": "चैनल",
      "/dashboard/templates": "टेम्पलेट",
      "/dashboard/settings/occasions": "अवसर प्रबंधन",
      "/dashboard/settings/contact-fields": "कॉन्टैक्ट फ़ील्ड",
      "/dashboard/settings/billing": "बिलिंग",
      "/admin": "ओवरव्यू",
      "/admin/usage": "उपयोग",
      "/admin/organizations": "क्लायंट",
      "/admin/vendors": "वेंडर",
      "/admin/settings/plan-catalogue": "सेटिंग्स",
    },
    navGroupLabelsByEnglishLabel: {
      Settings: "सेटिंग्स",
    },
    signOut: {
      signOut: "साइन आउट",
      signingOut: "साइन आउट हो रहा है...",
      signOutOptions: "साइन आउट विकल्प",
      signOutThisDevice: "इस डिवाइस से साइन आउट करें",
      signOutEverywhere: "हर जगह से साइन आउट करें",
      confirmEverywhere:
        "अपने Owner खाते के लिए हर डिवाइस से साइन आउट करें? आपको यहाँ फिर से साइन इन करना होगा।",
    },
  },
  mr: {
    skipToMainContent: "मुख्य मजकुराकडे जा",
    menu: "मेनू",
    close: "बंद करा",
    organizationPortalLabel: "संस्था",
    platformAdminPortalLabel: "प्लॅटफॉर्म अ‍ॅडमिन",
    navLabelsByHref: {
      "/dashboard": "होम",
      "/dashboard/contacts": "कॉन्टॅक्ट्स",
      "/dashboard/messages": "मेसेज पाठवा",
      "/dashboard/activity": "अ‍ॅक्टिव्हिटी",
      "/dashboard/settings/channels": "चॅनेल्स",
      "/dashboard/templates": "टेम्पलेट",
      "/dashboard/settings/occasions": "प्रसंग व्यवस्थापन",
      "/dashboard/settings/contact-fields": "कॉन्टॅक्ट फील्ड्स",
      "/dashboard/settings/billing": "बिलिंग",
      "/admin": "ओव्हरव्ह्यू",
      "/admin/usage": "वापर",
      "/admin/organizations": "क्लायंट",
      "/admin/vendors": "व्हेंडर",
      "/admin/settings/plan-catalogue": "सेटिंग्ज",
    },
    navGroupLabelsByEnglishLabel: {
      Settings: "सेटिंग्ज",
    },
    signOut: {
      signOut: "साइन आउट",
      signingOut: "साइन आउट होत आहे...",
      signOutOptions: "साइन आउट पर्याय",
      signOutThisDevice: "या डिव्हाइसवरून साइन आउट करा",
      signOutEverywhere: "सगळीकडून साइन आउट करा",
      confirmEverywhere:
        "तुमच्या Owner खात्यासाठी प्रत्येक डिव्हाइसवरून साइन आउट करायचे? तुम्हाला इथे पुन्हा साइन इन करावे लागेल.",
    },
  },
};

export function getShellDict(locale: Locale): ShellDict {
  return SHELL_DICT[locale];
}
