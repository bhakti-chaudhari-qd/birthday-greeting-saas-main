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
  answer: string;
  answerHi: string;
  answerMr: string;
  hrefs?: Array<{ label: string; href: string }>;
};

export function getLocalizedHelpAnswer(
  article: HelpArticle,
  language: HelpReplyLanguage,
): string {
  if (language === "hi") {
    return article.answerHi;
  }
  if (language === "mr") {
    return article.answerMr;
  }
  return article.answer;
}

export const HELP_ARTICLES: readonly HelpArticle[] = [
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
    answer:
      "Start with three steps: (1) add or import contacts, (2) create a greeting under Send Messages, (3) review Today and Activity. Organization Owners can connect SMS/WhatsApp under Settings and use Automatic Greetings to schedule birthday or anniversary messages.",
    answerHi:
      "तीन कदमों से शुरू करें: (1) संपर्क जोड़ें या इंपोर्ट करें, (2) Send Messages से ग्रीटिंग बनाएँ, (3) Today और Activity देखें। Organization Owner Settings में SMS/WhatsApp जोड़कर Automatic Greetings सेट करें, ताकि जन्मदिन/वर्षगाँठ संदेश अपने आप जाएँ।",
    answerMr:
      "तीन पावलांपासून सुरू करा: (1) संपर्क जोडा किंवा इंपोर्ट करा, (2) Send Messages ने ग्रीटिंग तयार करा, (3) Today आणि Activity पाहा. Organization Owner ने Settings मध्ये SMS/WhatsApp जोडून Automatic Greetings सेट करावेत, जेणेकरून वाढदिवस/वर्धापनदिन संदेश आपोआप जातील.",
    hrefs: [
      { label: "Contacts", href: "/dashboard/contacts" },
      { label: "Send Messages", href: "/dashboard/messages/send" },
      { label: "Today", href: "/dashboard" },
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
    id: "manual-send",
    title: "How do I send a message manually?",
    suggest: false,
    keywords: [
      "send",
      "manual send",
      "send message",
      "broadcast",
      "campaign",
      "send messages",
    ],
    answer:
      "Owners open Send Messages, choose a template/channel, pick contacts or filters, and queue the send. Large audiences are batched. Your subscription must be ACTIVE, and SMS/WhatsApp must be configured for the channel you choose.",
    answerHi:
      "Owners Send Messages खोलकर टेम्पलेट/चैनल चुनें, संपर्क चुनें, और भेजने की कतार लगाएँ। बड़ी सूची बैच में जाती है। सब्सक्रिप्शन ACTIVE होना चाहिए, और चुने चैनल के लिए SMS/WhatsApp सेट होना चाहिए।",
    answerMr:
      "Owners Send Messages उघडून टेम्पलेट/चॅनेल निवडा, संपर्क निवडा आणि पाठवण्याची रांग लावा. मोठी यादी बॅचमध्ये जाते. सब्सक्रिप्शन ACTIVE असावे आणि निवडलेल्या चॅनेलसाठी SMS/WhatsApp सेट असावे.",
    hrefs: [{ label: "Send Messages", href: "/dashboard/messages/send" }],
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
    id: "automations",
    title: "How do birthday automations work?",
    suggest: true,
    keywords: [
      "automation",
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
    answer:
      "Owners configure Automatic Greetings (one place for birthday, anniversary, and custom occasions). Each contact group can have its own send time, message, and channels (SMS, WhatsApp, Email). Automatic greetings use India Standard Time (IST). Review today’s people on Today and all upcoming, submitted, or failed messages in Activity. Owners can catch up yesterday’s missed greetings from Today if automation was down.",
    answerHi:
      "Owners Automatic Greetings में सेटअप करते हैं (जन्मदिन, वर्षगाँठ और कस्टम अवसर एक ही जगह)। हर संपर्क श्रेणी का अपना भेजने का समय, संदेश और चैनल (SMS/WhatsApp/Email) हो सकता है। स्वचालित ग्रीटिंग India Standard Time (IST) पर चलती हैं। आज के लोग Today पर देखें; upcoming/submitted/failed Activity में देखें।",
    answerMr:
      "Owners Automatic Greetings मध्ये सेटअप करतात (वाढदिवस, वर्धापनदिन आणि कस्टम प्रसंग एकाच ठिकाणी). प्रत्येक संपर्क श्रेणीला स्वतःचा पाठवण्याचा वेळ, संदेश आणि चॅनेल (SMS/WhatsApp/Email) असू शकतो. स्वयंचलित ग्रीटिंग India Standard Time (IST) वापरतात. आजचे लोक Today वर पाहा; upcoming/submitted/failed Activity मध्ये पाहा.",
    hrefs: [
      {
        label: "Automatic Greetings",
        href: "/dashboard/settings/greeting-routes",
      },
      { label: "Today", href: "/dashboard" },
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
    answer:
      "Open Today on the dashboard to see who has a birthday, anniversary, or custom occasion today. From there you can confirm who should be greeted before or after automation runs.",
    answerHi:
      "डैशबोर्ड पर Today खोलकर देखें किसे आज जन्मदिन, वर्षगाँठ या कस्टम अवसर है। ऑटोमेशन से पहले या बाद में किसे बधाई देनी है, यहीं से जाँचें।",
    answerMr:
      "डॅशबोर्डवर Today उघडून पाहा की आज कोणाचा वाढदिवस, वर्धापनदिन किंवा कस्टम प्रसंग आहे. ऑटोमेशनपूर्वी किंवा नंतर कोणाला शुभेच्छा द्यायच्या ते इथून तपासा.",
    hrefs: [{ label: "Today", href: "/dashboard" }],
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
    id: "connect-sms",
    title: "How do I connect SMS?",
    suggest: false,
    keywords: [
      "connect sms",
      "sms settings",
      "sms provider",
      "dlt",
      "configure sms",
    ],
    answer:
      "Owners open Settings → Channels → SMS and enter provider details (including TEST for safe trials or Custom HTTP for your gateway). SMS credentials are encrypted at rest. Live Custom HTTP sending has extra safety checks (verified email, ACTIVE paid plan or platform approval).",
    answerHi:
      "Owners Settings → Channels → SMS खोलकर प्रोवाइडर विवरण भरें (सुरक्षित ट्रायल के लिए TEST, या अपने गेटवे के लिए Custom HTTP)। SMS क्रेडेंशियल एन्क्रिप्टेड रहते हैं। लाइव Custom HTTP में अतिरिक्त सुरक्षा जाँच होती है (verified email, ACTIVE पेड प्लान या प्लेटफ़ॉर्म अनुमति)।",
    answerMr:
      "Owners Settings → Channels → SMS उघडून प्रोव्हायडर तपशील भरा (सुरक्षित ट्रायलसाठी TEST, किंवा तुमच्या गेटवेसाठी Custom HTTP). SMS क्रेडेन्शियल एन्क्रिप्टेड राहतात. लाइव्ह Custom HTTP मध्ये अतिरिक्त सुरक्षा तपासणी असते (verified email, ACTIVE पेड प्लान किंवा प्लॅटफॉर्म परवानगी).",
    hrefs: [{ label: "Channels (SMS)", href: "/dashboard/settings/channels" }],
  },
  {
    id: "connect-whatsapp",
    title: "How do I connect WhatsApp?",
    suggest: false,
    keywords: [
      "connect whatsapp",
      "whatsapp settings",
      "wa",
      "configure whatsapp",
    ],
    answer:
      "Owners open Settings → Channels → WhatsApp and configure the provider (TEST or Custom HTTP). Like SMS, live Custom HTTP is gated for safety. After setup, use WhatsApp templates with Send Messages or Automatic Greetings.",
    answerHi:
      "Owners Settings → Channels → WhatsApp खोलकर प्रोवाइडर सेट करें (TEST या Custom HTTP)। SMS की तरह लाइव Custom HTTP सुरक्षा के लिए गेटेड है। सेटअप के बाद WhatsApp टेम्पलेट और Send Messages / Automatic Greetings से ग्रीटिंग भेजें।",
    answerMr:
      "Owners Settings → Channels → WhatsApp उघडून प्रोव्हायडर सेट करा (TEST किंवा Custom HTTP). SMS प्रमाणे लाइव्ह Custom HTTP सुरक्षेसाठी गेटेड आहे. सेटअपनंतर WhatsApp टेम्पलेट आणि Send Messages / Automatic Greetings ने ग्रीटिंग पाठवा.",
    hrefs: [
      {
        label: "Channels (WhatsApp)",
        href: "/dashboard/settings/channels?tab=whatsapp",
      },
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

export function getSuggestedHelpQuestions(
  limit = 6,
): SuggestedHelpQuestion[] {
  return HELP_ARTICLES.filter((article) => article.suggest)
    .slice(0, limit)
    .map((article) => ({ id: article.id, title: article.title }));
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
      return `Article ${index + 1}: ${article.title}\n${article.answer}${links}`;
    })
    .join("\n\n");
}
