import type { Locale } from "./constants";

const INTL_LOCALE: Record<Locale, string> = {
  en: "en-GB",
  // -u-nu-latn keeps day/year in familiar Arabic numerals - only the
  // weekday/month names switch script, matching how dates read elsewhere
  // in Indian apps (and the rest of this UI, which never localizes digits).
  hi: "hi-IN-u-nu-latn",
  mr: "mr-IN-u-nu-latn",
};

/** Long-form date, e.g. "Friday, 17 July 2026" / "शुक्रवार, 17 जुलाई 2026". */
export function formatLongDate(isoDate: string, locale: Locale): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) {
    return isoDate;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
