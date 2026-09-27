import type { Locale } from "../constants";

export type MessagesDict = {
  whatsappPreview: {
    label: string;
    online: string;
    videoPlaceholder: string;
    imagePlaceholder: string;
    imageAlt: string;
    emptyVideo: string;
    emptyImage: string;
    emptyText: string;
    disclaimer: string;
  };
  imageOverlay: {
    requirePhotoError: string;
    invalidFileError: string;
    footerLabel: string;
    footerHintRequirePhoto: string;
    footerHintDefault: string;
    uploadFooterImage: string;
    removeFooter: string;
    footerFilePrefix: string;
    previewFailed: string;
  };
  composer: {
    title: string;
    subtitle: string;
    occasionLabel: string;
    occasionNames: {
      birthday: string;
      anniversary: string;
      custom: string;
    };
    groupLabel: string;
    allGroups: string;
    subjectLabel: string;
    messageLabel: string;
    defaultBody: string;
    defaultEmailSubject: string;
    writeWithAi: string;
    mediaOptionalLabel: string;
    mediaHint: string;
    uploadImage: string;
    generateImage: string;
    generateVideo: string;
    uploadVideo: string;
    removeMedia: string;
    selectedPrefix: string;
    imageSuffix: string;
    videoSuffix: string;
    footerAppliedSuffix: string;
    imageAlt: string;
    deliverySetup: string;
    providerTemplateName: string;
    language: string;
    preparing: string;
    useThisMessage: string;
    previewLabel: string;
    errors: {
      couldNotWriteMessage: string;
      chooseJpegImage: string;
      chooseVideo: string;
      couldNotGenerateImage: string;
      couldNotGenerateVideo: string;
      couldNotSaveMessage: string;
    };
  };
};

