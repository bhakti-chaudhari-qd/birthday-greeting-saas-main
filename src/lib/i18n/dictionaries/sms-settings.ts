import type { Locale } from "../constants";

export type SmsSettingsDict = {
  list: {
    heading: string;
    addApprovedTemplate: string;
    addApprovedTemplateHeading: string;
    dltTemplateName: string;
    occasion: string;
    dltTemplateId: string;
    approvedDltContent: string;
    adding: string;
    addApprovedTemplateAction: string;
    cancel: string;
    loading: string;
    noTemplates: string;
    colTemplate: string;
    colStatus: string;
    colAction: string;
    ready: string;
    setupRequired: string;
    reviewSetup: string;
    configure: string;
    channelsLink: string;
    dashboardLink: string;
    failedToLoad: string;
    failedToAdd: string;
    failedToSaveDlt: string;
  };
  setup: {
    heading: string;
    important: string;
    importantBody: string;
    loading: string;
    readiness: string;
    applicationTemplateBody: string;
    dltTemplateName: string;
    occasion: string;
    dltTemplateId: string;
    approvedDltContent: string;
    compatibility: string;
    compatible: string;
    incompatible: string;
    acknowledgement: string;
    saving: string;
    saveAction: string;
    saved: string;
    allSmsTemplates: string;
    channelsLink: string;
    templateNotFound: string;
    failedToLoad: string;
    failedToSaveName: string;
    failedToSave: string;
  };
};

