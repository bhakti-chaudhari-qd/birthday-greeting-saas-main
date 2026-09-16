/**
 * Curated product help for the dashboard chatbot.
 * Keep answers short, accurate, and linked to real dashboard routes.
 * English is the source of truth; answerHi / answerMr cover Need help? offline replies.
 */

import type { HelpReplyLanguage } from "@/lib/help/language";

export type HelpArticle = {
  id: string;
  title: string;
  /** Shown as a suggested question chip when true. */
  suggest: boolean;
  keywords: string[];
  /** Short restatement of the question shown above the answer, e.g. "To create an automation:". */
  leadIn: string;
  leadInHi: string;
  leadInMr: string;
  answer: string;
  answerHi: string;
  answerMr: string;
  hrefs?: Array<{ label: string; href: string }>;
};

function withLeadIn(leadIn: string, answer: string): string {
  return `${leadIn}\n\n${answer}`;
}

export function getLocalizedHelpAnswer(
  article: HelpArticle,
  language: HelpReplyLanguage,
): string {
  if (language === "hi") {
    return withLeadIn(article.leadInHi, article.answerHi);
  }
  if (language === "mr") {
    return withLeadIn(article.leadInMr, article.answerMr);
  }
  return withLeadIn(article.leadIn, article.answer);
}

