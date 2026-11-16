"use client";

import { useEffect, useState } from "react";

import { InlineAlert } from "@/components/ui/feedback";
import {
  Panel,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { formatAutomationSendTimeLabel } from "@/lib/automation/send-time";
import type { Locale } from "@/lib/i18n/constants";
import { formatLongDate } from "@/lib/i18n/format-date";
import { useLocale } from "@/lib/i18n/use-locale";

type Settings = {
  enabled: boolean;
  allowedByAdmin: boolean;
  recipients: string[];
  defaultNumber: string | null;
  maxRecipients: number;
  sendHour: number | null;
  sendMinute: number | null;
  defaultSendHour: number;
  lastScheduled: LastScheduled | null;
};

type LastScheduled = {
  at: string;
  forDate: string;
  status: "sent" | "partly_sent" | "failed" | "nobody" | "no_recipients";
  attempt: number;
  maxAttempts: number;
  total: number;
  results: Array<{ mobile: string; ok: boolean; error: string | null }>;
};

function hourLabel(hour: number): string {
  return formatAutomationSendTimeLabel(hour, 0);
}

type Labels = {
  title: string;
  description: string;
  enabled: string;
  sendTime: string;
  defaultTime: (time: string) => string;
  customTime: string;
  sendsAt: (time: string) => string;
  sendTimeNote: string;
  turnedOffByAdmin: string;
  recipients: string;
  usingDefault: (number: string) => string;
  noDefault: string;
  placeholder: string;
  addNumber: string;
  remove: string;
  save: string;
  saving: string;
  saved: string;
  failedToSave: string;
};

const LABELS: Record<Locale, Labels> = {
  en: {
    title: "Tomorrow's List on WhatsApp",
    description:
      "The day before, at the time you choose, we send a WhatsApp link to the next day's list: Birthday Greetings, Anniversary Greetings and your other occasions, with each person's name and the last 4 digits of their number. The link stops working once that day is over.",
    enabled: "Send me Tomorrow's List",
    sendTime: "Send it the day before at (IST)",
    defaultTime: (time) => `Default (${time})`,
    customTime: "Custom time",
    sendsAt: (time) => `Sent at ${time} IST the day before.`,
    sendTimeNote:
      "Nothing is sent on days when nobody has an occasion the next day.",
    turnedOffByAdmin:
      "Tomorrow's List has been turned off for your account by the platform team. Contact support to turn it back on.",
    recipients: "Send it to",
    usingDefault: (number) =>
      `No numbers added, so it goes to your WhatsApp number ${number}.`,
    noDefault:
      "Your account has no WhatsApp number. Add a number below to receive the list.",
    placeholder: "10-digit WhatsApp number",
    addNumber: "Add number",
    remove: "Remove",
    save: "Save",
    saving: "Saving…",
    saved: "Tomorrow's List settings saved",
    failedToSave: "Could not save these settings.",
  },
  hi: {
    title: "WhatsApp पर कल की सूची",
    description:
      "एक दिन पहले, आपके चुने हुए समय पर, हम अगले दिन की सूची का WhatsApp लिंक भेजते हैं: जन्मदिन शुभकामनाएं, एनिवर्सरी शुभकामनाएं और आपके अन्य अवसर, हर व्यक्ति के नाम और नंबर के आख़िरी 4 अंकों के साथ। वह दिन ख़त्म होते ही लिंक काम करना बंद कर देता है।",
    enabled: "मुझे कल की सूची भेजें",
    sendTime: "एक दिन पहले भेजने का समय (IST)",
    defaultTime: (time) => `डिफ़ॉल्ट (${time})`,
    customTime: "अपना समय चुनें",
    sendsAt: (time) => `एक दिन पहले ${time} IST पर भेजी जाएगी।`,
    sendTimeNote:
      "जिस दिन अगले दिन किसी का कोई अवसर नहीं है, उस दिन कुछ नहीं भेजा जाता।",
    turnedOffByAdmin:
      "प्लेटफ़ॉर्म टीम ने आपके अकाउंट के लिए कल की सूची बंद कर दी है। इसे फिर से चालू करने के लिए सपोर्ट से संपर्क करें।",
    recipients: "इन नंबरों पर भेजें",
    usingDefault: (number) =>
      `कोई नंबर नहीं जोड़ा गया, इसलिए यह आपके WhatsApp नंबर ${number} पर जाएगी।`,
    noDefault:
      "आपके अकाउंट में WhatsApp नंबर नहीं है। सूची पाने के लिए नीचे नंबर जोड़ें।",
    placeholder: "10 अंकों का WhatsApp नंबर",
    addNumber: "नंबर जोड़ें",
    remove: "हटाएं",
    save: "सेव करें",
    saving: "सेव हो रहा है…",
    saved: "कल की सूची की सेटिंग सेव हो गई",
    failedToSave: "ये सेटिंग सेव नहीं हो सकीं।",
  },
  mr: {
    title: "WhatsApp वर उद्याची यादी",
    description:
      "आधीच्या दिवशी, तुम्ही निवडलेल्या वेळी, आम्ही पुढील दिवसाच्या यादीची WhatsApp लिंक पाठवतो: वाढदिवस शुभेच्छा, ॲनिव्हर्सरी शुभेच्छा आणि तुमचे इतर प्रसंग, प्रत्येक व्यक्तीचे नाव आणि नंबरचे शेवटचे 4 अंक. तो दिवस संपला की लिंक चालणे बंद होते.",
    enabled: "मला उद्याची यादी पाठवा",
    sendTime: "आधीच्या दिवशी पाठवण्याची वेळ (IST)",
    defaultTime: (time) => `डीफॉल्ट (${time})`,
    customTime: "स्वतःची वेळ निवडा",
    sendsAt: (time) => `आदल्या दिवशी ${time} IST ला पाठवली जाईल.`,
    sendTimeNote:
      "पुढील दिवशी कोणाचाही प्रसंग नसेल त्या दिवशी काहीही पाठवले जात नाही.",
    turnedOffByAdmin:
      "प्लॅटफॉर्म टीमने तुमच्या खात्यासाठी उद्याची यादी बंद केली आहे. ती पुन्हा सुरू करण्यासाठी सपोर्टशी संपर्क साधा.",
    recipients: "या नंबरवर पाठवा",
    usingDefault: (number) =>
      `कोणताही नंबर जोडलेला नाही, त्यामुळे ती तुमच्या WhatsApp नंबर ${number} वर जाईल.`,
    noDefault:
      "तुमच्या खात्यात WhatsApp नंबर नाही. यादी मिळवण्यासाठी खाली नंबर जोडा.",
    placeholder: "10 अंकी WhatsApp नंबर",
    addNumber: "नंबर जोडा",
    remove: "काढा",
    save: "सेव्ह करा",
    saving: "सेव्ह होत आहे…",
    saved: "उद्याच्या यादीची सेटिंग सेव्ह झाली",
    failedToSave: "या सेटिंग सेव्ह होऊ शकल्या नाहीत.",
  },
};

/**
 * Owner control for Tomorrow's List: on/off, the hour it goes out on the day
 * before, and the numbers it goes to. With no numbers saved it goes to the
 * Owner's own WhatsApp number.
 */
export function TomorrowListSettings() {
  const labels = LABELS[useLocale()];
  const { showToast } = useToast();
  const [enabled, setEnabled] = useState(true);
  const [allowedByAdmin, setAllowedByAdmin] = useState(true);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [defaultNumber, setDefaultNumber] = useState<string | null>(null);
  const [maxRecipients, setMaxRecipients] = useState(5);
  const [sendHour, setSendHour] = useState<number | null>(null);
  const [sendMinute, setSendMinute] = useState<number | null>(null);
  const [defaultSendHour, setDefaultSendHour] = useState(20);
  const [lastScheduled, setLastScheduled] = useState<LastScheduled | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function apply(settings: Settings) {
    setEnabled(settings.enabled);
    setAllowedByAdmin(settings.allowedByAdmin);
    setRecipients(settings.recipients);
    setDefaultNumber(settings.defaultNumber);
    setMaxRecipients(settings.maxRecipients);
    setSendHour(settings.sendHour);
    setSendMinute(settings.sendMinute);
    setDefaultSendHour(settings.defaultSendHour);
    setLastScheduled(settings.lastScheduled);
  }

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/v1/settings/tomorrow-list");
        if (!response.ok) {
          return;
        }
        const body = await response.json();
        apply(body.data as Settings);
        setLoaded(true);
      } catch {
        // Not shown - the panel simply stays hidden if it cannot load.
      }
    }

    void load();
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/settings/tomorrow-list", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          recipients: recipients.map((value) => value.trim()).filter(Boolean),
          sendHour,
          sendMinute: sendHour === null ? null : (sendMinute ?? 0),
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? labels.failedToSave);
        return;
      }

      apply(body.data as Settings);
      showToast(labels.saved);
    } catch {
      setError(labels.failedToSave);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return null;
  }

  return (
    <Panel className="p-5">
      <h2 className="text-sm font-semibold text-stone-900">{labels.title}</h2>
      <p className="mt-1 text-sm text-stone-600">{labels.description}</p>

      {!allowedByAdmin ? (
        <div className="mt-4">
          <InlineAlert tone="info">{labels.turnedOffByAdmin}</InlineAlert>
        </div>
      ) : null}

      {lastScheduled ? <LastScheduledSend value={lastScheduled} /> : null}

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled && allowedByAdmin}
          disabled={!allowedByAdmin}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        <span className="font-medium text-stone-800">{labels.enabled}</span>
      </label>

      <label className="mt-4 block max-w-md text-sm">
        <span className="font-medium text-stone-800">{labels.sendTime}</span>
        <select
          className={`mt-2 ${inputClass}`}
          value={sendHour === null ? "" : "custom"}
          onChange={(event) => {
            if (event.target.value === "") {
              setSendHour(null);
              setSendMinute(null);
            } else {
              setSendHour(defaultSendHour);
              setSendMinute(0);
            }
          }}
        >
          <option value="">{labels.defaultTime(hourLabel(defaultSendHour))}</option>
          <option value="custom">{labels.customTime}</option>
        </select>
      </label>
      {sendHour !== null ? (
        <div className="mt-2 max-w-md">
          <input
            type="time"
            step={60}
            className={inputClass}
            aria-label={labels.customTime}
            value={`${String(sendHour).padStart(2, "0")}:${String(sendMinute ?? 0).padStart(2, "0")}`}
            onChange={(event) => {
              const [hour, minute] = event.target.value.split(":").map(Number);
              if (Number.isInteger(hour) && Number.isInteger(minute)) {
                setSendHour(hour);
                setSendMinute(minute);
              }
            }}
          />
          <p className="mt-1 text-xs text-stone-600">
            {labels.sendsAt(formatAutomationSendTimeLabel(sendHour, sendMinute ?? 0))}
          </p>
        </div>
      ) : null}
      <p className="mt-2 max-w-md text-xs text-stone-500">{labels.sendTimeNote}</p>

      <div className="mt-4 text-sm">
        <span className="font-medium text-stone-800">{labels.recipients}</span>
        {recipients.length === 0 ? (
          <p className="mt-1 text-xs text-stone-500">
            {defaultNumber ? labels.usingDefault(defaultNumber) : labels.noDefault}
          </p>
        ) : null}

        <div className="mt-2 flex max-w-md flex-col gap-2">
          {recipients.map((value, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="tel"
                inputMode="tel"
                className={inputClass}
                placeholder={labels.placeholder}
                value={value}
                onChange={(event) =>
                  setRecipients((current) =>
                    current.map((entry, entryIndex) =>
                      entryIndex === index ? event.target.value : entry,
                    ),
                  )
                }
              />
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() =>
                  setRecipients((current) =>
                    current.filter((_, entryIndex) => entryIndex !== index),
                  )
                }
              >
                {labels.remove}
              </button>
            </div>
          ))}
        </div>

        {recipients.length < maxRecipients ? (
          <button
            type="button"
            className={`mt-2 ${secondaryButtonClass}`}
            onClick={() => setRecipients((current) => [...current, ""])}
          >
            {labels.addNumber}
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="mt-3">
          <InlineAlert tone="error">{error}</InlineAlert>
        </div>
      ) : null}

      <button
        type="button"
        className={`mt-4 ${primaryButtonClass}`}
        onClick={() => void handleSave()}
        disabled={saving}
      >
        {saving ? labels.saving : labels.save}
      </button>

      {allowedByAdmin ? <SendNowSection /> : null}
    </Panel>
  );
}

