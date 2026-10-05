import type { Locale } from "./constants";

/**
 * Display names for the two built-in system occasions. Custom occasions are
 * user-entered text and are shown as-is in every language - there's nothing
 * to translate them against.
 */
const SYSTEM_OCCASION_NAMES: Record<Locale, Record<string, string>> = {
  en: {},
  hi: {
    Birthday: "जन्मदिन",
    Anniversary: "एनिवर्सरी",
  },
  mr: {
    Birthday: "वाढदिवस",
    Anniversary: "ॲनिव्हर्सरी",
  },
};

export function translateOccasionName(name: string, locale: Locale): string {
  return SYSTEM_OCCASION_NAMES[locale][name] ?? name;
}