export const HELP_ARTICLES: readonly HelpArticle[] = [
  {
    id: "connect-email",
    title: "How do I configure Email sending?",
    suggest: true,
    keywords: [
      "email",
      "configure email",
      "connect email",
      "set up email",
      "email settings",
      "email setup",
      "email provider",
      "resend",
      "ईमेल",
      "ईमेल सेटिंग",
      "ईमेल सेटअप",
    ],
    leadIn: "To configure Email sending:",
    leadInHi: "Email भेजना कॉन्फ़िगर करने के लिए:",
    leadInMr: "Email पाठवणे कॉन्फिगर करण्यासाठी:",
    answer:
      "1. Open Settings → Channels → Email.\n2. Choose your provider (Resend) and enter the API key plus the From email address greetings should send from.\n3. Save - the key is encrypted and never shown again in full.\n4. Email is now selectable in Send Messages, and per category under Automatic Greetings.\nOwners only. Email must be configured before you can pick it as a channel.",
    answerHi:
      "1. Settings → Channels → Email खोलें।\n2. प्रोवाइडर चुनें (Resend) और API key के साथ From ईमेल पता भरें।\n3. Save करें - कुंजी एन्क्रिप्टेड रहती है, पूरी दोबारा नहीं दिखती।\n4. अब Email को Send Messages में, और Automatic Greetings में हर श्रेणी के लिए चुना जा सकता है।\nकेवल Owners। चैनल चुनने से पहले Email सेट होना चाहिए।",
    answerMr:
      "1. Settings → Channels → Email उघडा.\n2. प्रोव्हायडर निवडा (Resend) आणि API key सोबत From ईमेल पत्ता भरा.\n3. Save करा - की एन्क्रिप्टेड राहते, पूर्ण पुन्हा दिसत नाही.\n4. आता Email Send Messages मध्ये, आणि Automatic Greetings मध्ये प्रत्येक श्रेणीसाठी निवडता येते.\nफक्त Owners. चॅनेल निवडण्याआधी Email सेट असावे लागते.",
    hrefs: [
      { label: "Channels (Email)", href: "/dashboard/settings/channels?tab=email" },
    ],
  },
  {
    id: "connect-sms",
    title: "How do I configure SMS sending?",
    suggest: true,
    keywords: [
      "connect sms",
      "configure sms",
      "set up sms",
      "sms setup",
      "sms settings",
      "sms provider",
      "dlt",
    ],
    leadIn: "To configure SMS sending:",
    leadInHi: "SMS भेजना कॉन्फ़िगर करने के लिए:",
    leadInMr: "SMS पाठवणे कॉन्फिगर करण्यासाठी:",
    answer:
      "1. Open Settings → Channels → SMS.\n2. Pick TEST for a safe trial, or Custom HTTP for your real gateway.\n3. Enter your provider's credentials (URL, keys) - these are encrypted at rest.\n4. Save, then send a test message to confirm delivery.\nLive Custom HTTP sending needs a verified email plus an ACTIVE paid plan or platform approval, and SMS often needs a DLT-approved template id.",
    answerHi:
      "1. Settings → Channels → SMS खोलें।\n2. सुरक्षित ट्रायल के लिए TEST चुनें, या अपने असली गेटवे के लिए Custom HTTP।\n3. प्रोवाइडर विवरण (URL, keys) भरें - ये एन्क्रिप्टेड रहते हैं।\n4. Save करें, फिर एक टेस्ट संदेश भेजकर डिलीवरी जाँचें।\nलाइव Custom HTTP को verified email और ACTIVE पेड प्लान या प्लेटफ़ॉर्म अनुमति चाहिए; SMS को अक्सर DLT-approved टेम्पलेट id चाहिए।",
    answerMr:
      "1. Settings → Channels → SMS उघडा.\n2. सुरक्षित ट्रायलसाठी TEST निवडा, किंवा तुमच्या खऱ्या गेटवेसाठी Custom HTTP.\n3. प्रोव्हायडर तपशील (URL, keys) भरा - हे एन्क्रिप्टेड राहतात.\n4. Save करा, नंतर टेस्ट संदेश पाठवून डिलिव्हरी तपासा.\nलाइव्ह Custom HTTP ला verified email आणि ACTIVE पेड प्लान किंवा प्लॅटफॉर्म परवानगी हवी; SMS ला अनेकदा DLT-approved टेम्पलेट id लागतो.",
    hrefs: [{ label: "Channels (SMS)", href: "/dashboard/settings/channels" }],
  },
  {
    id: "connect-whatsapp",
    title: "How do I configure WhatsApp sending?",
    suggest: true,
    keywords: [
      "connect whatsapp",
      "configure whatsapp",
      "set up whatsapp",
      "whatsapp setup",
      "whatsapp settings",
      "wa",
    ],
    leadIn: "To configure WhatsApp sending:",
    leadInHi: "WhatsApp भेजना कॉन्फ़िगर करने के लिए:",
    leadInMr: "WhatsApp पाठवणे कॉन्फिगर करण्यासाठी:",
    answer:
      "1. Open Settings → Channels → WhatsApp.\n2. Pick TEST for a safe trial, or Custom HTTP for your real gateway.\n3. Enter your provider's credentials - encrypted at rest, same as SMS.\n4. Save, then use WhatsApp templates in Send Messages or Automatic Greetings.\nLive Custom HTTP sending is gated the same way as SMS (verified email plus ACTIVE paid plan or platform approval).",
    answerHi:
      "1. Settings → Channels → WhatsApp खोलें।\n2. सुरक्षित ट्रायल के लिए TEST चुनें, या असली गेटवे के लिए Custom HTTP।\n3. प्रोवाइडर विवरण भरें - SMS की तरह एन्क्रिप्टेड रहते हैं।\n4. Save करें, फिर Send Messages या Automatic Greetings में WhatsApp टेम्पलेट इस्तेमाल करें।\nलाइव Custom HTTP भी SMS जैसे गेटेड है (verified email और ACTIVE पेड प्लान या प्लेटफ़ॉर्म अनुमति)।",
    answerMr:
      "1. Settings → Channels → WhatsApp उघडा.\n2. सुरक्षित ट्रायलसाठी TEST निवडा, किंवा खऱ्या गेटवेसाठी Custom HTTP.\n3. प्रोव्हायडर तपशील भरा - SMS प्रमाणे एन्क्रिप्टेड राहतात.\n4. Save करा, नंतर Send Messages किंवा Automatic Greetings मध्ये WhatsApp टेम्पलेट वापरा.\nलाइव्ह Custom HTTP देखील SMS सारखे गेटेड आहे (verified email आणि ACTIVE पेड प्लान किंवा प्लॅटफॉर्म परवानगी).",
    hrefs: [
      {
        label: "Channels (WhatsApp)",
        href: "/dashboard/settings/channels?tab=whatsapp",
      },
    ],
  },
  {
    id: "automations",
    title: "How do I create an automation?",
    suggest: true,
    keywords: [
      "automation",
      "create automation",
      "set up automation",
      "automatic",
      "birthday",
      "anniversary",
      "schedule",
      "auto send",
      "cron",
      "greeting routes",
      "जन्मदिन",
      "वाढदिवस",
      "ऑटोमेशन",
      "स्वयं",
      "मार्ग",
    ],
    leadIn: "To create an automation:",
    leadInHi: "ऑटोमेशन बनाने के लिए:",
    leadInMr: "ऑटोमेशन तयार करण्यासाठी:",
    answer:
      "1. Open Settings → Automatic Greetings.\n2. Pick the occasion tab (Birthday, Anniversary, or Custom).\n3. Choose a contact category and turn on the channels you want (SMS, WhatsApp, Email), picking a template for each.\n4. Set the send time (IST) and save - the row goes Active once a valid template and time are set.\nOwners only. Check today's people on Home, and review upcoming/submitted/failed sends in Activity.",
    answerHi:
      "1. Settings → Automatic Greetings खोलें।\n2. अवसर टैब चुनें (Birthday, Anniversary, या Custom)।\n3. संपर्क श्रेणी चुनें और जो चैनल चाहिए (SMS, WhatsApp, Email) चालू करें, हर एक के लिए टेम्पलेट चुनें।\n4. भेजने का समय (IST) सेट करके Save करें - वैध टेम्पलेट और समय मिलते ही पंक्ति Active हो जाती है।\nकेवल Owners। आज के लोग Home पर देखें; upcoming/submitted/failed Activity में देखें।",
    answerMr:
      "1. Settings → Automatic Greetings उघडा.\n2. प्रसंग टॅब निवडा (Birthday, Anniversary, किंवा Custom).\n3. संपर्क श्रेणी निवडा आणि हवे असलेले चॅनेल (SMS, WhatsApp, Email) चालू करा, प्रत्येकासाठी टेम्पलेट निवडा.\n4. पाठवण्याची वेळ (IST) सेट करून Save करा - वैध टेम्पलेट आणि वेळ मिळताच पंक्ती Active होते.\nफक्त Owners. आजचे लोक Home वर पाहा; upcoming/submitted/failed Activity मध्ये पाहा.",
    hrefs: [
      {
        label: "Automatic Greetings",
        href: "/dashboard/settings/greeting-routes",
      },
      { label: "Home", href: "/dashboard" },
    ],
  },
  {
    id: "manual-send",
    title: "How do I send a message right now?",
    suggest: true,
    keywords: [
      "send",
      "manual send",
      "send message",
      "send now",
      "send right now",
      "right now",
      "broadcast",
      "campaign",
      "send messages",
    ],
    leadIn: "To send a message right now:",
    leadInHi: "अभी संदेश भेजने के लिए:",
    leadInMr: "आत्ताच संदेश पाठवण्यासाठी:",
    answer:
      "1. Open Send Messages.\n2. Choose a channel (SMS, WhatsApp, or Email) and pick or create a template.\n3. Select contacts individually, or by filter/category.\n4. Review the preview, then queue the send - large audiences go out in batches.\nOwners only. Your subscription must be ACTIVE and the channel must be configured first.",
    answerHi:
      "1. Send Messages खोलें।\n2. चैनल चुनें (SMS, WhatsApp, या Email) और टेम्पलेट चुनें या बनाएँ।\n3. संपर्क अलग-अलग, या फ़िल्टर/श्रेणी से चुनें।\n4. प्रीव्यू देखें, फिर भेजने की कतार लगाएँ - बड़ी सूची बैच में जाती है।\nकेवल Owners। सब्सक्रिप्शन ACTIVE और चैनल पहले से सेट होना चाहिए।",
    answerMr:
      "1. Send Messages उघडा.\n2. चॅनेल निवडा (SMS, WhatsApp, किंवा Email) आणि टेम्पलेट निवडा किंवा तयार करा.\n3. संपर्क वेगवेगळे, किंवा फिल्टर/श्रेणीने निवडा.\n4. प्रीव्ह्यू पाहा, नंतर पाठवण्याची रांग लावा - मोठी यादी बॅचमध्ये जाते.\nफक्त Owners. सब्सक्रिप्शन ACTIVE आणि चॅनेल आधीच सेट असावे.",
    hrefs: [{ label: "Send Messages", href: "/dashboard/messages/send" }],
  },
  {
    id: "get-started",
    title: "How do I get started?",
    suggest: true,
    keywords: [
      "start",
      "started",
      "onboarding",
      "begin",
      "setup",
      "first",
      "getting started",
      "शुरू",
      "कैसे शुरू",
      "कसे सुरू",
      "सुरुवात",
      "सेटअप",
    ],
    leadIn: "To get started:",
    leadInHi: "शुरू करने के लिए:",
    leadInMr: "सुरुवात करण्यासाठी:",
    answer:
      "Start with three steps: (1) add or import contacts, (2) create a greeting under Send Messages, (3) review Home and Activity. Organization Owners can connect SMS/WhatsApp under Settings and use Automatic Greetings to schedule birthday or anniversary messages.",
    answerHi:
      "तीन कदमों से शुरू करें: (1) संपर्क जोड़ें या इंपोर्ट करें, (2) Send Messages से ग्रीटिंग बनाएँ, (3) Home और Activity देखें। Organization Owner Settings में SMS/WhatsApp जोड़कर Automatic Greetings सेट करें, ताकि जन्मदिन/वर्षगाँठ संदेश अपने आप जाएँ।",
    answerMr:
      "तीन पावलांपासून सुरू करा: (1) संपर्क जोडा किंवा इंपोर्ट करा, (2) Send Messages ने ग्रीटिंग तयार करा, (3) Home आणि Activity पाहा. Organization Owner ने Settings मध्ये SMS/WhatsApp जोडून Automatic Greetings सेट करावेत, जेणेकरून वाढदिवस/वर्धापनदिन संदेश आपोआप जातील.",
    hrefs: [
      { label: "Contacts", href: "/dashboard/contacts" },
      { label: "Send Messages", href: "/dashboard/messages/send" },
      { label: "Home", href: "/dashboard" },
    ],
  },
  {
    id: "add-contacts",
    title: "How do I add contacts?",
    suggest: true,
    keywords: [
      "add contact",
      "contacts",
      "create contact",
      "new contact",
      "people",
      "संपर्क",
      "कॉन्टैक्ट",
      "कॉन्टॅक्ट",
      "जोड़ें",
      "जोडा",
    ],
    leadIn: "To add contacts:",
    leadInHi: "संपर्क जोड़ने के लिए:",
    leadInMr: "संपर्क जोडण्यासाठी:",
    answer:
      "Open Contacts to add people one by one or import many from CSV/Excel. Each contact can have a birthday, anniversary, phone number, and category. Your plan's contact limit applies, so free and paid plans allow different totals.",
    answerHi:
      "Contacts खोलकर एक-एक करके लोग जोड़ें, या CSV/Excel से कई इंपोर्ट करें। हर संपर्क पर जन्मदिन, वर्षगाँठ, फ़ोन नंबर और श्रेणी हो सकती है। आपके प्लान की संपर्क सीमा लागू होती है-फ्री और पेड प्लान में अलग कुल सीमा होती है।",
    answerMr:
      "Contacts उघडून एक-एक करून लोक जोडा, किंवा CSV/Excel मधून अनेक इंपोर्ट करा. प्रत्येक संपर्कावर वाढदिवस, वर्धापनदिन, फोन नंबर आणि श्रेणी असू शकते. तुमच्या प्लानची संपर्क मर्यादा लागू होते-फ्री आणि पेड प्लानमध्ये वेगवेगळी एकूण मर्यादा असते.",
    hrefs: [{ label: "Open contacts", href: "/dashboard/contacts" }],
  },
  {
    id: "import-contacts",
    title: "How do I import contacts from CSV or Excel?",
    suggest: false,
    keywords: [
      "import",
      "csv",
      "excel",
      "xlsx",
      "upload",
      "bulk",
      "spreadsheet",
    ],
    leadIn: "To import contacts from CSV or Excel:",
    leadInHi: "CSV या Excel से संपर्क इंपोर्ट करने के लिए:",
    leadInMr: "CSV किंवा Excel मधून संपर्क इंपोर्ट करण्यासाठी:",
    answer:
      "On the Contacts page, use import to upload a CSV or Excel file. Make sure columns for name, phone, and dates are filled correctly. If a mobile number already exists, that contact is updated. Duplicate rows inside the same file are skipped. Invalid rows are reported so you can fix them and re-import. Export is available to Owners for backups.",
    answerHi:
      "Contacts पेज पर import से CSV या Excel फ़ाइल अपलोड करें। नाम, फ़ोन और तारीख कॉलम सही भरें। अगर मोबाइल पहले से है तो संपर्क अपडेट होता है। एक ही फ़ाइल में डुप्लिकेट पंक्तियाँ छोड़ दी जाती हैं। गलत पंक्तियाँ रिपोर्ट होती हैं-ठीक करके फिर इंपोर्ट करें। बैकअप के लिए Export केवल Owners के लिए उपलब्ध है।",
    answerMr:
      "Contacts पेजवर import ने CSV किंवा Excel फाइल अपलोड करा. नाव, फोन आणि तारीख कॉलम बरोबर भरा. मोबाइल आधीच असेल तर संपर्क अपडेट होतो. त्याच फाइलमधील डुप्लिकेट ओळी वगळल्या जातात. चुकीच्या ओळी रिपोर्ट होतात-दुरुस्त करून पुन्हा इंपोर्ट करा. बॅकअपसाठी Export फक्त Owners साठी उपलब्ध आहे.",
    hrefs: [{ label: "Open contacts", href: "/dashboard/contacts" }],
  },
  {
    id: "owner-vs-staff",
    title: "What's the difference between Owner and Staff?",
    suggest: true,
    keywords: [
      "owner",
      "staff",
      "role",
      "permission",
      "admin",
      "access",
      "rbac",
      "who can",
    ],
    leadIn: "Owner vs Staff:",
    leadInHi: "Owner बनाम Staff:",
    leadInMr: "Owner विरुद्ध Staff:",
    answer:
      "Owners (Organization Admins) can send messages, configure SMS/WhatsApp, manage automations, create/edit templates, export contacts, and manage billing. Staff can manage contacts, view templates, and see the queue and delivery history - but they cannot send, change channel settings, or open billing.",
    answerHi:
      "Owners (Organization Admins) संदेश भेज सकते हैं, SMS/WhatsApp सेट कर सकते हैं, ऑटोमेशन चला सकते हैं, टेम्पलेट बना/बदल सकते हैं, संपर्क एक्सपोर्ट और बिलिंग देख सकते हैं। Staff संपर्क संभाल सकते हैं, टेम्पलेट देख सकते हैं, कतार और डिलीवरी इतिहास देख सकते हैं-लेकिन भेज नहीं सकते, चैनल सेटिंग नहीं बदल सकते, बिलिंग नहीं खोल सकते।",
    answerMr:
      "Owners (Organization Admins) संदेश पाठवू शकतात, SMS/WhatsApp सेट करू शकतात, ऑटोमेशन चालवू शकतात, टेम्पलेट तयार/बदलू शकतात, संपर्क एक्सपोर्ट आणि बिलिंग पाहू शकतात. Staff संपर्क हाताळू शकतात, टेम्पलेट पाहू शकतात, रांग आणि डिलिव्हरी इतिहास पाहू शकतात-पण पाठवू शकत नाहीत, चॅनेल सेटिंग बदलू शकत नाहीत, बिलिंग उघडू शकत नाहीत.",
    hrefs: [{ label: "Dashboard home", href: "/dashboard" }],
  },
  {
    id: "missing-menu",
    title: "Why don't I see Billing or Send Message?",
    suggest: false,
    keywords: [
      "missing",
      "cannot see",
      "don't see",
      "dont see",
      "no billing",
      "no send",
      "menu",
      "sidebar",
      "hidden",
    ],
    leadIn: "Why Billing or Send Message might be missing:",
    leadInHi: "Billing या Send Message क्यों नहीं दिख रहा:",
    leadInMr: "Billing किंवा Send Message का दिसत नाही:",
    answer:
      "Those pages are Owner-only. If you are signed in as Staff, Billing, Send Messages, channel settings, and Automatic Greetings are hidden on purpose. Ask an Owner on your team to help, or have them change your role.",
    answerHi:
      "ये पेज केवल Owner के लिए हैं। अगर आप Staff हैं, तो Billing, Send Messages, चैनल सेटिंग और Automatic Greetings जानबूझकर छिपे रहते हैं। टीम के Owner से मदद माँगें, या भूमिका बदलवाएँ।",
    answerMr:
      "ही पेज फक्त Owner साठी आहेत. तुम्ही Staff असाल तर Billing, Send Messages, चॅनेल सेटिंग आणि Automatic Greetings मुद्दाम लपवलेली असतात. टीमच्या Owner कडून मदत घ्या, किंवा भूमिका बदलून घ्या.",
  },
  {
    id: "templates",
    title: "How do I create a greeting template?",
    suggest: false,
    keywords: [
      "template",
      "message template",
      "create template",
      "draft",
      "{{name}}",
      "placeholder",
      "टेम्पलेट",
      "संदेश",
      "मेसेज",
    ],
    leadIn: "To create a greeting template:",
    leadInHi: "ग्रीटिंग टेम्पलेट बनाने के लिए:",
    leadInMr: "ग्रीटिंग टेम्पलेट तयार करण्यासाठी:",
    answer:
      "Open Send Messages and create or pick a saved message for Email or WhatsApp. For SMS, use provider-approved templates via Advanced SMS Setup under Channels. Use {{name}} so each recipient gets their own name.",
    answerHi:
      "Send Messages खोलें और Email/WhatsApp के लिए संदेश बनाएँ या चुनें। SMS के लिए Channels में Advanced SMS Setup से प्रोवाइडर-approved टेम्पलेट इस्तेमाल करें। {{name}} इस्तेमाल करें ताकि हर प्राप्तकर्ता का नाम आए।",
    answerMr:
      "Send Messages उघडा आणि Email/WhatsApp साठी संदेश तयार करा किंवा निवडा. SMS साठी Channels मधील Advanced SMS Setup ने प्रोव्हायडर-approved टेम्पलेट वापरा. {{name}} वापरा जेणेकरून प्रत्येक प्राप्तकर्त्याचे नाव येईल.",
    hrefs: [
      { label: "Send Messages", href: "/dashboard/messages/send" },
      { label: "Channels", href: "/dashboard/settings/channels" },
    ],
  },
  {
    id: "sms-vs-whatsapp",
    title: "What's the difference between SMS and WhatsApp sending?",
    suggest: false,
    keywords: [
      "sms",
      "whatsapp",
      "channel",
      "difference",
      "compare",
      "which channel",
    ],
    leadIn: "SMS vs WhatsApp:",
    leadInHi: "SMS बनाम WhatsApp:",
    leadInMr: "SMS विरुद्ध WhatsApp:",
    answer:
      "SMS is short text (often length-sensitive and may need a DLT template id). WhatsApp supports richer greetings and optional media when your provider allows it. Both are configured under Settings → Channels. You pick the channel when creating templates, sending manually, or enabling automations.",
    answerHi:
      "SMS छोटा टेक्स्ट है (लंबाई मायने रखती है; DLT टेम्पलेट id लग सकता है)। WhatsApp समृद्ध ग्रीटिंग और (प्रोवाइडर अनुमति दे तो) मीडिया सपोर्ट करता है। दोनों Settings → Channels में सेट होते हैं। टेम्पलेट, मैन्युअल सेंड या ऑटोमेशन में चैनल चुनें।",
    answerMr:
      "SMS छोटा मजकूर आहे (लांबी महत्त्वाची; DLT टेम्पलेट id लागू शकतो). WhatsApp समृद्ध ग्रीटिंग आणि (प्रोव्हायडर परवानगी देत असल्यास) मीडिया सपोर्ट करते. दोन्ही Settings → Channels मध्ये सेट होतात. टेम्पलेट, मॅन्युअल सेंड किंवा ऑटोमेशनमध्ये चॅनेल निवडा.",
    hrefs: [
      { label: "Channels", href: "/dashboard/settings/channels" },
    ],
  },
  {
    id: "occasions",
    title: "Where do I see today's occasions?",
    suggest: false,
    keywords: [
      "occasions",
      "today",
      "birthday today",
      "who to greet",
      "upcoming",
    ],
    leadIn: "To see today's occasions:",
    leadInHi: "आज के अवसर देखने के लिए:",
    leadInMr: "आजचे प्रसंग पाहण्यासाठी:",
    answer:
      "Open Home on the dashboard to see who has a birthday, anniversary, or custom occasion today. From there you can confirm who should be greeted before or after automation runs.",
    answerHi:
      "डैशबोर्ड पर Home खोलकर देखें किसे आज जन्मदिन, वर्षगाँठ या कस्टम अवसर है। ऑटोमेशन से पहले या बाद में किसे बधाई देनी है, यहीं से जाँचें।",
    answerMr:
      "डॅशबोर्डवर Home उघडून पाहा की आज कोणाचा वाढदिवस, वर्धापनदिन किंवा कस्टम प्रसंग आहे. ऑटोमेशनपूर्वी किंवा नंतर कोणाला शुभेच्छा द्यायच्या ते इथून तपासा.",
    hrefs: [{ label: "Home", href: "/dashboard" }],
  },
  {
    id: "queue-history",
    title: "Where can I check scheduled and sent messages?",
    suggest: false,
    keywords: [
      "queue",
      "scheduled",
      "pending",
      "sent",
      "history",
      "deliveries",
      "status",
      "failed",
    ],
    leadIn: "To check scheduled and sent messages:",
    leadInHi: "शेड्यूल्ड और भेजे गए संदेश देखने के लिए:",
    leadInMr: "शेड्युल्ड आणि पाठवलेले संदेश तपासण्यासाठी:",
    answer:
      "Activity → Upcoming lists people due on the selected date for automatic greetings, including Scheduled before the send time. After queueing you also see Pending / Sending. Activity → Submitted shows messages the provider accepted for that greeting day - that is not the same as delivered to the phone. Use the Date filter to review other days. Failed items may be retryable by Owners depending on status and plan gates.",
    answerHi:
      "Activity → Upcoming में चुनी गई तिथि के स्वचालित ग्रीटिंग वाले लोग दिखते हैं, भेजने के समय से पहले Scheduled सहित। कतार में आने के बाद Pending / Sending भी दिखता है। Activity → Submitted में उस दिन प्रोवाइडर द्वारा स्वीकार किए गए संदेश दिखते हैं - यह फ़ोन पर डिलीवर होने की पुष्टि नहीं है। अन्य दिन देखने के लिए Date फ़िल्टर इस्तेमाल करें। असफल आइटम स्थिति और प्लान के अनुसार Owners दोबारा कोशिश कर सकते हैं।",
    answerMr:
      "Activity → Upcoming मध्ये निवडलेल्या दिवसासाठी स्वयंचलित ग्रीटिंगचे लोक दिसतात, पाठवण्याच्या वेळेपूर्वी Scheduled सह. रांगेत आल्यानंतर Pending / Sendingही दिसते. Activity → Submitted मध्ये त्या ग्रीटिंग दिवसासाठी प्रोव्हायडरने स्वीकारलेले संदेश दिसतात - हे फोनवर डिलिव्हर झाल्याची खात्री नाही. इतर दिवस पाहण्यासाठी Date फिल्टर वापरा. अयशस्वी आयटम स्थिती आणि प्लाननुसार Owners पुन्हा प्रयत्न करू शकतात.",
    hrefs: [
      { label: "Upcoming", href: "/dashboard/activity?tab=upcoming" },
      { label: "Submitted", href: "/dashboard/activity?tab=sent" },
    ],
  },
  {
    id: "cannot-send",
    title: "Why can't I send messages?",
    suggest: true,
    keywords: [
      "can't send",
      "cannot send",
      "unable to send",
      "blocked",
      "not sending",
      "send failed",
      "forbidden send",
      "संदेश नहीं",
      "पाठवता येत नाही",
      "भेज नहीं",
    ],
    leadIn: "Why you can't send messages:",
    leadInHi: "संदेश क्यों नहीं भेज पा रहे:",
    leadInMr: "संदेश का पाठवता येत नाही:",
    answer:
      "Common reasons: (1) you are Staff - only Owners can send, (2) subscription is not ACTIVE (unpaid/cancelled blocks send), (3) SMS/WhatsApp is not configured for that channel, (4) live Custom HTTP needs a verified email plus a paid ACTIVE plan or platform approval, (5) the queue worker is not draining pending items. Check Billing, channel settings, and Scheduled activity.",
    answerHi:
      "आम कारण: (1) आप Staff हैं-केवल Owners भेज सकते हैं, (2) सब्सक्रिप्शन ACTIVE नहीं (अवैतनिक/रद्द भेजना रोकता है), (3) उस चैनल के लिए SMS/WhatsApp सेट नहीं, (4) लाइव Custom HTTP को verified email और ACTIVE पेड प्लान या प्लेटफ़ॉर्म अनुमति चाहिए, (5) कतार वर्कर पेंडिंग आइटम नहीं भेज रहा। Billing, चैनल सेटिंग और Scheduled जाँचें।",
    answerMr:
      "सामान्य कारणे: (1) तुम्ही Staff आहात-फक्त Owners पाठवू शकतात, (2) सब्सक्रिप्शन ACTIVE नाही (न भरलेले/रद्द पाठवणे थांबवते), (3) त्या चॅनेलसाठी SMS/WhatsApp सेट नाही, (4) लाइव्ह Custom HTTP ला verified email आणि ACTIVE पेड प्लान किंवा प्लॅटफॉर्म परवानगी हवी, (5) रांगेचा वर्कर पेंडिंग आयटम पाठवत नाही. Billing, चॅनेल सेटिंग आणि Scheduled तपासा.",
    hrefs: [
      { label: "Billing", href: "/dashboard/settings/billing" },
      { label: "Send Messages", href: "/dashboard/messages/send" },
      { label: "Upcoming", href: "/dashboard/activity?tab=upcoming" },
    ],
  },
  {
    id: "billing-plans",
    title: "How do plans and contact limits work?",
    suggest: true,
    keywords: [
      "plan",
      "plans",
      "billing",
      "limit",
      "contact limit",
      "free",
      "starter",
      "pro",
      "upgrade",
      "razorpay",
      "subscription",
    ],
    leadIn: "How plans and contact limits work:",
    leadInHi: "प्लान और संपर्क सीमा कैसे काम करती है:",
    leadInMr: "प्लान आणि संपर्क मर्यादा कशी काम करते:",
    answer:
      "Organizations use FREE, STARTER, PRO, or CUSTOM plans. Each plan has a contact limit. Billing is under Settings → Billing (Owners only). Upgrades use Razorpay when keys are configured. If the subscription is not ACTIVE, generating and sending messages is blocked until billing is fixed.",
    answerHi:
      "संगठन FREE, STARTER, PRO या CUSTOM प्लान इस्तेमाल करते हैं। हर प्लान की संपर्क सीमा होती है। बिलिंग Settings → Billing में है (केवल Owners)। अपग्रेड Razorpay से होता है जब कुंजियाँ सेट हों। सब्सक्रिप्शन ACTIVE न हो तो संदेश बनाना/भेजना बिलिंग ठीक होने तक रुक जाता है।",
    answerMr:
      "संस्था FREE, STARTER, PRO किंवा CUSTOM प्लान वापरतात. प्रत्येक प्लानला संपर्क मर्यादा असते. बिलिंग Settings → Billing मध्ये आहे (फक्त Owners). अपग्रेड Razorpay ने होते जेव्हा कळा सेट असतात. सब्सक्रिप्शन ACTIVE नसेल तर संदेश तयार/पाठवणे बिलिंग दुरुस्त होईपर्यंत थांबते.",
    hrefs: [{ label: "Billing", href: "/dashboard/settings/billing" }],
  },
  {
    id: "upgrade",
    title: "How do I upgrade my plan?",
    suggest: false,
    keywords: ["upgrade", "pay", "checkout", "razorpay", "buy", "paid"],
    leadIn: "To upgrade your plan:",
    leadInHi: "प्लान अपग्रेड करने के लिए:",
    leadInMr: "प्लान अपग्रेड करण्यासाठी:",
    answer:
      "Owners open Settings → Billing and choose STARTER or PRO. Checkout runs through Razorpay. After payment confirms (and the webhook applies the plan), your contact limits update and send features unlock for ACTIVE subscriptions. CUSTOM plans are set by Platform Admin, not self-serve checkout.",
    answerHi:
      "Owners Settings → Billing खोलकर STARTER या PRO चुनें। Checkout Razorpay से होता है। भुगतान पुष्टि और webhook प्लान लागू करने के बाद संपर्क सीमा अपडेट होती है और ACTIVE सब्सक्रिप्शन पर सेंड खुलता है। CUSTOM प्लान Platform Admin सेट करता है, स्वयं-सेवा checkout नहीं।",
    answerMr:
      "Owners Settings → Billing उघडून STARTER किंवा PRO निवडा. Checkout Razorpay ने होते. पेमेंट पुष्टी आणि webhook प्लान लागू केल्यानंतर संपर्क मर्यादा अपडेट होते आणि ACTIVE सब्सक्रिप्शनवर सेंड उघडते. CUSTOM प्लान Platform Admin सेट करतो; स्वयं-सेवा checkout नाही.",
    hrefs: [{ label: "Billing", href: "/dashboard/settings/billing" }],
  },
  {
    id: "staff-send",
    title: "Can Staff send messages?",
    suggest: false,
    keywords: ["staff send", "can staff", "staff permission", "staff role"],
    leadIn: "Whether Staff can send messages:",
    leadInHi: "क्या Staff संदेश भेज सकता है:",
    leadInMr: "Staff संदेश पाठवू शकतो का:",
    answer:
      "No. Staff can manage contacts and view templates, queue, and deliveries. Only Owners can manually send, change channel or Automatic Greetings settings, export contacts, edit templates, and manage billing.",
    answerHi:
      "नहीं। Staff संपर्क संभाल सकते हैं और टेम्पलेट, कतार व डिलीवरी देख सकते हैं। केवल Owners मैन्युअल भेज सकते हैं, चैनल/Automatic Greetings सेटिंग बदल सकते हैं, संपर्क एक्सपोर्ट, टेम्पलेट संपादन और बिलिंग कर सकते हैं।",
    answerMr:
      "नाही. Staff संपर्क हाताळू शकतात आणि टेम्पलेट, रांग व डिलिव्हरी पाहू शकतात. फक्त Owners मॅन्युअल पाठवू शकतात, चॅनेल/Automatic Greetings सेटिंग बदलू शकतात, संपर्क एक्सपोर्ट, टेम्पलेट संपादन आणि बिलिंग करू शकतात.",
  },
];