type LastScheduledLabels = {
  title: string;
  ranAt: (when: string, forDate: string) => string;
  sent: string;
  partlySent: string;
  failed: (attempt: number, max: number) => string;
  willRetry: string;
  noMoreRetries: string;
  nobody: string;
  noRecipients: string;
  numberOk: (mobile: string) => string;
  numberFailed: (mobile: string, error: string) => string;
};

const LAST_SCHEDULED_LABELS: Record<Locale, LastScheduledLabels> = {
  en: {
    title: "Last scheduled send",
    ranAt: (when, forDate) => `${when} · list for ${forDate}`,
    sent: "Accepted by WhatsApp.",
    partlySent: "Accepted for some numbers only.",
    failed: (attempt, max) => `Refused by WhatsApp (attempt ${attempt} of ${max}).`,
    willRetry: "It will be tried again automatically in a minute.",
    noMoreRetries:
      "No more automatic attempts for this day. Fix the problem, then use Send now or change the send time.",
    nobody: "Nobody had an occasion that day, so nothing was sent.",
    noRecipients: "There was no number to send it to.",
    numberOk: (mobile) => `${mobile}: accepted`,
    numberFailed: (mobile, error) => `${mobile}: ${error}`,
  },
  hi: {
    title: "पिछली शेड्यूल्ड भेजी गई सूची",
    ranAt: (when, forDate) => `${when} · ${forDate} की सूची`,
    sent: "WhatsApp ने स्वीकार किया।",
    partlySent: "केवल कुछ नंबरों के लिए स्वीकार किया गया।",
    failed: (attempt, max) => `WhatsApp ने अस्वीकार किया (प्रयास ${attempt} / ${max})।`,
    willRetry: "एक मिनट में अपने आप फिर से कोशिश की जाएगी।",
    noMoreRetries:
      "इस दिन के लिए अब अपने आप कोशिश नहीं होगी। समस्या ठीक करें, फिर अभी भेजें इस्तेमाल करें या भेजने का समय बदलें।",
    nobody: "उस दिन किसी का कोई अवसर नहीं था, इसलिए कुछ नहीं भेजा गया।",
    noRecipients: "भेजने के लिए कोई नंबर नहीं था।",
    numberOk: (mobile) => `${mobile}: स्वीकार किया गया`,
    numberFailed: (mobile, error) => `${mobile}: ${error}`,
  },
  mr: {
    title: "शेवटची शेड्यूल केलेली यादी",
    ranAt: (when, forDate) => `${when} · ${forDate} ची यादी`,
    sent: "WhatsApp ने स्वीकारले.",
    partlySent: "फक्त काही नंबरसाठी स्वीकारले.",
    failed: (attempt, max) => `WhatsApp ने नाकारले (प्रयत्न ${attempt} / ${max}).`,
    willRetry: "एका मिनिटात आपोआप पुन्हा प्रयत्न केला जाईल.",
    noMoreRetries:
      "या दिवसासाठी आता आपोआप प्रयत्न होणार नाही. समस्या दुरुस्त करा, मग आत्ता पाठवा वापरा किंवा पाठवण्याची वेळ बदला.",
    nobody: "त्या दिवशी कोणाचाही प्रसंग नव्हता, त्यामुळे काहीही पाठवले नाही.",
    noRecipients: "पाठवण्यासाठी कोणताही नंबर नव्हता.",
    numberOk: (mobile) => `${mobile}: स्वीकारले`,
    numberFailed: (mobile, error) => `${mobile}: ${error}`,
  },
};

