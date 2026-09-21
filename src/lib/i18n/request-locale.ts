import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./constants";

/** Site language from the request's locale cookie (same cookie the UI switcher sets). */
export function getRequestLocale(request: Request): Locale {
  const cookie = request.headers.get("cookie") ?? "";

  for (const part of cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== LOCALE_COOKIE) continue;

    let value = part.slice(separator + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      // Malformed escape - fall through to the default below.
    }
    return isLocale(value) ? value : DEFAULT_LOCALE;
  }

  return DEFAULT_LOCALE;
}
