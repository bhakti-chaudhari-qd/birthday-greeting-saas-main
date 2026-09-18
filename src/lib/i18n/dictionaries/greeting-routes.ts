import type { Locale } from "../constants";

export type GreetingRoutesDict = {
  page: {
    title: string;
    istNote: string;
  };
  table: {
    occasionTabsAria: string;
    subtitle: string;
    loading: string;
    noCategories: string;
    save: string;
    saving: string;
    allCategoryName: string;
    activeAt: (time: string) => string;
    activeNotSet: string;
    notSending: string;
    allRowDescription: string;
    groupsDiffer: string;
    channels: { sms: string; whatsapp: string; email: string; call: string };
    chooseTemplate: string;
    allGroupsSuffix: string;
    callComingSoon: string;
    sendAt: string;
    notSetChooseTime: string;
    custom: string;
    clear: string;
    ist: string;
    setSendTimeAria: (name: string) => string;
    customSendTimeAria: (name: string) => string;
    sendHourAria: (name: string) => string;
    sendMinuteAria: (name: string) => string;
    amPmAria: (name: string) => string;
    clearSendTimeAria: (name: string) => string;
    enableChannelAria: (label: string, name: string) => string;
    channelTemplateAria: (label: string, name: string) => string;
  };
  messages: {
    failedToLoad: string;
    templateSelectedNotice: string;
    nothingToSave: string;
    failedToSave: string;
    allSaved: string;
  };
};

