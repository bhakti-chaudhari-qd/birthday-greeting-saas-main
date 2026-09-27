import type { Locale } from "../constants";

export type TemplatesDict = {
  page: {
    title: string;
    description: string;
    addApprovedTemplate: string;
    generatedDocuments: string;
    tabMessageTemplates: string;
    tabDocumentTemplates: string;
    templateTypeAriaLabel: string;
    channelAriaLabel: string;
    channelSms: string;
    channelWhatsapp: string;
    channelEmail: string;
    searchLabel: string;
    searchPlaceholder: string;
    failedToLoad: string;
    loading: string;
    emptyTitle: string;
    emptyDescription: string;
    addTemplateAction: string;
    noMatch: (search: string) => string;
    columnTemplateName: string;
    columnTemplateId: string;
    columnLanguage: string;
    columnOccasion: string;
    columnSubject: string;
    columnPreview: string;
    columnActions: string;
    inactiveTag: string;
    edit: string;
    delete: string;
    deleteModalTitle: string;
    deleteConfirmText: (name: string) => string;
    failedToDelete: string;
    cancel: string;
    deleting: string;
  };
  variablePicker: {
    addVariable: string;
    builtinFields: string;
    customFields: string;
  };
  form: {
    templateName: string;
    occasion: string;
    group: string;
    allGroups: string;
    groupHint: string;
    subject: string;
    subjectPlaceholder: string;
    approvedWhatsappTemplateName: string;
    approvedWhatsappTemplateNameHint: string;
    whatsappTemplateNamePattern: string;
    whatsappTemplateId: string;
    language: string;
    languageSearchPlaceholder: string;
    languageEmptyMessage: string;
    dltTemplateId: string;
    approvedDltContent: string;
    approvedDltPlaceholder: string;
    approvedText: string;
    emailBody: string;
    bodyPlaceholder: string;
    attachmentOptional: string;
    videoAttached: string;
    imageAttached: string;
    view: string;
    remove: string;
    uploading: string;
    mediaTypeError: string;
    mediaSizeError: (maxMb: number) => string;
    failedToUploadMedia: string;
    noMediaAttached: string;
    personalizedDocument: string;
    includePersonalizedPdf: string;
    pdfTemplate: string;
    selectDocumentTemplate: string;
    noDocumentTemplates: string;
    preview: string;
    previewPlaceholder: string;
    active: string;
    dltAcknowledgement: string;
    saving: string;
    addTemplateAction: (channelLabel: string) => string;
    saveChanges: string;
    failedToSaveTemplate: string;
    failedToSaveDltDetails: string;
    channelSms: string;
    channelWhatsapp: string;
    channelEmail: string;
  };
  deleteButton: {
    confirmPrompt: (name: string) => string;
    failedToDelete: string;
    title: string;
    description: string;
    deleting: string;
    deleteTemplate: string;
  };
  newPage: {
    backToManageTemplates: string;
    titleSms: string;
    titleWhatsapp: string;
    titleEmail: string;
  };
  editPage: {
    backToManageTemplates: string;
    titleSms: string;
    titleWhatsapp: string;
    titleEmail: string;
    titleFallback: string;
  };
};