const SMS_SETTINGS_DICT: Record<Locale, SmsSettingsDict> = {
  en: {
    list: {
      heading: "Advanced SMS Template Setup",
      addApprovedTemplate: "Add approved DLT template",
      addApprovedTemplateHeading: "Add approved DLT template",
      dltTemplateName: "DLT template name",
      occasion: "Occasion",
      dltTemplateId: "DLT Template ID",
      approvedDltContent: "Approved DLT content",
      adding: "Adding...",
      addApprovedTemplateAction: "Add approved template",
      cancel: "Cancel",
      loading: "Loading SMS templates...",
      noTemplates:
        "No SMS templates found. Add an approved DLT template to configure real SMS.",
      colTemplate: "Template",
      colStatus: "Real SMS status",
      colAction: "Action",
      ready: "Ready",
      setupRequired: "Setup Required",
      reviewSetup: "Review Setup",
      configure: "Configure",
      channelsLink: "Channels",
      dashboardLink: "Dashboard",
      failedToLoad: "Failed to load SMS templates",
      failedToAdd: "Failed to add approved DLT template",
      failedToSaveDlt: "Failed to save approved DLT settings",
    },
    setup: {
      heading: "Advanced SMS Setup",
      important: "Important",
      importantBody:
        "Use the DLT Template ID and approved content from your provider. This checks structure only, not DLT approval.",
      loading: "Loading setup...",
      readiness: "Readiness",
      applicationTemplateBody: "Application template body",
      dltTemplateName: "DLT template name",
      occasion: "Occasion",
      dltTemplateId: "DLT Template ID",
      approvedDltContent: "Approved DLT content",
      compatibility: "Compatibility",
      compatible:
        "Application body is structurally compatible with the saved approved content.",
      incompatible: "Compatibility issues detected.",
      acknowledgement:
        "I have reviewed the DLT Template ID and approved content pair. I understand this is not proof of DLT approval.",
      saving: "Saving...",
      saveAction: "Save SMS setup",
      saved: "SMS setup saved",
      allSmsTemplates: "All SMS templates",
      channelsLink: "Channels",
      templateNotFound: "Template not found",
      failedToLoad: "Failed to load SMS setup",
      failedToSaveName: "Failed to save template name",
      failedToSave: "Failed to save SMS setup",
    },
  },
  hi: {
    list: {
      heading: "एडवांस्ड SMS टेम्पलेट सेटअप",
      addApprovedTemplate: "अप्रूव्ड DLT टेम्पलेट जोड़ें",
      addApprovedTemplateHeading: "अप्रूव्ड DLT टेम्पलेट जोड़ें",
      dltTemplateName: "DLT टेम्पलेट नाम",
      occasion: "अवसर",
      dltTemplateId: "DLT टेम्पलेट ID",
      approvedDltContent: "अप्रूव्ड DLT कंटेंट",
      adding: "जोड़ा जा रहा है...",
      addApprovedTemplateAction: "अप्रूव्ड टेम्पलेट जोड़ें",
      cancel: "रद्द करें",
      loading: "SMS टेम्पलेट लोड हो रहे हैं...",
      noTemplates:
        "कोई SMS टेम्पलेट नहीं मिला। रियल SMS कॉन्फ़िगर करने के लिए एक अप्रूव्ड DLT टेम्पलेट जोड़ें।",
      colTemplate: "टेम्पलेट",
      colStatus: "रियल SMS स्टेटस",
      colAction: "एक्शन",
      ready: "तैयार",
      setupRequired: "सेटअप ज़रूरी है",
      reviewSetup: "सेटअप रिव्यू करें",
      configure: "कॉन्फ़िगर करें",
      channelsLink: "चैनल",
      dashboardLink: "डैशबोर्ड",
      failedToLoad: "SMS टेम्पलेट लोड नहीं हो सके",
      failedToAdd: "अप्रूव्ड DLT टेम्पलेट जोड़ा नहीं जा सका",
      failedToSaveDlt: "अप्रूव्ड DLT सेटिंग्स सेव नहीं हो सकीं",
    },
    setup: {
      heading: "एडवांस्ड SMS सेटअप",
      important: "ज़रूरी",
      importantBody:
        "अपने प्रोवाइडर से मिला DLT टेम्पलेट ID और अप्रूव्ड कंटेंट इस्तेमाल करें। यह सिर्फ़ स्ट्रक्चर जांचता है, DLT अप्रूवल नहीं।",
      loading: "सेटअप लोड हो रहा है...",
      readiness: "तैयारी",
      applicationTemplateBody: "एप्लिकेशन टेम्पलेट बॉडी",
      dltTemplateName: "DLT टेम्पलेट नाम",
      occasion: "अवसर",
      dltTemplateId: "DLT टेम्पलेट ID",
      approvedDltContent: "अप्रूव्ड DLT कंटेंट",
      compatibility: "कम्पैटिबिलिटी",
      compatible:
        "एप्लिकेशन बॉडी सेव किए गए अप्रूव्ड कंटेंट के साथ स्ट्रक्चरल रूप से कम्पैटिबल है।",
      incompatible: "कम्पैटिबिलिटी में समस्याएं मिलीं।",
      acknowledgement:
        "मैंने DLT टेम्पलेट ID और अप्रूव्ड कंटेंट की जोड़ी रिव्यू कर ली है। मुझे पता है कि यह DLT अप्रूवल का सबूत नहीं है।",
      saving: "सेव हो रहा है...",
      saveAction: "SMS सेटअप सेव करें",
      saved: "SMS सेटअप सेव हो गया",
      allSmsTemplates: "सभी SMS टेम्पलेट",
      channelsLink: "चैनल",
      templateNotFound: "टेम्पलेट नहीं मिला",
      failedToLoad: "SMS सेटअप लोड नहीं हो सका",
      failedToSaveName: "टेम्पलेट का नाम सेव नहीं हो सका",
      failedToSave: "SMS सेटअप सेव नहीं हो सका",
    },
  },
  mr: {
    list: {
      heading: "अ‍ॅडव्हान्स्ड SMS टेम्पलेट सेटअप",
      addApprovedTemplate: "अप्रूव्ह्ड DLT टेम्पलेट जोडा",
      addApprovedTemplateHeading: "अप्रूव्ह्ड DLT टेम्पलेट जोडा",
      dltTemplateName: "DLT टेम्पलेट नाव",
      occasion: "प्रसंग",
      dltTemplateId: "DLT टेम्पलेट ID",
      approvedDltContent: "अप्रूव्ह्ड DLT कंटेंट",
      adding: "जोडत आहे...",
      addApprovedTemplateAction: "अप्रूव्ह्ड टेम्पलेट जोडा",
      cancel: "रद्द करा",
      loading: "SMS टेम्पलेट्स लोड होत आहेत...",
      noTemplates:
        "कोणतेही SMS टेम्पलेट सापडले नाही. रिअल SMS कॉन्फिगर करण्यासाठी एक अप्रूव्ह्ड DLT टेम्पलेट जोडा.",
      colTemplate: "टेम्पलेट",
      colStatus: "रिअल SMS स्टेटस",
      colAction: "क्रिया",
      ready: "तयार",
      setupRequired: "सेटअप आवश्यक",
      reviewSetup: "सेटअप रिव्ह्यू करा",
      configure: "कॉन्फिगर करा",
      channelsLink: "चॅनेल",
      dashboardLink: "डॅशबोर्ड",
      failedToLoad: "SMS टेम्पलेट्स लोड होऊ शकले नाहीत",
      failedToAdd: "अप्रूव्ह्ड DLT टेम्पलेट जोडता आले नाही",
      failedToSaveDlt: "अप्रूव्ह्ड DLT सेटिंग्ज सेव्ह होऊ शकल्या नाहीत",
    },
    setup: {
      heading: "अ‍ॅडव्हान्स्ड SMS सेटअप",
      important: "महत्त्वाचे",
      importantBody:
        "तुमच्या प्रोव्हायडरकडून मिळालेला DLT टेम्पलेट ID आणि अप्रूव्ह्ड कंटेंट वापरा. हे फक्त स्ट्रक्चर तपासते, DLT अप्रूव्हल नाही.",
      loading: "सेटअप लोड होत आहे...",
      readiness: "तयारी",
      applicationTemplateBody: "अ‍ॅप्लिकेशन टेम्पलेट बॉडी",
      dltTemplateName: "DLT टेम्पलेट नाव",
      occasion: "प्रसंग",
      dltTemplateId: "DLT टेम्पलेट ID",
      approvedDltContent: "अप्रूव्ह्ड DLT कंटेंट",
      compatibility: "कम्पॅटिबिलिटी",
      compatible:
        "अ‍ॅप्लिकेशन बॉडी सेव्ह केलेल्या अप्रूव्ह्ड कंटेंटसोबत स्ट्रक्चरल दृष्ट्या सुसंगत आहे.",
      incompatible: "कम्पॅटिबिलिटी समस्या आढळल्या.",
      acknowledgement:
        "मी DLT टेम्पलेट ID आणि अप्रूव्ह्ड कंटेंटची जोडी रिव्ह्यू केली आहे. मला माहीत आहे की हा DLT अप्रूव्हलचा पुरावा नाही.",
      saving: "सेव्ह होत आहे...",
      saveAction: "SMS सेटअप सेव्ह करा",
      saved: "SMS सेटअप सेव्ह झाले",
      allSmsTemplates: "सर्व SMS टेम्पलेट्स",
      channelsLink: "चॅनेल",
      templateNotFound: "टेम्पलेट सापडले नाही",
      failedToLoad: "SMS सेटअप लोड होऊ शकला नाही",
      failedToSaveName: "टेम्पलेटचे नाव सेव्ह होऊ शकले नाही",
      failedToSave: "SMS सेटअप सेव्ह होऊ शकला नाही",
    },
  },
};

export function getSmsSettingsDict(locale: Locale): SmsSettingsDict {
  return SMS_SETTINGS_DICT[locale];
}