const INTL_LOCALE: Record<Locale, string> = {
  en: "en-IN",
  hi: "hi-IN-u-nu-latn",
  mr: "mr-IN-u-nu-latn",
};

/** The latest scheduled send's outcome, so the Owner never has to guess. */
function LastScheduledSend({ value }: { value: LastScheduled }) {
  const locale = useLocale();
  const labels = LAST_SCHEDULED_LABELS[locale];
  const when = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value.at));

  let tone: "success" | "error" | "info" = "info";
  let headline = "";
  switch (value.status) {
    case "sent":
      tone = "success";
      headline = labels.sent;
      break;
    case "partly_sent":
      tone = "error";
      headline = labels.partlySent;
      break;
    case "failed":
      tone = "error";
      headline = `${labels.failed(value.attempt, value.maxAttempts)} ${
        value.attempt < value.maxAttempts ? labels.willRetry : labels.noMoreRetries
      }`;
      break;
    case "nobody":
      headline = labels.nobody;
      break;
    case "no_recipients":
      tone = "error";
      headline = labels.noRecipients;
      break;
  }

  return (
    <div className="mt-4 max-w-xl">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
        {labels.title}
      </p>
      <p className="mt-1 text-xs text-stone-500">
        {labels.ranAt(when, formatLongDate(value.forDate, locale))}
      </p>
      <div className="mt-2">
        <InlineAlert tone={tone}>
          <span className="block">{headline}</span>
          {value.results.length > 1 || value.status !== "sent"
            ? value.results.map((entry) => (
                <span key={entry.mobile} className="mt-1 block text-xs">
                  {entry.ok
                    ? labels.numberOk(entry.mobile)
                    : labels.numberFailed(entry.mobile, entry.error ?? "")}
                </span>
              ))
            : null}
        </InlineAlert>
      </div>
    </div>
  );
}