const GREETING_ROUTES_DICT: Record<Locale, GreetingRoutesDict> = {
  en: {
    page: {
      title: "Automatic greetings",
      istNote:
        "Automatic greetings use India Standard Time (IST). Send times below are IST wall-clock times.",
    },
    table: {
      occasionTabsAria: "Occasion",
      subtitle:
        "Switch occasions to edit their automatic greetings. One Save keeps all of them.",
      loading: "Loading categories…",
      noCategories: "No categories yet. Add categories on the Contacts page first.",
      save: "Save",
      saving: "Saving…",
      allCategoryName: "All",
      activeAt: (time) => `Active · ${time} IST`,
      activeNotSet: "Active · Not Set - Choose Time",
      notSending: "Not sending",
      allRowDescription: "Applies the same greeting to every group for this occasion.",
      groupsDiffer: " Groups currently differ - edit All to set them the same.",
      channels: { sms: "SMS", whatsapp: "WhatsApp", email: "Email", call: "Call" },
      chooseTemplate: "Choose a template…",
      allGroupsSuffix: "All groups",
      callComingSoon: "Delivery coming soon",
      sendAt: "Send at",
      notSetChooseTime: "Not set — choose time",
      custom: "Custom",
      clear: "Clear",
      ist: "IST",
      setSendTimeAria: (name) => `Set send time for ${name}`,
      customSendTimeAria: (name) => `Custom send time for ${name}`,
      sendHourAria: (name) => `Send hour for ${name}`,
      sendMinuteAria: (name) => `Send minute for ${name}`,
      amPmAria: (name) => `AM or PM for ${name}`,
      clearSendTimeAria: (name) => `Clear send time for ${name}`,
      enableChannelAria: (label, name) => `Enable ${label} for ${name}`,
      channelTemplateAria: (label, name) => `${label} template for ${name}`,
    },
    messages: {
      failedToLoad: "Failed to load category routes",
      templateSelectedNotice:
        "Your message is selected. Turn on the channel for the groups that should receive it, then Save.",
      nothingToSave: "Nothing to save yet. Wait for categories to load.",
      failedToSave: "Failed to save greeting routes",
      allSaved: "All automatic greetings saved.",
    },
  },
  hi: {
    page: {
      title: "ऑटोमेटिक ग्रीटिंग",
      istNote:
        "ऑटोमेटिक ग्रीटिंग India Standard Time (IST) पर चलती हैं। नीचे दिए भेजने के समय IST के हिसाब से हैं।",
    },
    table: {
      occasionTabsAria: "अवसर",
      subtitle:
        "अवसर बदलकर उनकी ऑटोमेटिक ग्रीटिंग एडिट करें। एक Save सभी को सेव कर देता है।",
      loading: "श्रेणियाँ लोड हो रही हैं…",
      noCategories: "अभी तक कोई श्रेणी नहीं। पहले Contacts पेज पर श्रेणियाँ जोड़ें।",
      save: "सेव करें",
      saving: "सेव हो रहा है…",
      allCategoryName: "सभी",
      activeAt: (time) => `एक्टिव · ${time} IST`,
      activeNotSet: "एक्टिव · समय सेट नहीं - समय चुनें",
      notSending: "नहीं भेजा जा रहा",
      allRowDescription: "इस अवसर के लिए सभी श्रेणियों को एक जैसी ग्रीटिंग भेजता है।",
      groupsDiffer: " श्रेणियाँ फ़िलहाल अलग-अलग हैं - सभी को एक जैसा करने के लिए All एडिट करें।",
      channels: { sms: "SMS", whatsapp: "WhatsApp", email: "Email", call: "कॉल" },
      chooseTemplate: "टेम्पलेट चुनें…",
      allGroupsSuffix: "सभी श्रेणियाँ",
      callComingSoon: "डिलीवरी जल्द आ रही है",
      sendAt: "इस समय भेजें",
      notSetChooseTime: "सेट नहीं है — समय चुनें",
      custom: "कस्टम",
      clear: "हटाएँ",
      ist: "IST",
      setSendTimeAria: (name) => `${name} के लिए भेजने का समय सेट करें`,
      customSendTimeAria: (name) => `${name} के लिए कस्टम भेजने का समय`,
      sendHourAria: (name) => `${name} के लिए भेजने का घंटा`,
      sendMinuteAria: (name) => `${name} के लिए भेजने का मिनट`,
      amPmAria: (name) => `${name} के लिए AM या PM`,
      clearSendTimeAria: (name) => `${name} के लिए भेजने का समय हटाएँ`,
      enableChannelAria: (label, name) => `${name} के लिए ${label} चालू करें`,
      channelTemplateAria: (label, name) => `${name} के लिए ${label} टेम्पलेट`,
    },
    messages: {
      failedToLoad: "श्रेणी रूट लोड नहीं हो सके",
      templateSelectedNotice:
        "आपका मेसेज चुना गया है। जिन श्रेणियों को यह भेजना है उनके लिए चैनल चालू करें, फिर Save करें।",
      nothingToSave: "अभी सेव करने के लिए कुछ नहीं है। श्रेणियों के लोड होने का इंतज़ार करें।",
      failedToSave: "ग्रीटिंग रूट सेव नहीं हो सके",
      allSaved: "सभी ऑटोमेटिक ग्रीटिंग सेव हो गईं।",
    },
  },
  mr: {
    page: {
      title: "ऑटोमॅटिक ग्रीटिंग",
      istNote:
        "ऑटोमॅटिक ग्रीटिंग India Standard Time (IST) वापरतात. खालील पाठवण्याच्या वेळा IST नुसार आहेत.",
    },
    table: {
      occasionTabsAria: "प्रसंग",
      subtitle:
        "प्रसंग बदलून त्यांचे ऑटोमॅटिक ग्रीटिंग एडिट करा. एक Save सर्व सेव्ह करतो.",
      loading: "श्रेण्या लोड होत आहेत…",
      noCategories: "अजून कोणतीही श्रेणी नाही. आधी Contacts पेजवर श्रेण्या जोडा.",
      save: "सेव्ह करा",
      saving: "सेव्ह होत आहे…",
      allCategoryName: "सर्व",
      activeAt: (time) => `अ‍ॅक्टिव्ह · ${time} IST`,
      activeNotSet: "अ‍ॅक्टिव्ह · वेळ सेट नाही - वेळ निवडा",
      notSending: "पाठवले जात नाही",
      allRowDescription: "या प्रसंगासाठी सर्व श्रेण्यांना एकच ग्रीटिंग लागू करते.",
      groupsDiffer: " श्रेण्या सध्या वेगळ्या आहेत - सर्व सारख्या करण्यासाठी All एडिट करा.",
      channels: { sms: "SMS", whatsapp: "WhatsApp", email: "Email", call: "कॉल" },
      chooseTemplate: "टेम्पलेट निवडा…",
      allGroupsSuffix: "सर्व श्रेण्या",
      callComingSoon: "डिलिव्हरी लवकरच येत आहे",
      sendAt: "या वेळी पाठवा",
      notSetChooseTime: "सेट नाही — वेळ निवडा",
      custom: "कस्टम",
      clear: "हटवा",
      ist: "IST",
      setSendTimeAria: (name) => `${name} साठी पाठवण्याची वेळ सेट करा`,
      customSendTimeAria: (name) => `${name} साठी कस्टम पाठवण्याची वेळ`,
      sendHourAria: (name) => `${name} साठी पाठवण्याचा तास`,
      sendMinuteAria: (name) => `${name} साठी पाठवण्याचे मिनिट`,
      amPmAria: (name) => `${name} साठी AM किंवा PM`,
      clearSendTimeAria: (name) => `${name} साठी पाठवण्याची वेळ हटवा`,
      enableChannelAria: (label, name) => `${name} साठी ${label} चालू करा`,
      channelTemplateAria: (label, name) => `${name} साठी ${label} टेम्पलेट`,
    },
    messages: {
      failedToLoad: "श्रेणी रूट्स लोड होऊ शकले नाहीत",
      templateSelectedNotice:
        "तुमचा मेसेज निवडला आहे. ज्या श्रेण्यांना तो पाठवायचा त्यांच्यासाठी चॅनेल चालू करा, नंतर Save करा.",
      nothingToSave: "आत्ता सेव्ह करण्यासाठी काही नाही. श्रेण्या लोड होण्याची वाट पाहा.",
      failedToSave: "ग्रीटिंग रूट्स सेव्ह होऊ शकले नाहीत",
      allSaved: "सर्व ऑटोमॅटिक ग्रीटिंग सेव्ह झाले.",
    },
  },
};

export function getGreetingRoutesDict(locale: Locale): GreetingRoutesDict {
  return GREETING_ROUTES_DICT[locale];
}
