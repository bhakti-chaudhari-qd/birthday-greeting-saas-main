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
import { useLocale } from "@/lib/i18n/use-locale";

type Settings = {
  enabled: boolean;
  allowedByAdmin: boolean;
  recipients: string[];
  defaultNumber: string | null;
  maxRecipients: number;
  sendHour: number | null;
  defaultSendHour: number;
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function hourLabel(hour: number): string {
  return formatAutomationSendTimeLabel(hour, 0);
}

type Labels = {
  title: string;
  description: string;
  enabled: string;
  sendTime: string;
  defaultTime: (time: string) => string;
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
    title: "Daily summary on WhatsApp",
    description:
      "Every day at the time you choose we send a WhatsApp summary of your messages: how many were sent and how many failed on each channel.",
    enabled: "Send me the daily summary",
    sendTime: "Send it at (IST)",
    defaultTime: (time) => `Default (${time})`,
    sendTimeNote:
      "If you choose 6:00 PM or later, you get that same day's summary, and any activity after that time is added to the next day's summary. Before 6:00 PM, you get the previous day's summary.",
    turnedOffByAdmin:
      "The daily summary has been turned off for your account by the platform team. Contact support to turn it back on.",
    recipients: "Send it to",
    usingDefault: (number) =>
      `No numbers added, so it goes to your WhatsApp number ${number}.`,
    noDefault:
      "Your account has no WhatsApp number. Add a number below to receive the summary.",
    placeholder: "10-digit WhatsApp number",
    addNumber: "Add number",
    remove: "Remove",
    save: "Save",
    saving: "Saving…",
    saved: "Daily summary settings saved",
    failedToSave: "Could not save these settings.",
  },
  hi: {
    title: "WhatsApp पर रोज़ का सारांश",
    description:
      "हर दिन आपके चुने हुए समय पर हम आपके मेसेज का WhatsApp सारांश भेजते हैं: हर चैनल पर कितने भेजे गए और कितने फ़ेल हुए।",
    enabled: "मुझे रोज़ का सारांश भेजें",
    sendTime: "भेजने का समय (IST)",
    defaultTime: (time) => `डिफ़ॉल्ट (${time})`,
    sendTimeNote:
      "अगर आप शाम 6:00 बजे या उसके बाद का समय चुनते हैं, तो आपको उसी दिन का सारांश मिलेगा, और उस समय के बाद की गतिविधि अगले दिन के सारांश में जुड़ जाएगी। शाम 6:00 बजे से पहले के समय पर आपको पिछले दिन का सारांश मिलेगा।",
    turnedOffByAdmin:
      "प्लेटफ़ॉर्म टीम ने आपके अकाउंट के लिए रोज़ का सारांश बंद कर दिया है। इसे फिर से चालू करने के लिए सपोर्ट से संपर्क करें।",
    recipients: "इन नंबरों पर भेजें",
    usingDefault: (number) =>
      `कोई नंबर नहीं जोड़ा गया, इसलिए यह आपके WhatsApp नंबर ${number} पर जाएगा।`,
    noDefault:
      "आपके अकाउंट में WhatsApp नंबर नहीं है। सारांश पाने के लिए नीचे नंबर जोड़ें।",
    placeholder: "10 अंकों का WhatsApp नंबर",
    addNumber: "नंबर जोड़ें",
    remove: "हटाएं",
    save: "सेव करें",
    saving: "सेव हो रहा है…",
    saved: "रोज़ के सारांश की सेटिंग सेव हो गई",
    failedToSave: "ये सेटिंग सेव नहीं हो सकीं।",
  },
  mr: {
    title: "WhatsApp वर रोजचा सारांश",
    description:
      "दररोज तुम्ही निवडलेल्या वेळी आम्ही तुमच्या मेसेजचा WhatsApp सारांश पाठवतो: प्रत्येक चॅनेलवर किती पाठवले गेले आणि किती अयशस्वी झाले.",
    enabled: "मला रोजचा सारांश पाठवा",
    sendTime: "पाठवण्याची वेळ (IST)",
    defaultTime: (time) => `डीफॉल्ट (${time})`,
    sendTimeNote:
      "तुम्ही संध्याकाळी 6:00 किंवा त्यानंतरची वेळ निवडल्यास, तुम्हाला त्याच दिवसाचा सारांश मिळेल आणि त्या वेळेनंतरची ॲक्टिव्हिटी पुढच्या दिवसाच्या सारांशात जोडली जाईल. संध्याकाळी 6:00 च्या आधीच्या वेळेला तुम्हाला आदल्या दिवसाचा सारांश मिळेल.",
    turnedOffByAdmin:
      "प्लॅटफॉर्म टीमने तुमच्या खात्यासाठी रोजचा सारांश बंद केला आहे. तो पुन्हा सुरू करण्यासाठी सपोर्टशी संपर्क साधा.",
    recipients: "या नंबरवर पाठवा",
    usingDefault: (number) =>
      `कोणताही नंबर जोडलेला नाही, त्यामुळे तो तुमच्या WhatsApp नंबर ${number} वर जाईल.`,
    noDefault:
      "तुमच्या खात्यात WhatsApp नंबर नाही. सारांश मिळवण्यासाठी खाली नंबर जोडा.",
    placeholder: "10 अंकी WhatsApp नंबर",
    addNumber: "नंबर जोडा",
    remove: "काढा",
    save: "सेव्ह करा",
    saving: "सेव्ह होत आहे…",
    saved: "रोजच्या सारांशाची सेटिंग सेव्ह झाली",
    failedToSave: "या सेटिंग सेव्ह होऊ शकल्या नाहीत.",
  },
};

/**
 * Owner control for the daily WhatsApp summary: on/off, the hour it goes out
 * and the numbers it goes to. With no numbers saved it goes to the Owner's
 * own WhatsApp number.
 */
export function DailySummarySettings() {
  const labels = LABELS[useLocale()];
  const { showToast } = useToast();
  const [enabled, setEnabled] = useState(true);
  const [allowedByAdmin, setAllowedByAdmin] = useState(true);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [defaultNumber, setDefaultNumber] = useState<string | null>(null);
  const [maxRecipients, setMaxRecipients] = useState(5);
  const [sendHour, setSendHour] = useState<number | null>(null);
  const [defaultSendHour, setDefaultSendHour] = useState(9);
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
    setDefaultSendHour(settings.defaultSendHour);
  }

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/v1/settings/daily-summary");
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
      const response = await fetch("/api/v1/settings/daily-summary", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          recipients: recipients.map((value) => value.trim()).filter(Boolean),
          sendHour,
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
          value={sendHour ?? ""}
          onChange={(event) =>
            setSendHour(
              event.target.value === "" ? null : Number(event.target.value),
            )
          }
        >
          <option value="">{labels.defaultTime(hourLabel(defaultSendHour))}</option>
          {HOURS.map((hour) => (
            <option key={hour} value={hour}>
              {hourLabel(hour)}
            </option>
          ))}
        </select>
      </label>
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
    </Panel>
  );
}
