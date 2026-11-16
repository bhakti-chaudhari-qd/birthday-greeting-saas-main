"use client";

import type { Locale } from "@/lib/i18n/constants";
import { useLocale } from "@/lib/i18n/use-locale";

type GuideLabels = {
  businessAccountId: string;
  businessAccountIdHint: string;
  legacyNote: string;
  stepsTitle: string;
  steps: string[];
  templatesTitle: string;
  templateSteps: string[];
};

export const WHATSAPP_META_GUIDE_LABELS: Record<Locale, GuideLabels> = {
  en: {
    businessAccountId: "WhatsApp Business Account ID",
    businessAccountIdHint:
      "Needed to submit templates for approval from this app. Find it in Meta for Developers → your app → WhatsApp → API Setup, next to the Phone number ID (it is a different number).",
    legacyNote:
      "This gateway is no longer offered for new setups. It keeps working, but we recommend switching to Meta (WhatsApp Cloud API) so you can submit templates for approval from this app.",
    stepsTitle: "How to connect your Meta WhatsApp account",
    steps: [
      "Go to business.facebook.com and make sure your business is set up (business verification is recommended for higher sending limits).",
      "Go to developers.facebook.com → My Apps → Create app → choose Business, then add the WhatsApp product (Use case: Connect with customers through WhatsApp).",
      "In WhatsApp → API Setup, add and verify your business phone number. Copy the Phone number ID and the WhatsApp Business Account ID shown there.",
      "In WhatsApp Manager (business.facebook.com → WhatsApp Manager), add a payment method - without it Meta accepts messages but does not deliver them.",
      "Create a permanent token: business.facebook.com → Settings → Users → System users → Add (Admin) → Assign assets (your app and WhatsApp account, full control) → Generate new token → pick your app, tick whatsapp_business_messaging and whatsapp_business_management, expiry Never.",
      "Paste the Phone number ID, WhatsApp Business Account ID and access token below, tick Active and Save.",
    ],
    templatesTitle: "Then get your templates approved",
    templateSteps: [
      "Open Manage Templates → WhatsApp and create or open a template.",
      "Write the message with placeholders like {{name}} (each only once, not the first or last word), set the WhatsApp template name and language, and Save.",
      "Open the template again and click \"Submit to Meta for approval\" in the Meta approval box.",
      "Click \"Check status\" after a few minutes. Once it says Approved, greetings with it will be delivered.",
    ],
  },
  hi: {
    businessAccountId: "WhatsApp Business Account ID",
    businessAccountIdHint:
      "इस ऐप से टेम्पलेट अप्रूवल के लिए भेजने के लिए ज़रूरी। Meta for Developers → आपका ऐप → WhatsApp → API Setup में, Phone number ID के पास मिलेगा (यह अलग नंबर है)।",
    legacyNote:
      "यह गेटवे अब नए सेटअप के लिए उपलब्ध नहीं है। यह चलता रहेगा, लेकिन हम Meta (WhatsApp Cloud API) पर जाने की सलाह देते हैं ताकि आप इसी ऐप से टेम्पलेट अप्रूवल के लिए भेज सकें।",
    stepsTitle: "अपना Meta WhatsApp अकाउंट कैसे जोड़ें",
    steps: [
      "business.facebook.com पर जाएं और देखें कि आपका बिज़नेस सेट है (ज़्यादा भेजने की लिमिट के लिए बिज़नेस वेरिफ़िकेशन की सलाह है)।",
      "developers.facebook.com → My Apps → Create app → Business चुनें, फिर WhatsApp प्रोडक्ट जोड़ें (Use case: Connect with customers through WhatsApp)।",
      "WhatsApp → API Setup में अपना बिज़नेस फ़ोन नंबर जोड़कर वेरिफ़ाई करें। वहां दिखने वाला Phone number ID और WhatsApp Business Account ID कॉपी करें।",
      "WhatsApp Manager (business.facebook.com → WhatsApp Manager) में पेमेंट मेथड जोड़ें - इसके बिना Meta मैसेज स्वीकार करता है पर डिलीवर नहीं करता।",
      "स्थायी टोकन बनाएं: business.facebook.com → Settings → Users → System users → Add (Admin) → Assign assets (आपका ऐप और WhatsApp अकाउंट, full control) → Generate new token → अपना ऐप चुनें, whatsapp_business_messaging और whatsapp_business_management टिक करें, expiry Never।",
      "नीचे Phone number ID, WhatsApp Business Account ID और access token पेस्ट करें, Active टिक करें और सेव करें।",
    ],
    templatesTitle: "फिर अपने टेम्पलेट अप्रूव करवाएं",
    templateSteps: [
      "टेम्पलेट मैनेज करें → WhatsApp खोलें और टेम्पलेट बनाएं या खोलें।",
      "{{name}} जैसे प्लेसहोल्डर के साथ मैसेज लिखें (हर एक सिर्फ़ एक बार, पहला या आख़िरी शब्द नहीं), WhatsApp टेम्पलेट का नाम और भाषा भरें, और सेव करें।",
      "टेम्पलेट दोबारा खोलें और Meta अप्रूवल बॉक्स में \"Meta को अप्रूवल के लिए भेजें\" दबाएं।",
      "कुछ मिनट बाद \"स्टेटस देखें\" दबाएं। अप्रूव्ड दिखने पर इस टेम्पलेट वाली शुभकामनाएं डिलीवर होंगी।",
    ],
  },
  mr: {
    businessAccountId: "WhatsApp Business Account ID",
    businessAccountIdHint:
      "या अ‍ॅपमधून टेम्पलेट मंजुरीसाठी पाठवण्यासाठी आवश्यक. Meta for Developers → तुमचे अ‍ॅप → WhatsApp → API Setup मध्ये, Phone number ID जवळ मिळेल (हा वेगळा नंबर आहे).",
    legacyNote:
      "हा गेटवे आता नवीन सेटअपसाठी उपलब्ध नाही. तो चालू राहील, पण आम्ही Meta (WhatsApp Cloud API) वर जाण्याची शिफारस करतो, म्हणजे तुम्ही याच अ‍ॅपमधून टेम्पलेट मंजुरीसाठी पाठवू शकता.",
    stepsTitle: "तुमचे Meta WhatsApp खाते कसे जोडायचे",
    steps: [
      "business.facebook.com वर जा आणि तुमचा बिझनेस सेट असल्याची खात्री करा (जास्त पाठवण्याच्या मर्यादेसाठी बिझनेस व्हेरिफिकेशनची शिफारस आहे).",
      "developers.facebook.com → My Apps → Create app → Business निवडा, मग WhatsApp प्रॉडक्ट जोडा (Use case: Connect with customers through WhatsApp).",
      "WhatsApp → API Setup मध्ये तुमचा बिझनेस फोन नंबर जोडून व्हेरिफाय करा. तिथे दिसणारा Phone number ID आणि WhatsApp Business Account ID कॉपी करा.",
      "WhatsApp Manager (business.facebook.com → WhatsApp Manager) मध्ये पेमेंट मेथड जोडा - त्याशिवाय Meta संदेश स्वीकारते पण पोहोचवत नाही.",
      "कायमचा टोकन तयार करा: business.facebook.com → Settings → Users → System users → Add (Admin) → Assign assets (तुमचे अ‍ॅप आणि WhatsApp खाते, full control) → Generate new token → तुमचे अ‍ॅप निवडा, whatsapp_business_messaging आणि whatsapp_business_management टिक करा, expiry Never.",
      "खाली Phone number ID, WhatsApp Business Account ID आणि access token पेस्ट करा, Active टिक करा आणि सेव्ह करा.",
    ],
    templatesTitle: "मग तुमचे टेम्पलेट मंजूर करून घ्या",
    templateSteps: [
      "टेम्पलेट व्यवस्थापन → WhatsApp उघडा आणि टेम्पलेट तयार करा किंवा उघडा.",
      "{{name}} सारख्या प्लेसहोल्डरसह संदेश लिहा (प्रत्येक फक्त एकदा, पहिला किंवा शेवटचा शब्द नाही), WhatsApp टेम्पलेटचे नाव आणि भाषा भरा, आणि सेव्ह करा.",
      "टेम्पलेट पुन्हा उघडा आणि Meta मंजुरी बॉक्समध्ये \"Meta कडे मंजुरीसाठी पाठवा\" दाबा.",
      "काही मिनिटांनी \"स्थिती तपासा\" दाबा. मंजूर दिसल्यावर या टेम्पलेटच्या शुभेच्छा पोहोचतील.",
    ],
  },
};

/** Step-by-step guide to connecting Meta WhatsApp and getting templates approved. */
export function WhatsAppMetaGuide({ defaultOpen }: { defaultOpen: boolean }) {
  const labels = WHATSAPP_META_GUIDE_LABELS[useLocale()];
  return (
    <details
      className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm"
      open={defaultOpen}
    >
      <summary className="cursor-pointer font-medium text-stone-800">
        {labels.stepsTitle}
      </summary>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-stone-600">
        {labels.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="mt-3 font-medium text-stone-800">{labels.templatesTitle}</p>
      <ol className="mt-1 list-decimal space-y-1 pl-5 text-stone-600">
        {labels.templateSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </details>
  );
}