export type SuggestedHelpQuestion = {
  id: string;
  title: string;
};

/** Localized chip label for a suggested question - the lead-in read as a short title, e.g. "To create an automation" -> "Create an automation". */
function suggestedQuestionTitle(
  article: HelpArticle,
  language: HelpReplyLanguage,
): string {
  if (language === "en") {
    return article.title;
  }
  const leadIn = language === "hi" ? article.leadInHi : article.leadInMr;
  return leadIn.replace(/[:：]\s*$/, "");
}

export function getSuggestedHelpQuestions(
  limit = 6,
  language: HelpReplyLanguage = "en",
): SuggestedHelpQuestion[] {
  return HELP_ARTICLES.filter((article) => article.suggest)
    .slice(0, limit)
    .map((article) => ({
      id: article.id,
      title: suggestedQuestionTitle(article, language),
    }));
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Score articles for a free-text question (keyword / title overlap). */
export function retrieveHelpArticles(
  question: string,
  limit = 4,
): HelpArticle[] {
  const q = normalize(question);
  if (!q) {
    return [];
  }

  const scored = HELP_ARTICLES.map((article) => {
    let score = 0;
    const title = normalize(article.title);
    if (title === q) {
      score += 100;
    } else if (q.includes(title) || title.includes(q)) {
      score += 50;
    }

    // Prefer multi-word keyword hits over generic single words like "send".
    const keywordHits = article.keywords
      .map((keyword) => normalize(keyword))
      .filter(Boolean)
      .map((kw) => {
        if (q === kw) return 40;
        if (q.includes(kw)) return 18 + Math.min(kw.length, 16);
        return 0;
      })
      .filter((value) => value > 0)
      .sort((a, b) => b - a);

    score += keywordHits.slice(0, 3).reduce((sum, value) => sum + value, 0);

    for (const word of q.split(" ")) {
      if (word.length < 4) continue;
      if (title.includes(word)) {
        score += 2;
      }
    }

    return { article, score };
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((row) => row.article);
}

/**
 * When the user writes in Hindi/Marathi, keyword retrieval may miss.
 * Merge suggested articles so OpenAI still has product grounding.
 */
export function resolveHelpArticlesForChat(
  question: string,
  language: "en" | "hi" | "mr",
  limit = 4,
): HelpArticle[] {
  const retrieved = retrieveHelpArticles(question, limit);
  if (language === "en") {
    return retrieved;
  }

  const byId = new Map(retrieved.map((article) => [article.id, article]));
  for (const article of HELP_ARTICLES.filter((item) => item.suggest)) {
    if (byId.size >= 6) {
      break;
    }
    byId.set(article.id, article);
  }

  const getStarted = HELP_ARTICLES.find((article) => article.id === "get-started");
  if (getStarted) {
    byId.set(getStarted.id, getStarted);
  }

  return [...byId.values()].slice(0, 6);
}

export function formatArticlesForPrompt(articles: HelpArticle[]): string {
  if (articles.length === 0) {
    return "No matching articles.";
  }

  return articles
    .map((article, index) => {
      const links =
        article.hrefs && article.hrefs.length > 0
          ? `\nLinks: ${article.hrefs
              .map((link) => `${link.label} (${link.href})`)
              .join("; ")}`
          : "";
      return `Article ${index + 1}: ${article.title}\n${article.leadIn}\n\n${article.answer}${links}`;
    })
    .join("\n\n");
}
