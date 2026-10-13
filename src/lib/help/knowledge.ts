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
      "Email works without any setup: greetings go out through the platform's email service, and Settings → Channels → Email shows \"Using the platform email service\".\nTo send from your own address instead:\n1. Open Settings → Channels → Email.\n2. Enter your Resend API key and the From email address (on a domain verified in Resend).\n3. Save - the key is encrypted and never shown again in full.\nOwners only.",
    answerHi:
      "Email बिना किसी सेटअप के काम करता है: ग्रीटिंग प्लेटफ़ॉर्म की Email सेवा से जाती हैं, और Settings → Channels → Email पर \"Using the platform email service\" दिखता है।\nअपने पते से भेजने के लिए:\n1. Settings → Channels → Email खोलें।\n2. अपनी Resend API key और From ईमेल पता भरें (Resend में verified डोमेन का)।\n3. Save करें - कुंजी एन्क्रिप्टेड रहती है, पूरी दोबारा नहीं दिखती।\nकेवल Owners।",
    answerMr:
      "Email कोणत्याही सेटअपशिवाय चालते: ग्रीटिंग प्लॅटफॉर्मच्या Email सेवेतून जातात, आणि Settings → Channels → Email वर \"Using the platform email service\" दिसते.\nतुमच्या पत्त्यावरून पाठवण्यासाठी:\n1. Settings → Channels → Email उघडा.\n2. तुमची Resend API key आणि From ईमेल पत्ता भरा (Resend मध्ये verified डोमेनचा).\n3. Save करा - की एन्क्रिप्टेड राहते, पूर्ण पुन्हा दिसत नाही.\nफक्त Owners.",
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
      "If Settings → Channels → SMS shows \"Using the platform SMS service\", SMS already works and there is nothing to set up.\nTo use your own SMS gateway instead:\n1. Open Settings → Channels → SMS.\n2. Enter the details from your SMS provider: Base URL, send path, username, password, route and sender ID.\n3. Tick Active and Save, then use Verify Connection.\nYour own gateway needs an ACTIVE paid plan or platform approval. SMS templates usually need a DLT-approved template ID. Owners only.",
    answerHi:
      "अगर Settings → Channels → SMS पर \"Using the platform SMS service\" दिखता है, तो SMS पहले से चालू है और कुछ सेट करने की ज़रूरत नहीं।\nअपना SMS गेटवे इस्तेमाल करने के लिए:\n1. Settings → Channels → SMS खोलें।\n2. अपने SMS प्रोवाइडर के विवरण भरें: Base URL, send path, username, password, route और sender ID।\n3. Active टिक करके Save करें, फिर Verify Connection दबाएँ।\nअपने गेटवे के लिए ACTIVE पेड प्लान या प्लेटफ़ॉर्म की मंज़ूरी चाहिए। SMS टेम्पलेट को आमतौर पर DLT-approved टेम्पलेट ID चाहिए। केवल Owners।",
    answerMr:
      "Settings → Channels → SMS वर \"Using the platform SMS service\" दिसत असेल, तर SMS आधीच चालू आहे आणि काहीही सेट करण्याची गरज नाही.\nतुमचे स्वतःचे SMS गेटवे वापरण्यासाठी:\n1. Settings → Channels → SMS उघडा.\n2. तुमच्या SMS प्रोव्हायडरचे तपशील भरा: Base URL, send path, username, password, route आणि sender ID.\n3. Active टिक करून Save करा, नंतर Verify Connection दाबा.\nस्वतःच्या गेटवेसाठी ACTIVE पेड प्लान किंवा प्लॅटफॉर्मची मंजुरी लागते. SMS टेम्पलेटला सहसा DLT-approved टेम्पलेट ID लागतो. फक्त Owners.",
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
      "If Settings → Channels → WhatsApp shows \"Using the platform WhatsApp service\", WhatsApp already works with text-only approved templates.\nTo send from your own number:\n1. Open Settings → Channels → WhatsApp and choose a gateway.\n2. Meta Cloud API: enter the Phone number ID and a permanent access token from your Meta app. Koverage: enter your Vendor UID and API token. Custom HTTP: enter your provider's URL and credentials.\n3. Tick Active and Save.\n4. Under Settings → Manage Templates, create a WhatsApp template whose approved name and language exactly match a template approved on that WhatsApp account.\nYour own gateway needs an ACTIVE paid plan or platform approval. Owners only.",
    answerHi:
      "अगर Settings → Channels → WhatsApp पर \"Using the platform WhatsApp service\" दिखता है, तो WhatsApp पहले से केवल टेक्स्ट वाले approved टेम्पलेट के साथ चालू है।\nअपने नंबर से भेजने के लिए:\n1. Settings → Channels → WhatsApp खोलें और गेटवे चुनें।\n2. Meta Cloud API: अपने Meta app से Phone number ID और permanent access token भरें। Koverage: अपना Vendor UID और API token भरें। Custom HTTP: अपने प्रोवाइडर का URL और credentials भरें।\n3. Active टिक करके Save करें।\n4. Settings → Manage Templates में ऐसा WhatsApp टेम्पलेट बनाएँ जिसका approved नाम और भाषा उस WhatsApp अकाउंट पर approved टेम्पलेट से बिल्कुल मेल खाए।\nअपने गेटवे के लिए ACTIVE पेड प्लान या प्लेटफ़ॉर्म की मंज़ूरी चाहिए। केवल Owners।",
    answerMr:
      "Settings → Channels → WhatsApp वर \"Using the platform WhatsApp service\" दिसत असेल, तर WhatsApp आधीच फक्त टेक्स्ट असलेल्या approved टेम्पलेटसह चालू आहे.\nतुमच्या नंबरवरून पाठवण्यासाठी:\n1. Settings → Channels → WhatsApp उघडा आणि गेटवे निवडा.\n2. Meta Cloud API: तुमच्या Meta app मधून Phone number ID आणि permanent access token भरा. Koverage: तुमचा Vendor UID आणि API token भरा. Custom HTTP: तुमच्या प्रोव्हायडरचा URL आणि credentials भरा.\n3. Active टिक करून Save करा.\n4. Settings → Manage Templates मध्ये असा WhatsApp टेम्पलेट तयार करा ज्याचे approved नाव आणि भाषा त्या WhatsApp अकाउंटवरील approved टेम्पलेटशी अगदी जुळते.\nस्वतःच्या गेटवेसाठी ACTIVE पेड प्लान किंवा प्लॅटफॉर्मची मंजुरी लागते. फक्त Owners.",
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
      "1. Open Send Messages and stay on the Scheduled tab.\n2. Click + Create Automation.\n3. Pick the occasion (Birthday, Anniversary, or a custom one) and the contact categories.\n4. Turn on the channels you want (WhatsApp, Email, SMS) and pick a template for each.\n5. Set the send time (IST) and save - it then runs every day for contacts whose occasion falls on that day.\nThese are your Automatic Greetings. Owners only. Check today's people on Home, and the results in Activity.",
    answerHi:
      "1. Send Messages खोलें और Scheduled टैब पर रहें।\n2. + Create Automation पर क्लिक करें।\n3. अवसर (Birthday, Anniversary, या कोई कस्टम) और कॉन्टैक्ट श्रेणियाँ चुनें।\n4. जो चैनल चाहिए (WhatsApp, Email, SMS) चालू करें और हर एक के लिए टेम्पलेट चुनें।\n5. भेजने का समय (IST) सेट करके Save करें - फिर यह हर दिन उन कॉन्टैक्ट के लिए चलता है जिनका अवसर उस दिन है।\nयही आपके Automatic Greetings हैं। केवल Owners। आज के लोग Home पर और नतीजे Activity में देखें।",
    answerMr:
      "1. Send Messages उघडा आणि Scheduled टॅबवर राहा.\n2. + Create Automation वर क्लिक करा.\n3. प्रसंग (Birthday, Anniversary, किंवा कस्टम) आणि कॉन्टॅक्ट श्रेणी निवडा.\n4. हवे असलेले चॅनेल (WhatsApp, Email, SMS) चालू करा आणि प्रत्येकासाठी टेम्पलेट निवडा.\n5. पाठवण्याची वेळ (IST) सेट करून Save करा - नंतर हे दररोज त्या कॉन्टॅक्टसाठी चालते ज्यांचा प्रसंग (उदा. वाढदिवस) त्या दिवशी आहे.\nहेच तुमचे Automatic Greetings आहेत. फक्त Owners. आजचे लोक Home वर आणि निकाल Activity मध्ये पाहा.",
    hrefs: [
      { label: "Send Messages", href: "/dashboard/messages" },
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
    leadInHi: "अभी मेसेज भेजने के लिए:",
    leadInMr: "आत्ताच मेसेज पाठवण्यासाठी:",
    answer:
      "1. Open Send Messages and choose the Send Now tab.\n2. Pick recipients: Saved Contacts (tick them from the list), Categories, or a Quick List of pasted numbers.\n3. Choose the occasion, turn on a channel (WhatsApp, Email or SMS) and pick a template.\n4. Preview, then click Send Now.\nMessages are queued and sent in the background - open Activity to see whether each one was submitted, delivered or failed. Owners only.",
    answerHi:
      "1. Send Messages खोलें और Send Now टैब चुनें।\n2. प्राप्तकर्ता चुनें: Saved Contacts (सूची से टिक करें), Categories, या पेस्ट किए गए नंबरों की Quick List।\n3. अवसर चुनें, कोई चैनल (WhatsApp, Email या SMS) चालू करें और टेम्पलेट चुनें।\n4. प्रीव्यू देखें, फिर Send Now पर क्लिक करें।\nमेसेज कतार में जाकर बैकग्राउंड में भेजे जाते हैं - हर मेसेज submitted, delivered या failed हुआ, यह Activity में देखें। केवल Owners।",
    answerMr:
      "1. Send Messages उघडा आणि Send Now टॅब निवडा.\n2. प्राप्तकर्ते निवडा: Saved Contacts (यादीतून टिक करा), Categories, किंवा पेस्ट केलेल्या नंबरांची Quick List.\n3. प्रसंग निवडा, एखादे चॅनेल (WhatsApp, Email किंवा SMS) चालू करा आणि टेम्पलेट निवडा.\n4. प्रीव्ह्यू पाहा, नंतर Send Now वर क्लिक करा.\nमेसेज रांगेत जाऊन बॅकग्राउंडमध्ये पाठवले जातात - प्रत्येक मेसेज submitted, delivered की failed झाला ते Activity मध्ये पाहा. फक्त Owners.",
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
      "तीन कदमों से शुरू करें: (1) कॉन्टैक्ट जोड़ें या इंपोर्ट करें, (2) Send Messages से ग्रीटिंग बनाएँ, (3) Home और Activity देखें। Organization Owner Settings में SMS/WhatsApp जोड़कर Automatic Greetings सेट करें, ताकि जन्मदिन/वर्षगाँठ मेसेज अपने आप जाएँ।",
    answerMr:
      "तीन पावलांपासून सुरू करा: (1) कॉन्टॅक्ट जोडा किंवा इंपोर्ट करा, (2) Send Messages ने ग्रीटिंग तयार करा, (3) Home आणि Activity पाहा. Organization Owner ने Settings मध्ये SMS/WhatsApp जोडून Automatic Greetings सेट करावेत, जेणेकरून वाढदिवस/वर्धापनदिन मेसेज आपोआप जातील.",
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
    leadInHi: "कॉन्टैक्ट जोड़ने के लिए:",
    leadInMr: "कॉन्टॅक्ट जोडण्यासाठी:",
    answer:
      "Open Contacts to add people one by one or import many from CSV/Excel. Each contact can have a birthday, anniversary, phone number, and category. Your plan's contact limit applies, so free and paid plans allow different totals.",
    answerHi:
      "Contacts खोलकर एक-एक करके लोग जोड़ें, या CSV/Excel से कई इंपोर्ट करें। हर कॉन्टैक्ट पर जन्मदिन, वर्षगाँठ, फ़ोन नंबर और श्रेणी हो सकती है। आपके प्लान की कॉन्टैक्ट सीमा लागू होती है-फ्री और पेड प्लान में अलग कुल सीमा होती है।",
    answerMr:
      "Contacts उघडून एक-एक करून लोक जोडा, किंवा CSV/Excel मधून अनेक इंपोर्ट करा. प्रत्येक कॉन्टॅक्टवर वाढदिवस, वर्धापनदिन, फोन नंबर आणि श्रेणी असू शकते. तुमच्या प्लानची कॉन्टॅक्ट मर्यादा लागू होते-फ्री आणि पेड प्लानमध्ये वेगवेगळी एकूण मर्यादा असते.",
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
    leadInHi: "CSV या Excel से कॉन्टैक्ट इंपोर्ट करने के लिए:",
    leadInMr: "CSV किंवा Excel मधून कॉन्टॅक्ट इंपोर्ट करण्यासाठी:",
    answer:
      "On the Contacts page, use import to upload a CSV or Excel file. Make sure columns for name, phone, and dates are filled correctly. If a mobile number already exists, that contact is updated. Duplicate rows inside the same file are skipped. Invalid rows are reported so you can fix them and re-import. Export is available to Owners for backups.",
    answerHi:
      "Contacts पेज पर import से CSV या Excel फ़ाइल अपलोड करें। नाम, फ़ोन और तारीख कॉलम सही भरें। अगर मोबाइल पहले से है तो कॉन्टैक्ट अपडेट होता है। एक ही फ़ाइल में डुप्लिकेट पंक्तियाँ छोड़ दी जाती हैं। गलत पंक्तियाँ रिपोर्ट होती हैं-ठीक करके फिर इंपोर्ट करें। बैकअप के लिए Export केवल Owners के लिए उपलब्ध है।",
    answerMr:
      "Contacts पेजवर import ने CSV किंवा Excel फाइल अपलोड करा. नाव, फोन आणि तारीख कॉलम बरोबर भरा. मोबाइल आधीच असेल तर कॉन्टॅक्ट अपडेट होतो. त्याच फाइलमधील डुप्लिकेट ओळी वगळल्या जातात. चुकीच्या ओळी रिपोर्ट होतात-दुरुस्त करून पुन्हा इंपोर्ट करा. बॅकअपसाठी Export फक्त Owners साठी उपलब्ध आहे.",
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
      "Owners (Organization Admins) मेसेज भेज सकते हैं, SMS/WhatsApp सेट कर सकते हैं, ऑटोमेशन चला सकते हैं, टेम्पलेट बना/बदल सकते हैं, कॉन्टैक्ट एक्सपोर्ट और बिलिंग देख सकते हैं। Staff कॉन्टैक्ट संभाल सकते हैं, टेम्पलेट देख सकते हैं, कतार और डिलीवरी इतिहास देख सकते हैं-लेकिन भेज नहीं सकते, चैनल सेटिंग नहीं बदल सकते, बिलिंग नहीं खोल सकते।",
    answerMr:
      "Owners (Organization Admins) मेसेज पाठवू शकतात, SMS/WhatsApp सेट करू शकतात, ऑटोमेशन चालवू शकतात, टेम्पलेट तयार/बदलू शकतात, कॉन्टॅक्ट एक्सपोर्ट आणि बिलिंग पाहू शकतात. Staff कॉन्टॅक्ट हाताळू शकतात, टेम्पलेट पाहू शकतात, रांग आणि डिलिव्हरी इतिहास पाहू शकतात-पण पाठवू शकत नाहीत, चॅनेल सेटिंग बदलू शकत नाहीत, बिलिंग उघडू शकत नाहीत.",
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
      "Open Settings → Manage Templates and create a template for WhatsApp, Email or SMS. Use {{name}} so each recipient gets their own name. For WhatsApp, also enter the approved template name and language exactly as approved on your WhatsApp account. For SMS, enter the DLT-approved template ID and text from your provider.",
    answerHi:
      "Settings → Manage Templates खोलें और WhatsApp, Email या SMS के लिए टेम्पलेट बनाएँ। {{name}} इस्तेमाल करें ताकि हर प्राप्तकर्ता का नाम आए। WhatsApp के लिए approved टेम्पलेट नाम और भाषा ठीक वैसी भरें जैसी आपके WhatsApp अकाउंट पर approved है। SMS के लिए अपने प्रोवाइडर का DLT-approved टेम्पलेट ID और टेक्स्ट भरें।",
    answerMr:
      "Settings → Manage Templates उघडा आणि WhatsApp, Email किंवा SMS साठी टेम्पलेट तयार करा. {{name}} वापरा जेणेकरून प्रत्येक प्राप्तकर्त्याचे नाव येईल. WhatsApp साठी approved टेम्पलेटचे नाव आणि भाषा तुमच्या WhatsApp अकाउंटवर approved आहे तशीच भरा. SMS साठी तुमच्या प्रोव्हायडरचा DLT-approved टेम्पलेट ID आणि टेक्स्ट भरा.",
    hrefs: [
      { label: "Manage Templates", href: "/dashboard/templates" },
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
    leadInHi: "शेड्यूल्ड और भेजे गए मेसेज देखने के लिए:",
    leadInMr: "शेड्युल्ड आणि पाठवलेले मेसेज तपासण्यासाठी:",
    answer:
      "Open Activity. Each message shows its status: Pending (waiting to go out), Submitted (the provider accepted it), Delivered (confirmed on the phone, where the provider reports this), or Failed with the reason. Submitted is not the same as delivered. Use the date range and filters to review other days, and Export CSV to download the list. Owners can retry failed messages.",
    answerHi:
      "Activity खोलें। हर मेसेज की स्थिति दिखती है: Pending (भेजे जाने का इंतज़ार), Submitted (प्रोवाइडर ने स्वीकार किया), Delivered (फ़ोन पर पहुँचने की पुष्टि, जहाँ प्रोवाइडर यह बताता है), या कारण के साथ Failed। Submitted का मतलब delivered नहीं है। अन्य दिन देखने के लिए तारीख और फ़िल्टर इस्तेमाल करें, और सूची डाउनलोड करने के लिए Export CSV। Owners असफल मेसेज दोबारा भेज सकते हैं।",
    answerMr:
      "Activity उघडा. प्रत्येक मेसेजची स्थिती दिसते: Pending (पाठवण्याच्या प्रतीक्षेत), Submitted (प्रोव्हायडरने स्वीकारला), Delivered (फोनवर पोहोचल्याची खात्री, जिथे प्रोव्हायडर हे कळवतो), किंवा कारणासह Failed. Submitted म्हणजे delivered नाही. इतर दिवस पाहण्यासाठी तारीख आणि फिल्टर वापरा, आणि यादी डाउनलोड करण्यासाठी Export CSV. Owners अयशस्वी मेसेज पुन्हा पाठवू शकतात.",
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
    leadInHi: "मेसेज क्यों नहीं भेज पा रहे:",
    leadInMr: "मेसेज का पाठवता येत नाही:",
    answer:
      "Common reasons: (1) you are Staff - only Owners can send; (2) your subscription is not ACTIVE; (3) the channel is switched off or has no gateway - check Settings → Channels; (4) for WhatsApp, the template's approved name or language does not match a template approved on the WhatsApp account; (5) the monthly message limit is used up. If a message shows Failed in Activity, the reason is shown on that row. A WhatsApp message can also be accepted and then not delivered by WhatsApp, for example when the recipient has already received too many promotional messages.",
    answerHi:
      "आम कारण: (1) आप Staff हैं - केवल Owners भेज सकते हैं; (2) सब्सक्रिप्शन ACTIVE नहीं है; (3) चैनल बंद है या उसका कोई गेटवे नहीं - Settings → Channels जाँचें; (4) WhatsApp के लिए टेम्पलेट का approved नाम या भाषा WhatsApp अकाउंट पर approved टेम्पलेट से मेल नहीं खाती; (5) महीने की मेसेज सीमा पूरी हो गई। अगर Activity में मेसेज Failed दिखे, तो कारण उसी पंक्ति में दिखता है। WhatsApp मेसेज स्वीकार होने के बाद भी WhatsApp द्वारा डिलीवर न किया जा सकता है, जैसे जब प्राप्तकर्ता को पहले ही बहुत ज़्यादा प्रमोशनल मेसेज मिल चुके हों।",
    answerMr:
      "सामान्य कारणे: (1) तुम्ही Staff आहात - फक्त Owners पाठवू शकतात; (2) सब्सक्रिप्शन ACTIVE नाही; (3) चॅनेल बंद आहे किंवा त्याला गेटवे नाही - Settings → Channels तपासा; (4) WhatsApp साठी टेम्पलेटचे approved नाव किंवा भाषा WhatsApp अकाउंटवरील approved टेम्पलेटशी जुळत नाही; (5) महिन्याची मेसेज मर्यादा संपली आहे. Activity मध्ये मेसेज Failed दिसल्यास कारण त्याच ओळीत दिसते. WhatsApp मेसेज स्वीकारल्यानंतरही WhatsApp कडून डिलिव्हर न होऊ शकतो, उदा. प्राप्तकर्त्याला आधीच खूप प्रमोशनल मेसेज मिळाले असतील तर.",
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
    leadInHi: "प्लान और कॉन्टैक्ट सीमा कैसे काम करती है:",
    leadInMr: "प्लान आणि कॉन्टॅक्ट मर्यादा कशी काम करते:",
    answer:
      "Organizations use FREE, STARTER, PRO, or CUSTOM plans. Each plan has a contact limit. Billing is under Settings → Billing (Owners only). Upgrades use Razorpay when keys are configured. If the subscription is not ACTIVE, generating and sending messages is blocked until billing is fixed.",
    answerHi:
      "संगठन FREE, STARTER, PRO या CUSTOM प्लान इस्तेमाल करते हैं। हर प्लान की कॉन्टैक्ट सीमा होती है। बिलिंग Settings → Billing में है (केवल Owners)। अपग्रेड Razorpay से होता है जब कुंजियाँ सेट हों। सब्सक्रिप्शन ACTIVE न हो तो मेसेज बनाना/भेजना बिलिंग ठीक होने तक रुक जाता है।",
    answerMr:
      "संस्था FREE, STARTER, PRO किंवा CUSTOM प्लान वापरतात. प्रत्येक प्लानला कॉन्टॅक्ट मर्यादा असते. बिलिंग Settings → Billing मध्ये आहे (फक्त Owners). अपग्रेड Razorpay ने होते जेव्हा कळा सेट असतात. सब्सक्रिप्शन ACTIVE नसेल तर मेसेज तयार/पाठवणे बिलिंग दुरुस्त होईपर्यंत थांबते.",
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
      "Owners Settings → Billing खोलकर STARTER या PRO चुनें। Checkout Razorpay से होता है। भुगतान पुष्टि और webhook प्लान लागू करने के बाद कॉन्टैक्ट सीमा अपडेट होती है और ACTIVE सब्सक्रिप्शन पर सेंड खुलता है। CUSTOM प्लान Platform Admin सेट करता है, स्वयं-सेवा checkout नहीं।",
    answerMr:
      "Owners Settings → Billing उघडून STARTER किंवा PRO निवडा. Checkout Razorpay ने होते. पेमेंट पुष्टी आणि webhook प्लान लागू केल्यानंतर कॉन्टॅक्ट मर्यादा अपडेट होते आणि ACTIVE सब्सक्रिप्शनवर सेंड उघडते. CUSTOM प्लान Platform Admin सेट करतो; स्वयं-सेवा checkout नाही.",
    hrefs: [{ label: "Billing", href: "/dashboard/settings/billing" }],
  },
  {
    id: "staff-send",
    title: "Can Staff send messages?",
    suggest: false,
    keywords: ["staff send", "can staff", "staff permission", "staff role"],
    leadIn: "Whether Staff can send messages:",
    leadInHi: "क्या Staff मेसेज भेज सकता है:",
    leadInMr: "Staff मेसेज पाठवू शकतो का:",
    answer:
      "No. Staff can manage contacts and view templates, queue, and deliveries. Only Owners can manually send, change channel or Automatic Greetings settings, export contacts, edit templates, and manage billing.",
    answerHi:
      "नहीं। Staff कॉन्टैक्ट संभाल सकते हैं और टेम्पलेट, कतार व डिलीवरी देख सकते हैं। केवल Owners मैन्युअल भेज सकते हैं, चैनल/Automatic Greetings सेटिंग बदल सकते हैं, कॉन्टैक्ट एक्सपोर्ट, टेम्पलेट संपादन और बिलिंग कर सकते हैं।",
    answerMr:
      "नाही. Staff कॉन्टॅक्ट हाताळू शकतात आणि टेम्पलेट, रांग व डिलिव्हरी पाहू शकतात. फक्त Owners मॅन्युअल पाठवू शकतात, चॅनेल/Automatic Greetings सेटिंग बदलू शकतात, कॉन्टॅक्ट एक्सपोर्ट, टेम्पलेट संपादन आणि बिलिंग करू शकतात.",
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