const TEMPLATES_DICT: Record<Locale, TemplatesDict> = {
  en: {
    page: {
      title: "Manage Templates",
      description:
        "Manage message and document templates used by automations and personalized sends.",
      addApprovedTemplate: "+ Add Approved Template",
      generatedDocuments: "Generated Documents",
      tabMessageTemplates: "Message Templates",
      tabDocumentTemplates: "Document Templates",
      templateTypeAriaLabel: "Template type",
      channelAriaLabel: "Channel",
      channelSms: "SMS",
      channelWhatsapp: "WhatsApp",
      channelEmail: "Email",
      searchLabel: "Search templates",
      searchPlaceholder: "Search by template name or occasion",
      failedToLoad: "Failed to load templates",
      loading: "Loading templates…",
      emptyTitle: "No templates added yet.",
      emptyDescription:
        "Approved templates added here will be available in Automations.",
      addTemplateAction: "Add Template",
      noMatch: (search) => `No templates match "${search}".`,
      columnTemplateName: "Template Name",
      columnTemplateId: "Template ID",
      columnLanguage: "Language",
      columnOccasion: "Occasion",
      columnSubject: "Subject",
      columnPreview: "Preview",
      columnActions: "Actions",
      inactiveTag: "(Inactive)",
      edit: "Edit",
      delete: "Delete",
      deleteModalTitle: "Delete this template?",
      deleteConfirmText: (name) =>
        `"${name}" will be permanently removed. This cannot be undone.`,
      failedToDelete: "Failed to delete template",
      cancel: "Cancel",
      deleting: "Deleting…",
    },
    variablePicker: {
      addVariable: "Add variable",
      builtinFields: "Built-in Fields",
      customFields: "Custom Fields",
    },
    form: {
      templateName: "Template Name",
      occasion: "Occasion",
      group: "Group",
      allGroups: "All groups",
      groupHint:
        "Used by automations and manual sends for the selected group, plus All-groups templates.",
      subject: "Subject",
      subjectPlaceholder: "Happy Birthday {{name}}!",
      approvedWhatsappTemplateName: "Approved WhatsApp Template Name",
      approvedWhatsappTemplateNameHint:
        'The exact name registered with your WhatsApp provider (letters, numbers, and underscores only) - this is separate from the "Template Name" field above, which is only this app\'s internal label for the template.',
      whatsappTemplateNamePattern: "Letters, numbers, and underscores only",
      whatsappTemplateId: "Template ID",
      language: "Language",
      languageSearchPlaceholder: "Search language...",
      languageEmptyMessage: "No matching language",
      dltTemplateId: "DLT Template ID",
      approvedDltContent: "Approved DLT Content",
      approvedDltPlaceholder:
        "Happy Birthday {#var#}! Wishing you a wonderful year ahead.",
      approvedText: "Approved Text",
      emailBody: "Email Body",
      bodyPlaceholder:
        "Happy Birthday {{name}}! Wishing you a wonderful year ahead.",
      attachmentOptional: "Attachment (optional)",
      videoAttached: "Video attached · View",
      imageAttached: "Image attached · View",
      view: "View",
      remove: "Remove",
      uploading: "Uploading…",
      mediaTypeError: "Media must be a JPEG image or an MP4/WebM video.",
      mediaSizeError: (maxMb) => `Media must be at most ${maxMb} MB.`,
      failedToUploadMedia: "Failed to upload media",
      noMediaAttached: "No media attached.",
      personalizedDocument: "Personalized Document",
      includePersonalizedPdf: "Include personalized PDF",
      pdfTemplate: "PDF Template",
      selectDocumentTemplate: "Select a document template",
      noDocumentTemplates:
        "No document templates yet. Create one under Document Templates first.",
      preview: "Preview",
      previewPlaceholder: "Enter content above to preview personalization.",
      active: "Active",
      dltAcknowledgement:
        "I have reviewed the DLT Template ID and approved content pair. I understand this is not proof of DLT approval.",
      saving: "Saving…",
      addTemplateAction: (channelLabel) => `Add ${channelLabel} Template`,
      saveChanges: "Save changes",
      failedToSaveTemplate: "Failed to save template",
      failedToSaveDltDetails: "Failed to save approved DLT details",
      channelSms: "SMS",
      channelWhatsapp: "WhatsApp",
      channelEmail: "Email",
    },
    deleteButton: {
      confirmPrompt: (name) => `Delete "${name}"? This cannot be undone.`,
      failedToDelete: "Failed to delete template",
      title: "Delete template",
      description:
        "Permanent. Templates with message history can't be deleted.",
      deleting: "Deleting...",
      deleteTemplate: "Delete template",
    },
    newPage: {
      backToManageTemplates: "Back to Manage Templates",
      titleSms: "New SMS template",
      titleWhatsapp: "New WhatsApp template",
      titleEmail: "New Email template",
    },
    editPage: {
      backToManageTemplates: "Back to Manage Templates",
      titleSms: "Edit SMS template",
      titleWhatsapp: "Edit WhatsApp template",
      titleEmail: "Edit Email template",
      titleFallback: "Edit template",
    },
  },
  hi: {
    page: {
      title: "टेम्पलेट मैनेज करें",
      description:
        "ऑटोमेशन और पर्सनलाइज़्ड भेजने में इस्तेमाल होने वाले मेसेज और डॉक्यूमेंट टेम्पलेट मैनेज करें।",
      addApprovedTemplate: "+ अप्रूव्ड टेम्पलेट जोड़ें",
      generatedDocuments: "जनरेट किए गए डॉक्यूमेंट",
      tabMessageTemplates: "मेसेज टेम्पलेट",
      tabDocumentTemplates: "डॉक्यूमेंट टेम्पलेट",
      templateTypeAriaLabel: "टेम्पलेट टाइप",
      channelAriaLabel: "चैनल",
      channelSms: "SMS",
      channelWhatsapp: "WhatsApp",
      channelEmail: "Email",
      searchLabel: "टेम्पलेट खोजें",
      searchPlaceholder: "टेम्पलेट के नाम या अवसर से खोजें",
      failedToLoad: "टेम्पलेट लोड नहीं हो सके",
      loading: "टेम्पलेट लोड हो रहे हैं…",
      emptyTitle: "अभी तक कोई टेम्पलेट नहीं जोड़ा गया है।",
      emptyDescription:
        "यहां जोड़े गए अप्रूव्ड टेम्पलेट ऑटोमेशन में उपलब्ध होंगे।",
      addTemplateAction: "टेम्पलेट जोड़ें",
      noMatch: (search) => `“${search}” से कोई टेम्पलेट मेल नहीं खाता।`,
      columnTemplateName: "टेम्पलेट का नाम",
      columnTemplateId: "टेम्पलेट ID",
      columnLanguage: "भाषा",
      columnOccasion: "अवसर",
      columnSubject: "विषय",
      columnPreview: "प्रीव्यू",
      columnActions: "कार्रवाई",
      inactiveTag: "(इनएक्टिव)",
      edit: "एडिट करें",
      delete: "डिलीट करें",
      deleteModalTitle: "क्या इस टेम्पलेट को डिलीट करें?",
      deleteConfirmText: (name) =>
        `"${name}" स्थायी रूप से हटा दिया जाएगा। इसे वापस नहीं लाया जा सकता।`,
      failedToDelete: "टेम्पलेट डिलीट नहीं हो सका",
      cancel: "रद्द करें",
      deleting: "डिलीट हो रहा है…",
    },
    variablePicker: {
      addVariable: "वेरिएबल जोड़ें",
      builtinFields: "बिल्ट-इन फ़ील्ड",
      customFields: "कस्टम फ़ील्ड",
    },
    form: {
      templateName: "टेम्पलेट का नाम",
      occasion: "अवसर",
      group: "ग्रुप",
      allGroups: "सभी ग्रुप",
      groupHint:
        "यह चुने गए ग्रुप के लिए ऑटोमेशन और मैनुअल भेजने में इस्तेमाल होता है, साथ ही सभी-ग्रुप वाले टेम्पलेट में भी।",
      subject: "विषय",
      subjectPlaceholder: "हैप्पी बर्थडे {{name}}!",
      approvedWhatsappTemplateName: "अप्रूव्ड WhatsApp टेम्पलेट का नाम",
      approvedWhatsappTemplateNameHint:
        'आपके WhatsApp प्रोवाइडर के पास रजिस्टर्ड सटीक नाम (केवल अक्षर, नंबर और अंडरस्कोर) - यह ऊपर दिए "Template Name" फ़ील्ड से अलग है, जो सिर्फ़ इस ऐप में टेम्पलेट का इंटरनल लेबल है।',
      whatsappTemplateNamePattern: "केवल अक्षर, नंबर और अंडरस्कोर",
      whatsappTemplateId: "टेम्पलेट ID",
      language: "भाषा",
      languageSearchPlaceholder: "भाषा खोजें...",
      languageEmptyMessage: "कोई मेल खाती भाषा नहीं मिली",
      dltTemplateId: "DLT टेम्पलेट ID",
      approvedDltContent: "अप्रूव्ड DLT कंटेंट",
      approvedDltPlaceholder:
        "हैप्पी बर्थडे {#var#}! आपको शानदार साल की शुभकामनाएं।",
      approvedText: "अप्रूव्ड टेक्स्ट",
      emailBody: "Email बॉडी",
      bodyPlaceholder: "हैप्पी बर्थडे {{name}}! आपको शानदार साल की शुभकामनाएं।",
      attachmentOptional: "अटैचमेंट (वैकल्पिक)",
      videoAttached: "वीडियो अटैच किया गया · देखें",
      imageAttached: "इमेज अटैच की गई · देखें",
      view: "देखें",
      remove: "हटाएं",
      uploading: "अपलोड हो रहा है…",
      mediaTypeError: "मीडिया JPEG इमेज या MP4/WebM वीडियो होनी चाहिए।",
      mediaSizeError: (maxMb) => `मीडिया अधिकतम ${maxMb} MB की होनी चाहिए।`,
      failedToUploadMedia: "मीडिया अपलोड नहीं हो सका",
      noMediaAttached: "कोई मीडिया अटैच नहीं है।",
      personalizedDocument: "पर्सनलाइज़्ड डॉक्यूमेंट",
      includePersonalizedPdf: "पर्सनलाइज़्ड PDF शामिल करें",
      pdfTemplate: "PDF टेम्पलेट",
      selectDocumentTemplate: "डॉक्यूमेंट टेम्पलेट चुनें",
      noDocumentTemplates:
        "अभी तक कोई डॉक्यूमेंट टेम्पलेट नहीं है। पहले Document Templates में एक बनाएं।",
      preview: "प्रीव्यू",
      previewPlaceholder: "पर्सनलाइज़ेशन प्रीव्यू देखने के लिए ऊपर कंटेंट भरें।",
      active: "एक्टिव",
      dltAcknowledgement:
        "मैंने DLT टेम्पलेट ID और अप्रूव्ड कंटेंट पेयर की समीक्षा कर ली है। मैं समझता/समझती हूं कि यह DLT अप्रूवल का प्रमाण नहीं है।",
      saving: "सेव हो रहा है…",
      addTemplateAction: (channelLabel) => `${channelLabel} टेम्पलेट जोड़ें`,
      saveChanges: "बदलाव सेव करें",
      failedToSaveTemplate: "टेम्पलेट सेव नहीं हो सका",
      failedToSaveDltDetails: "अप्रूव्ड DLT जानकारी सेव नहीं हो सकी",
      channelSms: "SMS",
      channelWhatsapp: "WhatsApp",
      channelEmail: "Email",
    },
    deleteButton: {
      confirmPrompt: (name) => `"${name}" डिलीट करें? इसे वापस नहीं लाया जा सकता।`,
      failedToDelete: "टेम्पलेट डिलीट नहीं हो सका",
      title: "टेम्पलेट डिलीट करें",
      description:
        "यह स्थायी है। जिन टेम्पलेट का मेसेज इतिहास है, उन्हें डिलीट नहीं किया जा सकता।",
      deleting: "डिलीट हो रहा है...",
      deleteTemplate: "टेम्पलेट डिलीट करें",
    },
    newPage: {
      backToManageTemplates: "टेम्पलेट मैनेज करें पर वापस जाएं",
      titleSms: "नया SMS टेम्पलेट",
      titleWhatsapp: "नया WhatsApp टेम्पलेट",
      titleEmail: "नया Email टेम्पलेट",
    },
    editPage: {
      backToManageTemplates: "टेम्पलेट मैनेज करें पर वापस जाएं",
      titleSms: "SMS टेम्पलेट एडिट करें",
      titleWhatsapp: "WhatsApp टेम्पलेट एडिट करें",
      titleEmail: "Email टेम्पलेट एडिट करें",
      titleFallback: "टेम्पलेट एडिट करें",
    },
  },
  mr: {
    page: {
      title: "टेम्पलेट व्यवस्थापित करा",
      description:
        "ऑटोमेशन आणि पर्सनलाइज्ड पाठवण्यासाठी वापरले जाणारे मेसेज आणि डॉक्युमेंट टेम्पलेट व्यवस्थापित करा.",
      addApprovedTemplate: "+ मंजूर टेम्पलेट जोडा",
      generatedDocuments: "जनरेट केलेले डॉक्युमेंट्स",
      tabMessageTemplates: "मेसेज टेम्पलेट्स",
      tabDocumentTemplates: "डॉक्युमेंट टेम्पलेट्स",
      templateTypeAriaLabel: "टेम्पलेट प्रकार",
      channelAriaLabel: "चॅनेल",
      channelSms: "SMS",
      channelWhatsapp: "WhatsApp",
      channelEmail: "Email",
      searchLabel: "टेम्पलेट्स शोधा",
      searchPlaceholder: "टेम्पलेटचे नाव किंवा प्रसंगाने शोधा",
      failedToLoad: "टेम्पलेट्स लोड होऊ शकले नाहीत",
      loading: "टेम्पलेट्स लोड होत आहेत…",
      emptyTitle: "अजून कोणतेही टेम्पलेट जोडलेले नाही.",
      emptyDescription:
        "इथे जोडलेले मंजूर टेम्पलेट्स ऑटोमेशनमध्ये उपलब्ध असतील.",
      addTemplateAction: "टेम्पलेट जोडा",
      noMatch: (search) => `“${search}” शी कोणताही टेम्पलेट जुळत नाही.`,
      columnTemplateName: "टेम्पलेटचे नाव",
      columnTemplateId: "टेम्पलेट ID",
      columnLanguage: "भाषा",
      columnOccasion: "प्रसंग",
      columnSubject: "विषय",
      columnPreview: "प्रिव्ह्यू",
      columnActions: "क्रिया",
      inactiveTag: "(इनएक्टिव्ह)",
      edit: "एडिट करा",
      delete: "डिलीट करा",
      deleteModalTitle: "हा टेम्पलेट डिलीट करायचा आहे का?",
      deleteConfirmText: (name) =>
        `"${name}" कायमचा हटवला जाईल. हे परत केले जाऊ शकत नाही.`,
      failedToDelete: "टेम्पलेट डिलीट होऊ शकला नाही",
      cancel: "रद्द करा",
      deleting: "डिलीट होत आहे…",
    },
    variablePicker: {
      addVariable: "व्हेरिएबल जोडा",
      builtinFields: "बिल्ट-इन फील्ड्स",
      customFields: "कस्टम फील्ड्स",
    },
    form: {
      templateName: "टेम्पलेटचे नाव",
      occasion: "प्रसंग",
      group: "ग्रुप",
      allGroups: "सर्व ग्रुप्स",
      groupHint:
        "निवडलेल्या ग्रुपसाठी हे ऑटोमेशन आणि मॅन्युअल पाठवण्यासाठी वापरले जाते, तसेच सर्व-ग्रुप टेम्पलेट्ससाठीही.",
      subject: "विषय",
      subjectPlaceholder: "वाढदिवसाच्या हार्दिक शुभेच्छा {{name}}!",
      approvedWhatsappTemplateName: "मंजूर WhatsApp टेम्पलेटचे नाव",
      approvedWhatsappTemplateNameHint:
        'तुमच्या WhatsApp प्रोव्हायडरकडे नोंदवलेले अचूक नाव (फक्त अक्षरे, अंक आणि अंडरस्कोर) - हे वरील "Template Name" फील्डपेक्षा वेगळे आहे, जे फक्त या अ‍ॅपमधील टेम्पलेटचे इंटर्नल लेबल आहे.',
      whatsappTemplateNamePattern: "फक्त अक्षरे, अंक आणि अंडरस्कोर",
      whatsappTemplateId: "टेम्पलेट ID",
      language: "भाषा",
      languageSearchPlaceholder: "भाषा शोधा...",
      languageEmptyMessage: "जुळणारी भाषा सापडली नाही",
      dltTemplateId: "DLT टेम्पलेट ID",
      approvedDltContent: "मंजूर DLT कंटेंट",
      approvedDltPlaceholder:
        "वाढदिवसाच्या हार्दिक शुभेच्छा {#var#}! तुम्हाला एक सुंदर वर्ष जावो.",
      approvedText: "मंजूर मजकूर",
      emailBody: "Email मजकूर",
      bodyPlaceholder:
        "वाढदिवसाच्या हार्दिक शुभेच्छा {{name}}! तुम्हाला एक सुंदर वर्ष जावो.",
      attachmentOptional: "अटॅचमेंट (ऐच्छिक)",
      videoAttached: "व्हिडिओ अटॅच केला · पाहा",
      imageAttached: "इमेज अटॅच केली · पाहा",
      view: "पाहा",
      remove: "काढा",
      uploading: "अपलोड होत आहे…",
      mediaTypeError: "मीडिया JPEG इमेज किंवा MP4/WebM व्हिडिओ असावा.",
      mediaSizeError: (maxMb) => `मीडिया जास्तीत जास्त ${maxMb} MB असावा.`,
      failedToUploadMedia: "मीडिया अपलोड होऊ शकला नाही",
      noMediaAttached: "कोणतीही मीडिया अटॅच केलेली नाही.",
      personalizedDocument: "पर्सनलाइज्ड डॉक्युमेंट",
      includePersonalizedPdf: "पर्सनलाइज्ड PDF समाविष्ट करा",
      pdfTemplate: "PDF टेम्पलेट",
      selectDocumentTemplate: "डॉक्युमेंट टेम्पलेट निवडा",
      noDocumentTemplates:
        "अजून कोणतेही डॉक्युमेंट टेम्पलेट नाही. आधी Document Templates मध्ये एक तयार करा.",
      preview: "प्रिव्ह्यू",
      previewPlaceholder: "पर्सनलायझेशनचा प्रिव्ह्यू पाहण्यासाठी वरती मजकूर भरा.",
      active: "एक्टिव्ह",
      dltAcknowledgement:
        "मी DLT टेम्पलेट ID आणि मंजूर कंटेंट जोडी तपासली आहे. मला समजते की हा DLT मंजुरीचा पुरावा नाही.",
      saving: "सेव्ह होत आहे…",
      addTemplateAction: (channelLabel) => `${channelLabel} टेम्पलेट जोडा`,
      saveChanges: "बदल सेव्ह करा",
      failedToSaveTemplate: "टेम्पलेट सेव्ह होऊ शकला नाही",
      failedToSaveDltDetails: "मंजूर DLT माहिती सेव्ह होऊ शकली नाही",
      channelSms: "SMS",
      channelWhatsapp: "WhatsApp",
      channelEmail: "Email",
    },
    deleteButton: {
      confirmPrompt: (name) => `"${name}" डिलीट करायचा? हे परत केले जाऊ शकत नाही.`,
      failedToDelete: "टेम्पलेट डिलीट होऊ शकला नाही",
      title: "टेम्पलेट डिलीट करा",
      description:
        "हे कायमचे आहे. ज्या टेम्पलेट्सना मेसेज इतिहास आहे ते डिलीट करता येत नाहीत.",
      deleting: "डिलीट होत आहे...",
      deleteTemplate: "टेम्पलेट डिलीट करा",
    },
    newPage: {
      backToManageTemplates: "टेम्पलेट व्यवस्थापनाकडे परत जा",
      titleSms: "नवीन SMS टेम्पलेट",
      titleWhatsapp: "नवीन WhatsApp टेम्पलेट",
      titleEmail: "नवीन Email टेम्पलेट",
    },
    editPage: {
      backToManageTemplates: "टेम्पलेट व्यवस्थापनाकडे परत जा",
      titleSms: "SMS टेम्पलेट एडिट करा",
      titleWhatsapp: "WhatsApp टेम्पलेट एडिट करा",
      titleEmail: "Email टेम्पलेट एडिट करा",
      titleFallback: "टेम्पलेट एडिट करा",
    },
  },
};

export function getTemplatesDict(locale: Locale): TemplatesDict {
  return TEMPLATES_DICT[locale];
}
