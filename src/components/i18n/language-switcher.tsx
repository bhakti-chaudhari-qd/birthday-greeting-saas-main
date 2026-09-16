"use client";

import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/constants";
import { setLocaleAndReload, useLocale } from "@/lib/i18n/use-locale";

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();

  return (
    <select
      aria-label="Language"
      value={locale}
      onChange={(event) => setLocaleAndReload(event.target.value as typeof locale)}
      className={className}
    >
      {LOCALES.map((code) => (
        <option key={code} value={code}>
          {LOCALE_LABELS[code]}
        </option>
      ))}
    </select>
  );
}
