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
  },
};

export function getMessagesDict(locale: Locale): MessagesDict {
  return MESSAGES_DICT[locale];
}
