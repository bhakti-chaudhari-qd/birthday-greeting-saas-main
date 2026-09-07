/**
 * Lightweight language detection for product help chat.
 * Hindi and Marathi both use Devanagari; we bias with common markers.
 */

export type HelpReplyLanguage = "en" | "hi" | "mr";

const DEVANAGARI = /[\u0900-\u097F]/;

/** Characters / tokens more common in Marathi than Hindi. */
const MARATHI_MARKERS =
  /[ळ]|आहे|काय\s|तुम्ही|आम्ही|मला\s|तुला\s|कसे\s|कशी\s|आहे का|कृपया मदत|वाढदिवस/;

/** Tokens that lean Hindi when Devanagari is present. */
const HINDI_MARKERS =
  /है\b|क्या\s|मुझे\s|आप\s|कृपया मदद|जन्मदिन|संपर्क जोड़|टेम्पलेट/;

export function detectHelpReplyLanguage(text: string): HelpReplyLanguage {
  const sample = text.trim();
  if (!sample || !DEVANAGARI.test(sample)) {
    return "en";
  }

  const marathiHits = (sample.match(MARATHI_MARKERS) ?? []).length;
  const hindiHits = (sample.match(HINDI_MARKERS) ?? []).length;

  if (marathiHits > hindiHits) {
    return "mr";
  }
  if (hindiHits > marathiHits) {
    return "hi";
  }

  // Default Devanagari to Hindi (wider shared vocabulary).
  return "hi";
}

export function helpLanguageInstruction(language: HelpReplyLanguage): string {
  if (language === "hi") {
    return [
      "The user wrote in Hindi (or Devanagari). Reply entirely in clear Hindi (Devanagari script).",
      "Keep dashboard path labels in English when useful (e.g. Automatic Greetings, Activity, Contacts).",
      "Do not switch to English except for those path names and product feature labels.",
    ].join(" ");
  }

  if (language === "mr") {
    return [
      "The user wrote in Marathi. Reply entirely in clear Marathi (Devanagari script).",
      "Keep dashboard path labels in English when useful (e.g. Automatic Greetings, Activity, Contacts).",
      "Do not switch to English except for those path names and product feature labels.",
    ].join(" ");
  }

  return [
    "Reply in clear English unless the user clearly writes in another language.",
    "If they write in Hindi or Marathi, match that language.",
  ].join(" ");
}

export function curatedEmptyAnswer(language: HelpReplyLanguage): string {
  if (language === "hi") {
    return "इस सवाल का स्पष्ट जवाब मेरे पास अभी नहीं है। सुझाए गए सवाल आज़माएँ, या कॉन्टैक्ट्स, टेम्पलेट्स, ऑटोमेशन, SMS/WhatsApp, भूमिकाएँ या बिलिंग के बारे में पूछें। खाते से जुड़े मुद्दों के लिए Organization Owner या सपोर्ट से बात करें।";
  }
  if (language === "mr") {
    return "या प्रश्नाचे स्पष्ट उत्तर सध्या उपलब्ध नाही. सुचवलेले प्रश्न वापरा, किंवा संपर्क, टेम्पलेट, ऑटोमेशन, SMS/WhatsApp, भूमिका किंवा बिलिंगबद्दल विचारा. खात्याशी संबंधित समस्यांसाठी Organization Owner किंवा सपोर्टशी बोला.";
  }
  return "I don't have a specific answer for that yet. Try one of the suggested questions, or ask about contacts, templates, automations, SMS/WhatsApp setup, roles, or billing. For account-specific issues, contact your Organization Owner or support.";
}
