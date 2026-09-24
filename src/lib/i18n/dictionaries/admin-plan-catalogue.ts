import type { Locale } from "../constants";

export type AdminPlanCatalogueDict = {
  title: string;
  description: string;
  intro: (
    envVarStarter: string,
    envVarPro: string,
  ) => string;
  lastUpdated: string;
  by: (name: string) => string;
  razorpayPinnedWarning: (plan: string) => string;
  name: string;
  priceInr: string;
  description2: string;
  contactLimit: string;
  monthlyMessageLimit: string;
  saving: string;
  saveChanges: string;
  invalidNumbers: string;
  failedToSave: string;
  savedSuccess: string;
  confirmTitle: (plan: string) => string;
  confirmIntro: (plan: string) => string;
  price: string;
  confirmRazorpayPinnedNote: string;
};

const ADMIN_PLAN_CATALOGUE_DICT: Record<Locale, AdminPlanCatalogueDict> = {
  en: {
    title: "Plan catalogue",
    description:
      "Edit STARTER/PRO pricing and limits offered to new checkouts and signups.",
    intro: (envVarStarter, envVarPro) =>
      `Changes apply going forward only — clients already on STARTER or PRO keep their existing contact/message limits unchanged. A plan whose Razorpay price is pinned via ${envVarStarter}/${envVarPro} is flagged below — editing the amount there changes limits and display only, not what Razorpay actually charges.`,
    lastUpdated: "Last updated",
    by: (name) => `by ${name}`,
    razorpayPinnedWarning: (plan) =>
      `This plan's price is pinned to an existing Razorpay Plan (RAZORPAY_PLAN_${plan} is set on the server). Editing the price below will not change what Razorpay subscription checkouts actually charge — only the contact/message limits and display text update. To change the charged amount, update or unpin the Razorpay Plan itself.`,
    name: "Name",
    priceInr: "Price (INR)",
    description2: "Description",
    contactLimit: "Contact limit",
    monthlyMessageLimit: "Monthly message limit",
    saving: "Saving…",
    saveChanges: "Save changes",
    invalidNumbers:
      "Enter valid numbers for price, contact limit, and message limit.",
    failedToSave: "Failed to save changes",
    savedSuccess: "Saved. New checkouts and signups will use these values.",
    confirmTitle: (plan) => `Update ${plan} pricing?`,
    confirmIntro: (plan) =>
      `This takes effect immediately for new checkouts and signups. Clients already on ${plan} keep their current limits.`,
    price: "Price",
    confirmRazorpayPinnedNote:
      "This plan's Razorpay price is pinned, so the price change above will not affect what is actually charged.",
  },
  hi: {
    title: "प्लान कैटलॉग",
    description:
      "नए checkout और साइनअप के लिए दिए जाने वाले STARTER/PRO प्राइसिंग और सीमाएँ एडिट करें।",
    intro: (envVarStarter, envVarPro) =>
      `बदलाव सिर्फ आगे से लागू होते हैं — जो क्लायंट पहले से STARTER या PRO पर हैं, उनकी मौजूदा कॉन्टैक्ट/मेसेज सीमाएँ नहीं बदलतीं। जिस प्लान की Razorpay कीमत ${envVarStarter}/${envVarPro} से पिन की गई है, उसे नीचे दिखाया गया है — वहाँ राशि बदलने से सिर्फ सीमाएँ और डिस्प्ले टेक्स्ट बदलता है, Razorpay जो असल में चार्ज करता है वह नहीं।`,
    lastUpdated: "आख़िरी बार अपडेट",
    by: (name) => `${name} द्वारा`,
    razorpayPinnedWarning: (plan) =>
      `इस प्लान की कीमत मौजूदा Razorpay Plan से पिन की गई है (सर्वर पर RAZORPAY_PLAN_${plan} सेट है)। नीचे कीमत बदलने से Razorpay सब्सक्रिप्शन checkout में असल चार्ज नहीं बदलेगा — सिर्फ कॉन्टैक्ट/मेसेज सीमाएँ और डिस्प्ले टेक्स्ट अपडेट होंगे। चार्ज की जाने वाली राशि बदलने के लिए, Razorpay Plan को खुद अपडेट या अनपिन करें।`,
    name: "नाम",
    priceInr: "कीमत (INR)",
    description2: "विवरण",
    contactLimit: "कॉन्टैक्ट सीमा",
    monthlyMessageLimit: "मासिक मेसेज सीमा",
    saving: "सेव हो रहा है…",
    saveChanges: "बदलाव सेव करें",
    invalidNumbers: "कीमत, कॉन्टैक्ट सीमा, और मेसेज सीमा के लिए सही संख्याएँ भरें।",
    failedToSave: "बदलाव सेव नहीं हो सके",
    savedSuccess: "सेव हो गया। नए checkout और साइनअप में ये वैल्यू इस्तेमाल होंगी।",
    confirmTitle: (plan) => `${plan} प्राइसिंग अपडेट करें?`,
    confirmIntro: (plan) =>
      `यह नए checkout और साइनअप के लिए तुरंत लागू होगा। जो क्लायंट पहले से ${plan} पर हैं, उनकी मौजूदा सीमाएँ नहीं बदलेंगी।`,
    price: "कीमत",
    confirmRazorpayPinnedNote:
      "इस प्लान की Razorpay कीमत पिन की गई है, इसलिए ऊपर किया गया कीमत बदलाव असल चार्ज पर असर नहीं डालेगा।",
  },
  mr: {
    title: "प्लान कॅटलॉग",
    description:
      "नवीन चेकआउट आणि साइनअपसाठी दिले जाणारे STARTER/PRO प्राइसिंग आणि मर्यादा एडिट करा.",
    intro: (envVarStarter, envVarPro) =>
      `बदल फक्त पुढे लागू होतात — जे क्लायंट आधीच STARTER किंवा PRO वर आहेत, त्यांच्या सध्याच्या कॉन्टॅक्ट/मेसेज मर्यादा बदलत नाहीत. ज्या प्लानची Razorpay किंमत ${envVarStarter}/${envVarPro} ने पिन केलेली आहे, तो खाली दाखवला आहे — तिथे रक्कम बदलल्याने फक्त मर्यादा आणि डिस्प्ले टेक्स्ट बदलतो, Razorpay प्रत्यक्षात जे आकारते ते नाही.`,
    lastUpdated: "शेवटचे अपडेट",
    by: (name) => `${name} यांनी`,
    razorpayPinnedWarning: (plan) =>
      `या प्लानची किंमत सध्याच्या Razorpay Plan शी पिन केलेली आहे (सर्व्हरवर RAZORPAY_PLAN_${plan} सेट आहे). खाली किंमत बदलल्याने Razorpay सबस्क्रिप्शन चेकआउटमध्ये प्रत्यक्ष आकारणी बदलणार नाही — फक्त कॉन्टॅक्ट/मेसेज मर्यादा आणि डिस्प्ले टेक्स्ट अपडेट होतील. आकारली जाणारी रक्कम बदलण्यासाठी, Razorpay Plan स्वतः अपडेट किंवा अनपिन करा.`,
    name: "नाव",
    priceInr: "किंमत (INR)",
    description2: "वर्णन",
    contactLimit: "कॉन्टॅक्ट मर्यादा",
    monthlyMessageLimit: "मासिक मेसेज मर्यादा",
    saving: "सेव्ह होत आहे…",
    saveChanges: "बदल सेव्ह करा",
    invalidNumbers: "किंमत, कॉन्टॅक्ट मर्यादा, आणि मेसेज मर्यादेसाठी योग्य आकडे भरा.",
    failedToSave: "बदल सेव्ह होऊ शकले नाहीत",
    savedSuccess: "सेव्ह झाले. नवीन चेकआउट आणि साइनअपमध्ये या व्हॅल्यूज वापरल्या जातील.",
    confirmTitle: (plan) => `${plan} प्राइसिंग अपडेट करायचे का?`,
    confirmIntro: (plan) =>
      `हे नवीन चेकआउट आणि साइनअपसाठी लगेच लागू होईल. जे क्लायंट आधीच ${plan} वर आहेत, त्यांच्या सध्याच्या मर्यादा बदलणार नाहीत.`,
    price: "किंमत",
    confirmRazorpayPinnedNote:
      "या प्लानची Razorpay किंमत पिन केलेली आहे, त्यामुळे वरील किंमत बदल प्रत्यक्ष आकारणीवर परिणाम करणार नाही.",
  },
};

export function getAdminPlanCatalogueDict(locale: Locale): AdminPlanCatalogueDict {
  return ADMIN_PLAN_CATALOGUE_DICT[locale];
}