type SendNowResult =
  | {
      status: "sent";
      forDate: string;
      total: number;
      results: Array<{ mobile: string; ok: boolean; error: string | null }>;
    }
  | { status: "nobody"; forDate: string }
  | { status: "not_configured" }
  | { status: "turned_off_by_admin" }
  | { status: "no_recipients" }
  | { status: "limit_reached"; limit: number };

type SendNowLabels = {
  title: string;
  hint: string;
  button: string;
  sending: string;
  summary: (date: string, total: number) => string;
  accepted: (mobile: string) => string;
  refused: (mobile: string, error: string) => string;
  nobody: (date: string) => string;
  notConfigured: string;
  turnedOff: string;
  noRecipients: string;
  limitReached: (limit: number) => string;
  failed: string;
};

const SEND_NOW_LABELS: Record<Locale, SendNowLabels> = {
  en: {
    title: "Send it now",
    hint: "Sends tomorrow's list to the saved numbers right away and shows what happened. The scheduled send still goes out at your usual time. Save any changes above first.",
    button: "Send me tomorrow's list now",
    sending: "Sending…",
    summary: (date, total) => `List for ${date}: ${total} on the list.`,
    accepted: (mobile) =>
      `Accepted by WhatsApp for ${mobile}. It should arrive within a minute.`,
    refused: (mobile, error) => `Not sent to ${mobile}. WhatsApp said: ${error}`,
    nobody: (date) =>
      `Nobody has an occasion on ${date}, so there is nothing to send.`,
    notConfigured:
      "Tomorrow's List has not been switched on by the platform team yet.",
    turnedOff:
      "Tomorrow's List has been turned off for your account by the platform team.",
    noRecipients:
      "There is no number to send it to. Add a number above and save.",
    limitReached: (limit) =>
      `Tomorrow's list has already been sent ${limit} times today. Try again tomorrow.`,
    failed: "Could not send the list. Try again.",
  },
  hi: {
    title: "अभी भेजें",
    hint: "सेव किए गए नंबरों पर कल की सूची तुरंत भेजता है और बताता है कि क्या हुआ। पहले ऊपर के बदलाव सेव करें।",
    button: "मुझे कल की सूची अभी भेजें",
    sending: "भेजा जा रहा है…",
    summary: (date, total) => `${date} की सूची: ${total} लोग।`,
    accepted: (mobile) =>
      `WhatsApp ने ${mobile} के लिए स्वीकार किया। एक मिनट में पहुंच जानी चाहिए।`,
    refused: (mobile, error) =>
      `${mobile} पर नहीं भेजी गई। WhatsApp का जवाब: ${error}`,
    nobody: (date) => `${date} को किसी का कोई अवसर नहीं है, इसलिए भेजने को कुछ नहीं है।`,
    notConfigured: "प्लेटफ़ॉर्म टीम ने अभी कल की सूची चालू नहीं की है।",
    turnedOff: "प्लेटफ़ॉर्म टीम ने आपके अकाउंट के लिए कल की सूची बंद कर दी है।",
    noRecipients: "भेजने के लिए कोई नंबर नहीं है। ऊपर नंबर जोड़कर सेव करें।",
    limitReached: (limit) =>
      `कल की सूची आज पहले ही ${limit} बार भेजी जा चुकी है। कल फिर कोशिश करें।`,
    failed: "सूची नहीं भेजी जा सकी। फिर से कोशिश करें।",
  },
  mr: {
    title: "आत्ता पाठवा",
    hint: "सेव्ह केलेल्या नंबरवर उद्याची यादी लगेच पाठवते आणि काय झाले ते दाखवते. आधी वरचे बदल सेव्ह करा.",
    button: "मला उद्याची यादी आत्ता पाठवा",
    sending: "पाठवत आहे…",
    summary: (date, total) => `${date} ची यादी: ${total} व्यक्ती.`,
    accepted: (mobile) =>
      `WhatsApp ने ${mobile} साठी स्वीकारले. एका मिनिटात पोहोचायला हवी.`,
    refused: (mobile, error) =>
      `${mobile} वर पाठवली गेली नाही. WhatsApp चे उत्तर: ${error}`,
    nobody: (date) => `${date} रोजी कोणाचाही प्रसंग नाही, त्यामुळे पाठवण्यासारखे काही नाही.`,
    notConfigured: "प्लॅटफॉर्म टीमने अजून उद्याची यादी सुरू केलेली नाही.",
    turnedOff: "प्लॅटफॉर्म टीमने तुमच्या खात्यासाठी उद्याची यादी बंद केली आहे.",
    noRecipients: "पाठवण्यासाठी कोणताही नंबर नाही. वर नंबर जोडा आणि सेव्ह करा.",
    limitReached: (limit) =>
      `उद्याची यादी आज आधीच ${limit} वेळा पाठवली आहे. उद्या पुन्हा प्रयत्न करा.`,
    failed: "यादी पाठवता आली नाही. पुन्हा प्रयत्न करा.",
  },
};

