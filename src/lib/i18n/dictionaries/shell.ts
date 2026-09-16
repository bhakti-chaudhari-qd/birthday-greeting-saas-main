import type { Locale } from "../constants";

export type ShellDict = {
  skipToMainContent: string;
  menu: string;
  close: string;
  organizationPortalLabel: string;
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
    navLabelsByHref: {
      "/dashboard": "होम",
      "/dashboard/contacts": "संपर्क",
      "/dashboard/messages": "संदेश भेजें",
      "/dashboard/activity": "गतिविधि",
      "/dashboard/settings/channels": "चैनल",
      "/dashboard/templates": "टेम्पलेट प्रबंधित करें",
      "/dashboard/settings/occasions": "अवसर प्रबंधन",
      "/dashboard/settings/contact-fields": "संपर्क फ़ील्ड",
      "/dashboard/settings/billing": "बिलिंग",
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
    navLabelsByHref: {
      "/dashboard": "होम",
      "/dashboard/contacts": "संपर्क",
      "/dashboard/messages": "संदेश पाठवा",
      "/dashboard/activity": "अ‍ॅक्टिव्हिटी",
      "/dashboard/settings/channels": "चॅनेल्स",
      "/dashboard/templates": "टेम्पलेट व्यवस्थापित करा",
      "/dashboard/settings/occasions": "प्रसंग व्यवस्थापन",
      "/dashboard/settings/contact-fields": "संपर्क फील्ड्स",
      "/dashboard/settings/billing": "बिलिंग",
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
