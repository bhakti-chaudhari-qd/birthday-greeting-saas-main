import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_LABELS,
  isLocale,
  type Locale,
} from "@/lib/i18n/constants";
import { formatLongDate } from "@/lib/i18n/format-date";
import { translateOccasionName } from "@/lib/i18n/occasion-labels";
import { getTomorrowListView } from "@/lib/tomorrow-list/service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tomorrow's List",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

type Labels = {
  title: string;
  people: (count: number) => string;
  greetings: (occasion: string) => string;
  validUntil: (date: string) => string;
  expiredTitle: string;
  expiredBody: string;
  nobody: string;
};

const LABELS: Record<Locale, Labels> = {
  en: {
    title: "Tomorrow's List",
    people: (count) => (count === 1 ? "1 person" : `${count} people`),
    greetings: (occasion) => `${occasion} Greetings`,
    validUntil: (date) => `This link stops working after ${date}.`,
    expiredTitle: "This list has expired",
    expiredBody:
      "Tomorrow's List links only work until the end of the day they are for. A new link is sent on WhatsApp the day before each list.",
    nobody: "Nobody has an occasion on this day.",
  },
  hi: {
    title: "कल की सूची",
    people: (count) => `${count} लोग`,
    greetings: (occasion) => `${occasion} शुभकामनाएं`,
    validUntil: (date) => `यह लिंक ${date} के बाद काम नहीं करेगा।`,
    expiredTitle: "यह सूची समाप्त हो गई है",
    expiredBody:
      "कल की सूची का लिंक केवल उसी दिन के अंत तक काम करता है। हर सूची के लिए एक दिन पहले WhatsApp पर नया लिंक भेजा जाता है।",
    nobody: "इस दिन किसी का कोई अवसर नहीं है।",
  },
  mr: {
    title: "उद्याची यादी",
    people: (count) => `${count} व्यक्ती`,
    greetings: (occasion) => `${occasion} शुभेच्छा`,
    validUntil: (date) => `ही लिंक ${date} नंतर चालणार नाही.`,
    expiredTitle: "ही यादी कालबाह्य झाली आहे",
    expiredBody:
      "उद्याच्या यादीची लिंक फक्त त्या दिवसाच्या शेवटपर्यंत चालते. प्रत्येक यादीसाठी आदल्या दिवशी WhatsApp वर नवीन लिंक पाठवली जाते.",
    nobody: "या दिवशी कोणाचाही प्रसंग नाही.",
  },
};

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
};

async function resolveLocale(lang: string | undefined): Promise<Locale> {
  if (lang && isLocale(lang)) {
    return lang;
  }
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  return cookie && isLocale(cookie) ? cookie : DEFAULT_LOCALE;
}

function LanguageSwitch({ token, locale }: { token: string; locale: Locale }) {
  return (
    <nav className="flex gap-3 text-xs">
      {LOCALES.map((option) => (
        <Link
          key={option}
          href={`/t/${encodeURIComponent(token)}?lang=${option}`}
          className={
            option === locale
              ? "font-semibold text-emerald-700"
              : "text-stone-500 hover:underline"
          }
        >
          {LOCALE_LABELS[option]}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Public, no-login page behind the WhatsApp link: the next day's occasions,
 * one section per occasion, showing each contact's name and only the last
 * four digits of their mobile.
 */
export default async function TomorrowListPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { lang } = await searchParams;
  const locale = await resolveLocale(lang);
  const labels = LABELS[locale];
  const view = await getTomorrowListView(token);

  return (
    <main className="min-h-full bg-orange-50/60 px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-4 flex justify-end">
          <LanguageSwitch token={token} locale={locale} />
        </div>

        {view.status === "expired" ? (
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h1 className="text-lg font-semibold text-stone-900">
              {labels.expiredTitle}
            </h1>
            <p className="mt-2 text-sm text-stone-600">{labels.expiredBody}</p>
          </section>
        ) : (
          <>
            <header className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-emerald-700">
                {view.organizationName}
              </p>
              <h1 className="mt-1 text-xl font-bold text-emerald-900">
                {labels.title}
              </h1>
              <p className="mt-1 text-sm text-stone-700">
                {formatLongDate(view.isoDate, locale)} · {labels.people(view.total)}
              </p>
            </header>

            {view.sections.length === 0 ? (
              <p className="mt-4 rounded-xl bg-white p-5 text-sm text-stone-600 shadow-sm">
                {labels.nobody}
              </p>
            ) : (
              view.sections.map((section) => (
                <section
                  key={section.occasionName}
                  className="mt-4 overflow-hidden rounded-xl bg-white shadow-sm"
                >
                  <h2 className="flex items-center justify-between bg-emerald-600 px-5 py-3 text-sm font-semibold text-white">
                    <span>
                      {labels.greetings(
                        translateOccasionName(section.occasionName, locale),
                      )}
                    </span>
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                      {section.contacts.length}
                    </span>
                  </h2>
                  <ol className="divide-y divide-stone-100">
                    {section.contacts.map((contact, index) => (
                      <li
                        key={`${contact.name}-${contact.mobileLast4}-${index}`}
                        className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                      >
                        <span className="min-w-0 break-words font-medium text-stone-900">
                          {contact.name}
                        </span>
                        <span className="shrink-0 font-mono text-stone-500">
                          ••••{contact.mobileLast4}
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              ))
            )}

            <p className="mt-4 text-center text-xs text-stone-500">
              {labels.validUntil(formatLongDate(view.isoDate, locale))}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
