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
  sendMinute: number | null;
  defaultSendHour: number;
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
    </Panel>
  );
}