/**
 * "Send me tomorrow's list now": sends straight away to the saved numbers
 * and shows the outcome per number, so the Owner never has to wonder
 * whether the scheduled send went out.
 */
function SendNowSection() {
  const locale = useLocale();
  const labels = SEND_NOW_LABELS[locale];
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendNowResult | null>(null);
  const [failed, setFailed] = useState(false);

  async function handleSendNow() {
    setSending(true);
    setResult(null);
    setFailed(false);
    try {
      const response = await fetch("/api/v1/settings/tomorrow-list/send-now", {
        method: "POST",
      });
      if (!response.ok) {
        setFailed(true);
        return;
      }
      const body = await response.json();
      setResult(body.data as SendNowResult);
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  }

  function renderResult(value: SendNowResult) {
    switch (value.status) {
      case "sent":
        return (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-stone-700">
              {labels.summary(formatLongDate(value.forDate, locale), value.total)}
            </p>
            {value.results.map((entry) => (
              <InlineAlert key={entry.mobile} tone={entry.ok ? "success" : "error"}>
                {entry.ok
                  ? labels.accepted(entry.mobile)
                  : labels.refused(entry.mobile, entry.error ?? "")}
              </InlineAlert>
            ))}
          </div>
        );
      case "nobody":
        return (
          <InlineAlert tone="info">
            {labels.nobody(formatLongDate(value.forDate, locale))}
          </InlineAlert>
        );
      case "not_configured":
        return <InlineAlert tone="info">{labels.notConfigured}</InlineAlert>;
      case "turned_off_by_admin":
        return <InlineAlert tone="info">{labels.turnedOff}</InlineAlert>;
      case "no_recipients":
        return <InlineAlert tone="error">{labels.noRecipients}</InlineAlert>;
      case "limit_reached":
        return <InlineAlert tone="info">{labels.limitReached(value.limit)}</InlineAlert>;
    }
  }

  return (
    <div className="mt-6 border-t border-stone-200 pt-4">
      <h3 className="text-sm font-semibold text-stone-900">{labels.title}</h3>
      <p className="mt-1 max-w-md text-xs text-stone-500">{labels.hint}</p>
      <button
        type="button"
        className={`mt-3 ${secondaryButtonClass}`}
        onClick={() => void handleSendNow()}
        disabled={sending}
      >
        {sending ? labels.sending : labels.button}
      </button>
      {result ? <div className="mt-3 max-w-xl">{renderResult(result)}</div> : null}
      {failed ? (
        <div className="mt-3 max-w-xl">
          <InlineAlert tone="error">{labels.failed}</InlineAlert>
        </div>
      ) : null}
    </div>
  );
}
