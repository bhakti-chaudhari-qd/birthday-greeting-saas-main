"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { InlineAlert } from "@/components/ui/feedback";
import {
  Panel,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/page";
import type { Locale } from "@/lib/i18n/constants";
import { useLocale } from "@/lib/i18n/use-locale";

type ApprovalView = {
  status: string | null;
  category: string | null;
  rejectedReason: string | null;
  submittedAt: string | null;
  checkedAt: string | null;
  templateName: string | null;
  language: string;
  connection: "META_READY" | "META_NEEDS_BUSINESS_ACCOUNT" | "NOT_META" | "NONE";
  hasMedia: boolean;
};

type Category = "MARKETING" | "UTILITY";

type Labels = {
  title: string;
  intro: string;
  statusLabel: Record<string, string>;
  notSubmitted: string;
  categoryAssigned: (category: string) => string;
  categoryNote: string;
  rejectedBecause: (reason: string) => string;
  checkedAt: (when: string) => string;
  editedNote: string;
  pendingNote: string;
  approvedNote: string;
  category: string;
  categoryOptions: Record<Category, string>;
  categoryHint: string;
  saveFirst: string;
  submit: string;
  resubmit: string;
  submitting: string;
  check: string;
  checking: string;
  submitted: string;
  needsMeta: string;
  needsBusinessAccount: string;
  openWhatsAppSettings: string;
  mediaNote: string;
  stepsTitle: string;
  steps: string[];
  failed: string;
};

const LABELS: Record<Locale, Labels> = {
  en: {
    title: "Meta approval",
    intro:
      "WhatsApp only delivers templates Meta has approved. Submit this template to Meta from here and check its status.",
    statusLabel: {
      APPROVED: "Approved",
      PENDING: "In review",
      REJECTED: "Rejected",
      PAUSED: "Paused",
      DISABLED: "Disabled",
      EDITED: "Changed since submitting",
    },
    notSubmitted: "Not submitted from the app yet",
    categoryAssigned: (category) => `Category: ${category.toLowerCase()}`,
    categoryNote:
      "Meta decides the final category. Birthday and anniversary greetings are usually marketing.",
    rejectedBecause: (reason) => `Meta's reason: ${reason}`,
    checkedAt: (when) => `Last checked ${when}`,
    editedNote:
      "You changed the text after submitting. Submit again so Meta approves the new text before greetings use it.",
    pendingNote:
      "Meta usually reviews within a few minutes, sometimes up to 24 hours. Use Check status to see the result.",
    approvedNote: "Ready to use. Greetings with this template will be delivered.",
    category: "Category",
    categoryOptions: {
      MARKETING: "Marketing (greetings, wishes, offers)",
      UTILITY: "Utility (account updates, reminders)",
    },
    categoryHint:
      "Pick Marketing for birthday and anniversary greetings; Meta changes it to Marketing anyway if you pick Utility.",
    saveFirst: "Meta receives the saved text - save any changes above first.",
    submit: "Submit to Meta for approval",
    resubmit: "Submit again",
    submitting: "Submitting…",
    check: "Check status",
    checking: "Checking…",
    submitted: "Submitted to Meta.",
    needsMeta:
      "Submitting from the app needs your own Meta WhatsApp connection. Set it up under Settings → Channels → WhatsApp (the steps are there). Until then, create templates in your WhatsApp provider's panel and type the approved name above.",
    needsBusinessAccount:
      "Add your WhatsApp Business Account ID under Settings → Channels → WhatsApp to submit from here.",
    openWhatsAppSettings: "Open WhatsApp settings",
    mediaNote:
      "This template has an image or video. Those can't be submitted from the app yet: remove the media to submit a text template, or create this one in WhatsApp Manager.",
    stepsTitle: "How approval works",
    steps: [
      "Connect your Meta WhatsApp account under Settings → Channels → WhatsApp, including the WhatsApp Business Account ID.",
      "Write the message above. Use placeholders like {{name}} - each one only once, and not as the very first or last word.",
      "Set the WhatsApp template name (lowercase letters, numbers, underscores) and language, then Save.",
      "Choose the category and click \"Submit to Meta for approval\".",
      "Click \"Check status\" after a few minutes. Approved = ready to send. Rejected = read Meta's reason, edit the text, save and submit again.",
    ],
    failed: "Something went wrong. Try again.",
  },
  hi: {
    title: "Meta अप्रूवल",
    intro:
      "WhatsApp सिर्फ़ Meta से अप्रूव्ड टेम्पलेट ही डिलीवर करता है। यह टेम्पलेट यहीं से Meta को भेजें और उसका स्टेटस देखें।",
    statusLabel: {
      APPROVED: "अप्रूव्ड",
      PENDING: "रिव्यू में",
      REJECTED: "रिजेक्टेड",
      PAUSED: "रोका गया",
      DISABLED: "बंद",
      EDITED: "भेजने के बाद बदला गया",
    },
    notSubmitted: "अभी ऐप से नहीं भेजा गया",
    categoryAssigned: (category) => `कैटेगरी: ${category.toLowerCase()}`,
    categoryNote:
      "आख़िरी कैटेगरी Meta तय करता है। जन्मदिन और एनिवर्सरी शुभकामनाएं आमतौर पर marketing होती हैं।",
    rejectedBecause: (reason) => `Meta का कारण: ${reason}`,
    checkedAt: (when) => `पिछली बार देखा ${when}`,
    editedNote:
      "भेजने के बाद आपने टेक्स्ट बदला है। फिर से भेजें ताकि शुभकामनाओं में इस्तेमाल से पहले Meta नया टेक्स्ट अप्रूव करे।",
    pendingNote:
      "Meta आमतौर पर कुछ मिनटों में, कभी-कभी 24 घंटे तक में रिव्यू करता है। नतीजा देखने के लिए स्टेटस देखें दबाएं।",
    approvedNote: "इस्तेमाल के लिए तैयार। इस टेम्पलेट वाली शुभकामनाएं डिलीवर होंगी।",
    category: "कैटेगरी",
    categoryOptions: {
      MARKETING: "Marketing (शुभकामनाएं, ऑफ़र)",
      UTILITY: "Utility (अकाउंट अपडेट, रिमाइंडर)",
    },
    categoryHint:
      "जन्मदिन और एनिवर्सरी शुभकामनाओं के लिए Marketing चुनें; Utility चुनने पर भी Meta इसे Marketing कर देता है।",
    saveFirst: "Meta को सेव किया गया टेक्स्ट मिलता है - पहले ऊपर के बदलाव सेव करें।",
    submit: "Meta को अप्रूवल के लिए भेजें",
    resubmit: "फिर से भेजें",
    submitting: "भेजा जा रहा है…",
    check: "स्टेटस देखें",
    checking: "देखा जा रहा है…",
    submitted: "Meta को भेज दिया गया।",
    needsMeta:
      "ऐप से भेजने के लिए आपका अपना Meta WhatsApp कनेक्शन चाहिए। इसे सेटिंग्स → चैनल → WhatsApp में सेट करें (स्टेप्स वहीं हैं)। तब तक टेम्पलेट अपने WhatsApp प्रोवाइडर के पैनल में बनाएं और ऊपर अप्रूव्ड नाम लिखें।",
    needsBusinessAccount:
      "यहां से भेजने के लिए सेटिंग्स → चैनल → WhatsApp में अपना WhatsApp Business Account ID जोड़ें।",
    openWhatsAppSettings: "WhatsApp सेटिंग्स खोलें",
    mediaNote:
      "इस टेम्पलेट में इमेज या वीडियो है। ये अभी ऐप से नहीं भेजे जा सकते: टेक्स्ट टेम्पलेट भेजने के लिए मीडिया हटाएं, या इसे WhatsApp Manager में बनाएं।",
    stepsTitle: "अप्रूवल कैसे होता है",
    steps: [
      "सेटिंग्स → चैनल → WhatsApp में अपना Meta WhatsApp अकाउंट जोड़ें, WhatsApp Business Account ID के साथ।",
      "ऊपर मैसेज लिखें। {{name}} जैसे प्लेसहोल्डर इस्तेमाल करें - हर एक सिर्फ़ एक बार, और सबसे पहले या सबसे आख़िरी शब्द के रूप में नहीं।",
      "WhatsApp टेम्पलेट का नाम (छोटे अक्षर, नंबर, अंडरस्कोर) और भाषा भरें, फिर सेव करें।",
      "कैटेगरी चुनें और \"Meta को अप्रूवल के लिए भेजें\" दबाएं।",
      "कुछ मिनट बाद \"स्टेटस देखें\" दबाएं। अप्रूव्ड = भेजने के लिए तैयार। रिजेक्टेड = Meta का कारण पढ़ें, टेक्स्ट बदलें, सेव करें और फिर से भेजें।",
    ],
    failed: "कुछ गड़बड़ हुई। फिर से कोशिश करें।",
  },
  mr: {
    title: "Meta मंजुरी",
    intro:
      "WhatsApp फक्त Meta ने मंजूर केलेले टेम्पलेटच पोहोचवते. हे टेम्पलेट इथूनच Meta कडे पाठवा आणि त्याची स्थिती पाहा.",
    statusLabel: {
      APPROVED: "मंजूर",
      PENDING: "तपासणीत",
      REJECTED: "नाकारले",
      PAUSED: "थांबवले",
      DISABLED: "बंद",
      EDITED: "पाठवल्यानंतर बदलले",
    },
    notSubmitted: "अजून अ‍ॅपमधून पाठवलेले नाही",
    categoryAssigned: (category) => `श्रेणी: ${category.toLowerCase()}`,
    categoryNote:
      "अंतिम श्रेणी Meta ठरवते. वाढदिवस आणि ॲनिव्हर्सरी शुभेच्छा सहसा marketing असतात.",
    rejectedBecause: (reason) => `Meta चे कारण: ${reason}`,
    checkedAt: (when) => `शेवटचे तपासले ${when}`,
    editedNote:
      "पाठवल्यानंतर तुम्ही मजकूर बदलला आहे. शुभेच्छांसाठी वापरण्याआधी Meta ने नवीन मजकूर मंजूर करावा म्हणून पुन्हा पाठवा.",
    pendingNote:
      "Meta सहसा काही मिनिटांत, कधी कधी 24 तासांपर्यंत तपासते. निकाल पाहण्यासाठी स्थिती तपासा दाबा.",
    approvedNote: "वापरण्यासाठी तयार. या टेम्पलेटच्या शुभेच्छा पोहोचतील.",
    category: "श्रेणी",
    categoryOptions: {
      MARKETING: "Marketing (शुभेच्छा, ऑफर)",
      UTILITY: "Utility (खाते अपडेट, स्मरणपत्रे)",
    },
    categoryHint:
      "वाढदिवस आणि ॲनिव्हर्सरी शुभेच्छांसाठी Marketing निवडा; Utility निवडले तरी Meta ते Marketing करते.",
    saveFirst: "Meta ला सेव्ह केलेला मजकूर मिळतो - आधी वरचे बदल सेव्ह करा.",
    submit: "Meta कडे मंजुरीसाठी पाठवा",
    resubmit: "पुन्हा पाठवा",
    submitting: "पाठवत आहे…",
    check: "स्थिती तपासा",
    checking: "तपासत आहे…",
    submitted: "Meta कडे पाठवले.",
    needsMeta:
      "अ‍ॅपमधून पाठवण्यासाठी तुमचे स्वतःचे Meta WhatsApp कनेक्शन लागते. ते सेटिंग्ज → चॅनेल्स → WhatsApp मध्ये सेट करा (पायऱ्या तिथे आहेत). तोपर्यंत टेम्पलेट तुमच्या WhatsApp प्रोव्हायडरच्या पॅनेलमध्ये तयार करा आणि वर मंजूर नाव लिहा.",
    needsBusinessAccount:
      "इथून पाठवण्यासाठी सेटिंग्ज → चॅनेल्स → WhatsApp मध्ये तुमचा WhatsApp Business Account ID जोडा.",
    openWhatsAppSettings: "WhatsApp सेटिंग्ज उघडा",
    mediaNote:
      "या टेम्पलेटमध्ये इमेज किंवा व्हिडिओ आहे. ते अजून अ‍ॅपमधून पाठवता येत नाहीत: मजकूर टेम्पलेट पाठवण्यासाठी मीडिया काढा, किंवा हे WhatsApp Manager मध्ये तयार करा.",
    stepsTitle: "मंजुरी कशी होते",
    steps: [
      "सेटिंग्ज → चॅनेल्स → WhatsApp मध्ये तुमचे Meta WhatsApp खाते जोडा, WhatsApp Business Account ID सह.",
      "वर संदेश लिहा. {{name}} सारखे प्लेसहोल्डर वापरा - प्रत्येक फक्त एकदा, आणि अगदी पहिला किंवा शेवटचा शब्द म्हणून नाही.",
      "WhatsApp टेम्पलेटचे नाव (लहान अक्षरे, अंक, अंडरस्कोर) आणि भाषा भरा, मग सेव्ह करा.",
      "श्रेणी निवडा आणि \"Meta कडे मंजुरीसाठी पाठवा\" दाबा.",
      "काही मिनिटांनी \"स्थिती तपासा\" दाबा. मंजूर = पाठवण्यासाठी तयार. नाकारले = Meta चे कारण वाचा, मजकूर बदला, सेव्ह करा आणि पुन्हा पाठवा.",
    ],
    failed: "काहीतरी चुकले. पुन्हा प्रयत्न करा.",
  },
};

const STATUS_STYLES: Record<string, string> = {
  APPROVED: "bg-emerald-100 text-emerald-800",
  PENDING: "bg-amber-100 text-amber-800",
  EDITED: "bg-amber-100 text-amber-800",
  REJECTED: "bg-red-100 text-red-800",
  PAUSED: "bg-red-100 text-red-800",
  DISABLED: "bg-red-100 text-red-800",
};

const INTL_LOCALE: Record<Locale, string> = {
  en: "en-IN",
  hi: "hi-IN-u-nu-latn",
  mr: "mr-IN-u-nu-latn",
};

/**
 * Submit a WhatsApp template to Meta for approval with the client's own
 * Meta connection, and see Meta's status, category and rejection reason.
 */
export function WhatsAppApprovalPanel({ templateId }: { templateId: string }) {
  const locale = useLocale();
  const labels = LABELS[locale];
  const [view, setView] = useState<ApprovalView | null>(null);
  const [category, setCategory] = useState<Category>("MARKETING");
  const [busy, setBusy] = useState<null | "submit" | "check">(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const endpoint = `/api/v1/templates/${templateId}/whatsapp-approval`;

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(endpoint);
        const body = await response.json();
        if (response.ok) {
          setView(body.data as ApprovalView);
        }
      } catch {
        // The panel stays hidden if it cannot load.
      }
    }
    void load();
  }, [endpoint]);

  async function run(kind: "submit" | "check") {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      const response =
        kind === "submit"
          ? await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ category }),
            })
          : await fetch(`${endpoint}?refresh=1`);
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.message ?? labels.failed);
        return;
      }
      setView(body.data as ApprovalView);
      if (kind === "submit") {
        setNotice(labels.submitted);
      }
    } catch {
      setError(labels.failed);
    } finally {
      setBusy(null);
    }
  }

  if (!view) {
    return null;
  }

  const ready = view.connection === "META_READY";
  const canCheck = view.connection === "META_READY" || view.connection === "META_NEEDS_BUSINESS_ACCOUNT";
  const resubmit =
    view.status === "REJECTED" || view.status === "PAUSED" || view.status === "EDITED";
  const canSubmit =
    ready && !view.hasMedia && (view.status === null || resubmit);
  const when = (iso: string) =>
    new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-stone-900">{labels.title}</h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            view.status
              ? (STATUS_STYLES[view.status] ?? "bg-stone-200 text-stone-700")
              : "bg-stone-200 text-stone-700"
          }`}
        >
          {view.status
            ? (labels.statusLabel[view.status] ?? view.status)
            : labels.notSubmitted}
        </span>
      </div>
      <p className="mt-1 text-sm text-stone-600">{labels.intro}</p>

      {view.category ? (
        <p className="mt-2 text-xs text-stone-600">
          {labels.categoryAssigned(view.category)}. {labels.categoryNote}
        </p>
      ) : null}
      {view.checkedAt ? (
        <p className="mt-1 text-xs text-stone-500">{labels.checkedAt(when(view.checkedAt))}</p>
      ) : null}

      <div className="mt-3 flex flex-col gap-2">
        {view.status === "APPROVED" ? (
          <InlineAlert tone="success">{labels.approvedNote}</InlineAlert>
        ) : null}
        {view.status === "PENDING" ? (
          <InlineAlert tone="info">{labels.pendingNote}</InlineAlert>
        ) : null}
        {view.status === "EDITED" ? (
          <InlineAlert tone="info">{labels.editedNote}</InlineAlert>
        ) : null}
        {view.rejectedReason ? (
          <InlineAlert tone="error">{labels.rejectedBecause(view.rejectedReason)}</InlineAlert>
        ) : null}
        {view.connection === "NOT_META" || view.connection === "NONE" ? (
          <InlineAlert tone="info">{labels.needsMeta}</InlineAlert>
        ) : null}
        {view.connection === "META_NEEDS_BUSINESS_ACCOUNT" ? (
          <InlineAlert tone="info">{labels.needsBusinessAccount}</InlineAlert>
        ) : null}
        {ready && view.hasMedia ? (
          <InlineAlert tone="info">{labels.mediaNote}</InlineAlert>
        ) : null}
      </div>

      {!ready ? (
        <Link
          href="/dashboard/settings/whatsapp"
          className={`mt-3 inline-flex ${secondaryButtonClass}`}
        >
          {labels.openWhatsAppSettings}
        </Link>
      ) : null}

      {canSubmit ? (
        <label className="mt-4 block max-w-md text-sm">
          <span className="font-medium text-stone-800">{labels.category}</span>
          <select
            className={`mt-1 ${inputClass}`}
            value={category}
            onChange={(event) => setCategory(event.target.value as Category)}
          >
            <option value="MARKETING">{labels.categoryOptions.MARKETING}</option>
            <option value="UTILITY">{labels.categoryOptions.UTILITY}</option>
          </select>
          <span className="mt-1 block text-xs text-stone-500">{labels.categoryHint}</span>
        </label>
      ) : null}

      {canSubmit || canCheck ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {canSubmit ? (
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => void run("submit")}
              disabled={busy !== null}
            >
              {busy === "submit"
                ? labels.submitting
                : resubmit
                  ? labels.resubmit
                  : labels.submit}
            </button>
          ) : null}
          {canCheck ? (
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => void run("check")}
              disabled={busy !== null}
            >
              {busy === "check" ? labels.checking : labels.check}
            </button>
          ) : null}
        </div>
      ) : null}
      {canSubmit ? <p className="mt-2 text-xs text-stone-500">{labels.saveFirst}</p> : null}

      {error ? (
        <div className="mt-3">
          <InlineAlert tone="error">{error}</InlineAlert>
        </div>
      ) : null}
      {notice ? (
        <div className="mt-3">
          <InlineAlert tone="success">{notice}</InlineAlert>
        </div>
      ) : null}

      <details className="mt-4 rounded-lg border border-stone-200 p-3 text-sm">
        <summary className="cursor-pointer font-medium text-stone-800">
          {labels.stepsTitle}
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-stone-600">
          {labels.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </details>
    </Panel>
  );
}