const MESSAGES_DICT: Record<Locale, MessagesDict> = {
  en: {
    whatsappPreview: {
      label: "WhatsApp preview",
      online: "online",
      videoPlaceholder: "Video will appear here",
      imagePlaceholder: "Image will appear here",
      imageAlt: "WhatsApp image preview",
      emptyVideo: "Add a message and video to see how the greeting looks on WhatsApp.",
      emptyImage: "Add a message and image to see how the greeting looks on WhatsApp.",
      emptyText: "Type or suggest a message to preview it on WhatsApp.",
      disclaimer:
        "Mock only - live delivery depends on your approved WhatsApp template and provider.",
    },
    imageOverlay: {
      requirePhotoError: "Upload the main photo (JPEG) first, then add a footer image",
      invalidFileError: "Choose a JPEG or PNG image within the size limit",
      footerLabel: "Footer image",
      footerHintRequirePhoto:
        "Upload a JPEG photo above first. Then you can add a footer that sits on that photo.",
      footerHintDefault:
        "Optional. Placed on your photo at the bottom and scaled to the photo width. Empty transparent/black padding above the artwork is removed automatically. Prefer a PNG with a transparent top for wavy edges.",
      uploadFooterImage: "Upload footer image",
      removeFooter: "Remove footer",
      footerFilePrefix: "Footer:",
      previewFailed: "Could not build footer preview",
    },
    composer: {
      title: "Create a message",
      subtitle:
        "Write it here, add an optional image or video, and preview everything before sending.",
      occasionLabel: "Occasion",
      occasionNames: {
        birthday: "Birthday",
        anniversary: "Anniversary",
        custom: "Other occasion",
      },
      groupLabel: "Group",
      allGroups: "All groups",
      subjectLabel: "Subject",
      messageLabel: "Message",
      defaultBody: "Happy Birthday {{name}}! Wishing you a wonderful day.",
      defaultEmailSubject: "Happy Birthday {{name}}!",
      writeWithAi: "Write with AI",
      mediaOptionalLabel: "Media (optional)",
      mediaHint:
        "Attach one JPEG image or one video. For photos you can add a footer PNG that sits on the bottom of the photo like one poster.",
      uploadImage: "Upload image",
      generateImage: "Generate image",
      generateVideo: "Generate video",
      uploadVideo: "Upload video",
      removeMedia: "Remove media",
      selectedPrefix: "Selected:",
      imageSuffix: " (image)",
      videoSuffix: " (video)",
      footerAppliedSuffix: " · Footer applied",
      imageAlt: "WhatsApp image preview",
      deliverySetup: "Delivery setup",
      providerTemplateName: "Provider template name",
      language: "Language",
      preparing: "Preparing…",
      useThisMessage: "Use this message",
      previewLabel: "Preview",
      errors: {
        couldNotWriteMessage: "Could not write a message",
        chooseJpegImage: "Choose a JPEG image within the size limit",
        chooseVideo: "Choose an MP4 or WebM video within the size limit",
        couldNotGenerateImage: "Could not generate image",
        couldNotGenerateVideo: "Could not generate video",
        couldNotSaveMessage: "Could not save message",
      },
    },
  },
  hi: {
    whatsappPreview: {
      label: "WhatsApp प्रीव्यू",
      online: "ऑनलाइन",
      videoPlaceholder: "वीडियो यहां दिखेगा",
      imagePlaceholder: "इमेज यहां दिखेगी",
      imageAlt: "WhatsApp इमेज प्रीव्यू",
      emptyVideo: "WhatsApp पर ग्रीटिंग कैसी दिखेगी यह देखने के लिए मेसेज और वीडियो जोड़ें।",
      emptyImage: "WhatsApp पर ग्रीटिंग कैसी दिखेगी यह देखने के लिए मेसेज और इमेज जोड़ें।",
      emptyText: "WhatsApp पर प्रीव्यू करने के लिए मेसेज टाइप करें या सुझाएं।",
      disclaimer:
        "यह केवल मॉक है - असली डिलीवरी आपके अप्रूव्ड WhatsApp टेम्पलेट और प्रोवाइडर पर निर्भर करती है।",
    },
    imageOverlay: {
      requirePhotoError: "पहले मुख्य फोटो (JPEG) अपलोड करें, फिर फुटर इमेज जोड़ें",
      invalidFileError: "साइज़ लिमिट के भीतर JPEG या PNG इमेज चुनें",
      footerLabel: "फुटर इमेज",
      footerHintRequirePhoto:
        "पहले ऊपर एक JPEG फोटो अपलोड करें। फिर आप उस फोटो पर बैठने वाला फुटर जोड़ सकते हैं।",
      footerHintDefault:
        "यह वैकल्पिक है। यह आपकी फोटो के नीचे रखा जाता है और फोटो की चौड़ाई के हिसाब से स्केल होता है। आर्टवर्क के ऊपर की खाली ट्रांसपेरेंट/ब्लैक पैडिंग अपने आप हट जाती है। लहरदार किनारों के लिए ट्रांसपेरेंट टॉप वाला PNG बेहतर रहता है।",
      uploadFooterImage: "फुटर इमेज अपलोड करें",
      removeFooter: "फुटर हटाएं",
      footerFilePrefix: "फुटर:",
      previewFailed: "फुटर प्रीव्यू नहीं बन सका",
    },
    composer: {
      title: "मेसेज बनाएं",
      subtitle:
        "इसे यहां लिखें, एक ऑप्शनल इमेज या वीडियो जोड़ें, और भेजने से पहले सब कुछ प्रीव्यू करें।",
      occasionLabel: "अवसर",
      occasionNames: {
        birthday: "जन्मदिन",
        anniversary: "एनिवर्सरी",
        custom: "अन्य अवसर",
      },
      groupLabel: "ग्रुप",
      allGroups: "सभी ग्रुप",
      subjectLabel: "सब्जेक्ट",
      messageLabel: "मेसेज",
      defaultBody: "जन्मदिन मुबारक हो {{name}}! आपका दिन शानदार हो।",
      defaultEmailSubject: "जन्मदिन मुबारक हो {{name}}!",
      writeWithAi: "AI से लिखवाएं",
      mediaOptionalLabel: "मीडिया (वैकल्पिक)",
      mediaHint:
        "एक JPEG इमेज या एक वीडियो अटैच करें। फोटो के लिए आप एक फुटर PNG जोड़ सकते हैं जो पोस्टर की तरह फोटो के नीचे बैठता है।",
      uploadImage: "इमेज अपलोड करें",
      generateImage: "इमेज जनरेट करें",
      generateVideo: "वीडियो जनरेट करें",
      uploadVideo: "वीडियो अपलोड करें",
      removeMedia: "मीडिया हटाएं",
      selectedPrefix: "चुना गया:",
      imageSuffix: " (इमेज)",
      videoSuffix: " (वीडियो)",
      footerAppliedSuffix: " · फुटर लगाया गया",
      imageAlt: "WhatsApp इमेज प्रीव्यू",
      deliverySetup: "डिलीवरी सेटअप",
      providerTemplateName: "प्रोवाइडर टेम्पलेट नाम",
      language: "भाषा",
      preparing: "तैयार हो रहा है…",
      useThisMessage: "यह मेसेज इस्तेमाल करें",
      previewLabel: "प्रीव्यू",
      errors: {
        couldNotWriteMessage: "मेसेज नहीं लिखा जा सका",
        chooseJpegImage: "साइज़ लिमिट के भीतर JPEG इमेज चुनें",
        chooseVideo: "साइज़ लिमिट के भीतर MP4 या WebM वीडियो चुनें",
        couldNotGenerateImage: "इमेज जनरेट नहीं हो सकी",
        couldNotGenerateVideo: "वीडियो जनरेट नहीं हो सका",
        couldNotSaveMessage: "मेसेज सेव नहीं हो सका",
      },
    },
  },
  mr: {
    whatsappPreview: {
      label: "WhatsApp प्रीव्ह्यू",
      online: "ऑनलाइन",
      videoPlaceholder: "व्हिडिओ इथे दिसेल",
      imagePlaceholder: "इमेज इथे दिसेल",
      imageAlt: "WhatsApp इमेज प्रीव्ह्यू",
      emptyVideo: "WhatsApp वर ग्रीटिंग कशी दिसेल हे पाहण्यासाठी मेसेज आणि व्हिडिओ जोडा.",
      emptyImage: "WhatsApp वर ग्रीटिंग कशी दिसेल हे पाहण्यासाठी मेसेज आणि इमेज जोडा.",
      emptyText: "WhatsApp वर प्रीव्ह्यू करण्यासाठी मेसेज टाइप करा किंवा सुचवा.",
      disclaimer:
        "हे फक्त मॉक आहे - खरी डिलिव्हरी तुमच्या मंजूर WhatsApp टेम्पलेट आणि प्रोव्हायडरवर अवलंबून असते.",
    },
    imageOverlay: {
      requirePhotoError: "आधी मुख्य फोटो (JPEG) अपलोड करा, मग फुटर इमेज जोडा",
      invalidFileError: "साइज लिमिटमधील JPEG किंवा PNG इमेज निवडा",
      footerLabel: "फुटर इमेज",
      footerHintRequirePhoto:
        "आधी वर एक JPEG फोटो अपलोड करा. मग तुम्ही त्या फोटोवर बसणारा फुटर जोडू शकता.",
      footerHintDefault:
        "हे ऐच्छिक आहे. हे तुमच्या फोटोच्या तळाशी ठेवले जाते आणि फोटोच्या रुंदीनुसार स्केल होते. आर्टवर्कच्या वरची रिकामी ट्रान्सपरंट/ब्लॅक पॅडिंग आपोआप काढली जाते. नागमोडी कडांसाठी ट्रान्सपरंट टॉप असलेला PNG वापरणे उत्तम.",
      uploadFooterImage: "फुटर इमेज अपलोड करा",
      removeFooter: "फुटर काढा",
      footerFilePrefix: "फुटर:",
      previewFailed: "फुटर प्रीव्ह्यू तयार होऊ शकला नाही",
    },
    composer: {
      title: "मेसेज तयार करा",
      subtitle:
        "इथे लिहा, ऐच्छिक इमेज किंवा व्हिडिओ जोडा आणि पाठवण्यापूर्वी सर्व काही प्रीव्ह्यू करा.",
      occasionLabel: "प्रसंग",
      occasionNames: {
        birthday: "वाढदिवस",
        anniversary: "अ‍ॅनिव्हर्सरी",
        custom: "इतर प्रसंग",
      },
      groupLabel: "गट",
      allGroups: "सर्व गट",
      subjectLabel: "विषय",
      messageLabel: "मेसेज",
      defaultBody: "वाढदिवसाच्या हार्दिक शुभेच्छा {{name}}! तुमचा दिवस छान जावो.",
      defaultEmailSubject: "वाढदिवसाच्या हार्दिक शुभेच्छा {{name}}!",
      writeWithAi: "AI कडून लिहून घ्या",
      mediaOptionalLabel: "मीडिया (ऐच्छिक)",
      mediaHint:
        "एक JPEG इमेज किंवा एक व्हिडिओ जोडा. फोटोंसाठी तुम्ही एक फुटर PNG जोडू शकता जो पोस्टरप्रमाणे फोटोच्या तळाशी बसतो.",
      uploadImage: "इमेज अपलोड करा",
      generateImage: "इमेज जनरेट करा",
      generateVideo: "व्हिडिओ जनरेट करा",
      uploadVideo: "व्हिडिओ अपलोड करा",
      removeMedia: "मीडिया काढा",
      selectedPrefix: "निवडलेले:",
      imageSuffix: " (इमेज)",
      videoSuffix: " (व्हिडिओ)",
      footerAppliedSuffix: " · फुटर लावला",
      imageAlt: "WhatsApp इमेज प्रीव्ह्यू",
      deliverySetup: "डिलिव्हरी सेटअप",
      providerTemplateName: "प्रोव्हायडर टेम्पलेट नाव",
      language: "भाषा",
      preparing: "तयार होत आहे…",
      useThisMessage: "हा मेसेज वापरा",
      previewLabel: "प्रीव्ह्यू",
      errors: {
        couldNotWriteMessage: "मेसेज लिहिता आला नाही",
        chooseJpegImage: "साइज लिमिटमधील JPEG इमेज निवडा",
        chooseVideo: "साइज लिमिटमधील MP4 किंवा WebM व्हिडिओ निवडा",
        couldNotGenerateImage: "इमेज जनरेट होऊ शकली नाही",
        couldNotGenerateVideo: "व्हिडिओ जनरेट होऊ शकला नाही",
        couldNotSaveMessage: "मेसेज सेव्ह होऊ शकला नाही",
      },
    },
  },
};

export function getMessagesDict(locale: Locale): MessagesDict {
  return MESSAGES_DICT[locale];
}
