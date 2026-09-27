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
  manualSend: {
    pageTitle: string;
    errors: {
      failedToLoadTemplates: string;
      failedToLoadAudience: string;
      failedToSelectMatching: string;
      failedToSaveEmail: string;
      selectTemplateFirst: string;
      failedToPreview: string;
      selectionChanged: string;
      failedToSend: string;
    };
    preselectedContacts: (count: number) => string;
    suggestedTemplate: (categoryName: string) => string;
    sendingBatch: (index: number, total: number, count: number) => string;
    failedOnBatch: (index: number, total: number, created: number) => string;
    networkErrorBatching: (created: number) => string;
    results: {
      heading: string;
      batches: string;
      queued: string;
      requested: string;
      skippedLimit: string;
      skippedRecipients: (count: number) => string;
      someBatchesIncomplete: string;
      openActivity: string;
      viewSubmitted: string;
      viewActivity: string;
      setupAutomatic: string;
      backgroundSendingNote: string;
      sendAnother: string;
    };
    setup: {
      channelLabel: string;
      emailHint: string;
      whatsappNotConfigured: string;
      configureWhatsapp: string;
      sendModeLabel: string;
      customHttpMode: string;
      testMode: string;
      switchToCustomHttp: string;
      savedMessagesLabel: string;
      loadingTemplates: string;
      noSmsReady: string;
      noSavedMessages: (channel: string) => string;
      configureAdvancedSms: string;
      openChannels: string;
      selectSavedMessage: string;
    };
    audience: {
      heading: string;
      countingContacts: string;
      activeContacts: (count: number) => string;
      noAudienceData: string;
      selectedContacts: (count: number) => string;
      categoryLabel: string;
      allCategories: string;
      searchLabel: string;
      searchPlaceholderEmail: string;
      searchPlaceholderDefault: string;
      selecting: string;
      selectMatchingAudience: string;
      clearSelection: string;
    };
    preview: {
      messagePreviewHeading: string;
      confirmSendHeading: string;
      messageLabel: string;
      recipientsLabel: string;
      noneSelected: string;
      batchesLabel: string;
      batchesOfUpTo: (count: number, max: number) => string;
      modeLabel: string;
      samplePreviewNote: string;
      testModeEmailNote: string;
      testModeGenericNote: string;
      backgroundNote: string;
      firstBatchNote: (total: number) => string;
      sampleMessageLabel: string;
      samplePreviewsLabel: string;
      monthlyLimitNote: string;
      confirming: string;
      confirmSendBatches: (count: number) => string;
      confirmSend: string;
      back: string;
    };
    emailComposer: {
      heading: string;
      description: string;
      subjectLabel: string;
      subjectPlaceholder: string;
      messageLabel: string;
      messagePlaceholder: string;
      previewLabel: string;
      subjectPrefix: string;
      noSubject: string;
      noMessage: string;
      enterToPreview: string;
      saving: string;
      saveMessage: string;
    };
    emptyState: {
      heading: string;
      description: string;
      nextStepHeading: string;
      step1: string;
      step2: string;
      step3: string;
      previewMessages: string;
      previewing: string;
      previewHintSelected: string;
      previewHintNone: string;
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
    manualSend: {
      pageTitle: "Send Messages",
      errors: {
        failedToLoadTemplates: "Failed to load templates",
        failedToLoadAudience: "Failed to load audience",
        failedToSelectMatching: "Failed to select matching contacts",
        failedToSaveEmail: "Failed to save email",
        selectTemplateFirst: "Select a template first",
        failedToPreview: "Failed to preview messages",
        selectionChanged: "Selection changed since preview. Preview again before sending.",
        failedToSend: "Failed to send messages",
      },
      preselectedContacts: (count) =>
        `${count} contact${count === 1 ? "" : "s"} preselected from Contacts.`,
      suggestedTemplate: (categoryName) =>
        `Suggested template from category “${categoryName}”. You can change it.`,
      sendingBatch: (index, total, count) =>
        `Sending batch ${index} of ${total} (${count} recipients)…`,
      failedOnBatch: (index, total, created) =>
        `Failed on batch ${index} of ${total}. ${created} message(s) were already queued.`,
      networkErrorBatching: (created) =>
        `Network error while batching. ${created} message(s) were already queued.`,
      results: {
        heading: "Greeting ready",
        batches: "Batches:",
        queued: "Queued:",
        requested: "Requested:",
        skippedLimit: "Skipped (limit):",
        skippedRecipients: (count) =>
          `${count} recipient${count === 1 ? "" : "s"} skipped (monthly limit reached).`,
        someBatchesIncomplete:
          "Some batches did not complete. Check Scheduled and Submitted in Activity.",
        openActivity: "Open Activity",
        viewSubmitted: "View submitted",
        viewActivity: "View activity",
        setupAutomatic: "Set up automatic sending",
        backgroundSendingNote:
          "Your greeting is being sent in the background. Open Activity to check the result.",
        sendAnother: "Send another greeting",
      },
      setup: {
        channelLabel: "Channel",
        emailHint: "Emails send via platform Resend. Contacts need an email address.",
        whatsappNotConfigured: "WhatsApp channel must be configured before sending.",
        configureWhatsapp: "Configure WhatsApp channel",
        sendModeLabel: "Send mode:",
        customHttpMode: "Custom HTTP (live gateway)",
        testMode: "Test (simulated - nothing is delivered to a real phone)",
        switchToCustomHttp:
          "Switch to Custom HTTP under WhatsApp settings to deliver to real numbers.",
        savedMessagesLabel: "Saved Messages",
        loadingTemplates: "Loading templates...",
        noSmsReady:
          "No SMS messages ready to send. Configure live SMS under Settings → Channels, then use Advanced SMS Setup for provider-approved templates.",
        noSavedMessages: (channel) => `No saved ${channel} messages yet. Create one below.`,
        configureAdvancedSms: "Configure Advanced SMS Setup",
        openChannels: "Open Channels",
        selectSavedMessage: "Select a saved message",
      },
      audience: {
        heading: "Audience",
        countingContacts: "Counting active contacts…",
        activeContacts: (count) =>
          `${count} active contact${count === 1 ? "" : "s"}.`,
        noAudienceData: "No audience data available.",
        selectedContacts: (count) =>
          `Selected ${count} contact${count === 1 ? "" : "s"}`,
        categoryLabel: "Category",
        allCategories: "All categories",
        searchLabel: "Search",
        searchPlaceholderEmail: "Name, mobile, or email",
        searchPlaceholderDefault: "Name or mobile",
        selecting: "Selecting…",
        selectMatchingAudience: "Select matching audience",
        clearSelection: "Clear selection",
      },
      preview: {
        messagePreviewHeading: "Message preview",
        confirmSendHeading: "Confirm send",
        messageLabel: "Message:",
        recipientsLabel: "Recipients:",
        noneSelected: "None selected (sample preview)",
        batchesLabel: "Batches:",
        batchesOfUpTo: (count, max) => `${count} sends of up to ${max}`,
        modeLabel: "Mode:",
        samplePreviewNote:
          "This is a sample preview with placeholder name “Alex”. Select recipients below, then preview again to confirm send.",
        testModeEmailNote: "Test mode queues a simulated email only. It will not be delivered.",
        testModeGenericNote:
          "Test mode queues a simulated send only. It will not arrive on a real phone.",
        backgroundNote:
          "Queued messages are sent in the background. Check Scheduled while pending, then Submitted in Activity for the outcome.",
        firstBatchNote: (total) =>
          `Previews show the first batch. All ${total} recipients will be queued.`,
        sampleMessageLabel: "Sample message",
        samplePreviewsLabel: "Sample previews",
        monthlyLimitNote: "Counts toward your monthly limit.",
        confirming: "Confirming…",
        confirmSendBatches: (count) => `Confirm Send (${count} batches)`,
        confirmSend: "Confirm Send",
        back: "Back",
      },
      emailComposer: {
        heading: "Create email message",
        description:
          "Write your email and save it as a template. No recipients needed to preview.",
        subjectLabel: "Subject",
        subjectPlaceholder: "Happy Birthday {{name}}!",
        messageLabel: "Message",
        messagePlaceholder: "Happy Birthday {{name}}! Wishing you a wonderful day.",
        previewLabel: "Preview",
        subjectPrefix: "Subject:",
        noSubject: "(no subject)",
        noMessage: "(empty message)",
        enterToPreview: "Enter a subject and message to preview.",
        saving: "Saving...",
        saveMessage: "Save message",
      },
      emptyState: {
        heading: "Message preview",
        description: "Select a saved message and audience, then generate a preview.",
        nextStepHeading: "Next step",
        step1: "1. Pick a saved message.",
        step2: "2. Choose recipients or refine your audience.",
        step3: "3. Click Preview to verify before sending.",
        previewMessages: "Preview messages",
        previewing: "Previewing...",
        previewHintSelected: "Preview shows a sample message. Select recipients to confirm send.",
        previewHintNone: "Choose a saved message first.",
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
    manualSend: {
      pageTitle: "मेसेज भेजें",
      errors: {
        failedToLoadTemplates: "टेम्पलेट लोड नहीं हो सके",
        failedToLoadAudience: "ऑडियंस लोड नहीं हो सकी",
        failedToSelectMatching: "मैचिंग कॉन्टैक्ट चुने नहीं जा सके",
        failedToSaveEmail: "ईमेल सेव नहीं हो सका",
        selectTemplateFirst: "पहले एक टेम्पलेट चुनें",
        failedToPreview: "मेसेज प्रीव्यू नहीं हो सके",
        selectionChanged: "प्रीव्यू के बाद सिलेक्शन बदल गया है। भेजने से पहले फिर से प्रीव्यू करें।",
        failedToSend: "मेसेज नहीं भेजे जा सके",
      },
      preselectedContacts: (count) =>
        `कॉन्टैक्ट्स से ${count} कॉन्टैक्ट पहले से चुने गए हैं।`,
      suggestedTemplate: (categoryName) =>
        `कैटेगरी “${categoryName}” से सुझाया गया टेम्पलेट। आप इसे बदल सकते हैं।`,
      sendingBatch: (index, total, count) =>
        `बैच ${index} में से ${total} भेजा जा रहा है (${count} प्राप्तकर्ता)…`,
      failedOnBatch: (index, total, created) =>
        `बैच ${index} में से ${total} फेल हो गया। ${created} मेसेज पहले ही क्यू में जोड़े जा चुके हैं।`,
      networkErrorBatching: (created) =>
        `बैचिंग के दौरान नेटवर्क एरर हुई। ${created} मेसेज पहले ही क्यू में जोड़े जा चुके हैं।`,
      results: {
        heading: "ग्रीटिंग तैयार है",
        batches: "बैच:",
        queued: "क्यू में:",
        requested: "रिक्वेस्ट किए गए:",
        skippedLimit: "स्किप (लिमिट):",
        skippedRecipients: (count) =>
          `${count} प्राप्तकर्ता स्किप हुए (मासिक लिमिट पूरी हो गई)।`,
        someBatchesIncomplete:
          "कुछ बैच पूरे नहीं हुए। एक्टिविटी में शेड्यूल्ड और सबमिटेड चेक करें।",
        openActivity: "एक्टिविटी खोलें",
        viewSubmitted: "सबमिटेड देखें",
        viewActivity: "एक्टिविटी देखें",
        setupAutomatic: "ऑटोमेटिक भेजना सेट करें",
        backgroundSendingNote:
          "आपकी ग्रीटिंग बैकग्राउंड में भेजी जा रही है। नतीजा देखने के लिए एक्टिविटी खोलें।",
        sendAnother: "एक और ग्रीटिंग भेजें",
      },
      setup: {
        channelLabel: "चैनल",
        emailHint: "ईमेल प्लेटफ़ॉर्म Resend के ज़रिए भेजे जाते हैं। कॉन्टैक्ट का ईमेल पता ज़रूरी है।",
        whatsappNotConfigured: "भेजने से पहले WhatsApp चैनल कॉन्फ़िगर करना ज़रूरी है।",
        configureWhatsapp: "WhatsApp चैनल कॉन्फ़िगर करें",
        sendModeLabel: "भेजने का मोड:",
        customHttpMode: "कस्टम HTTP (लाइव गेटवे)",
        testMode: "टेस्ट (सिम्युलेटेड - असली फोन पर डिलीवर नहीं होता)",
        switchToCustomHttp:
          "असली नंबरों पर डिलीवर करने के लिए WhatsApp सेटिंग्स में कस्टम HTTP पर स्विच करें।",
        savedMessagesLabel: "सेव किए गए मेसेज",
        loadingTemplates: "टेम्पलेट लोड हो रहे हैं...",
        noSmsReady:
          "भेजने के लिए कोई SMS मेसेज तैयार नहीं है। Settings → Channels में लाइव SMS कॉन्फ़िगर करें, फिर प्रोवाइडर-अप्रूव्ड टेम्पलेट के लिए एडवांस्ड SMS सेटअप इस्तेमाल करें।",
        noSavedMessages: (channel) => `अभी तक कोई सेव किया गया ${channel} मेसेज नहीं है। नीचे एक बनाएं।`,
        configureAdvancedSms: "एडवांस्ड SMS सेटअप कॉन्फ़िगर करें",
        openChannels: "चैनल्स खोलें",
        selectSavedMessage: "एक सेव किया गया मेसेज चुनें",
      },
      audience: {
        heading: "ऑडियंस",
        countingContacts: "एक्टिव कॉन्टैक्ट गिने जा रहे हैं…",
        activeContacts: (count) => `${count} एक्टिव कॉन्टैक्ट।`,
        noAudienceData: "कोई ऑडियंस डेटा उपलब्ध नहीं है।",
        selectedContacts: (count) => `${count} कॉन्टैक्ट चुने गए`,
        categoryLabel: "कैटेगरी",
        allCategories: "सभी कैटेगरी",
        searchLabel: "खोजें",
        searchPlaceholderEmail: "नाम, मोबाइल, या ईमेल",
        searchPlaceholderDefault: "नाम या मोबाइल",
        selecting: "चुना जा रहा है…",
        selectMatchingAudience: "मैचिंग ऑडियंस चुनें",
        clearSelection: "सिलेक्शन हटाएं",
      },
      preview: {
        messagePreviewHeading: "मेसेज प्रीव्यू",
        confirmSendHeading: "भेजना कन्फ़र्म करें",
        messageLabel: "मेसेज:",
        recipientsLabel: "प्राप्तकर्ता:",
        noneSelected: "कोई नहीं चुना गया (सैंपल प्रीव्यू)",
        batchesLabel: "बैच:",
        batchesOfUpTo: (count, max) => `${max} तक के ${count} सेंड`,
        modeLabel: "मोड:",
        samplePreviewNote:
          "यह प्लेसहोल्डर नाम “Alex” के साथ एक सैंपल प्रीव्यू है। नीचे प्राप्तकर्ता चुनें, फिर भेजना कन्फ़र्म करने के लिए दोबारा प्रीव्यू करें।",
        testModeEmailNote: "टेस्ट मोड सिर्फ एक सिम्युलेटेड ईमेल क्यू करता है। यह डिलीवर नहीं होगा।",
        testModeGenericNote:
          "टेस्ट मोड सिर्फ एक सिम्युलेटेड सेंड क्यू करता है। यह असली फोन पर नहीं आएगा।",
        backgroundNote:
          "क्यू किए गए मेसेज बैकग्राउंड में भेजे जाते हैं। पेंडिंग रहते समय शेड्यूल्ड और नतीजे के लिए एक्टिविटी में सबमिटेड चेक करें।",
        firstBatchNote: (total) =>
          `प्रीव्यू पहले बैच को दिखाता है। सभी ${total} प्राप्तकर्ता क्यू किए जाएंगे।`,
        sampleMessageLabel: "सैंपल मेसेज",
        samplePreviewsLabel: "सैंपल प्रीव्यू",
        monthlyLimitNote: "यह आपकी मासिक लिमिट में गिना जाता है।",
        confirming: "कन्फ़र्म हो रहा है…",
        confirmSendBatches: (count) => `भेजना कन्फ़र्म करें (${count} बैच)`,
        confirmSend: "भेजना कन्फ़र्म करें",
        back: "वापस",
      },
      emailComposer: {
        heading: "ईमेल मेसेज बनाएं",
        description:
          "अपना ईमेल लिखें और इसे टेम्पलेट के रूप में सेव करें। प्रीव्यू के लिए किसी प्राप्तकर्ता की ज़रूरत नहीं है।",
        subjectLabel: "सब्जेक्ट",
        subjectPlaceholder: "जन्मदिन मुबारक हो {{name}}!",
        messageLabel: "मेसेज",
        messagePlaceholder: "जन्मदिन मुबारक हो {{name}}! आपका दिन शानदार हो।",
        previewLabel: "प्रीव्यू",
        subjectPrefix: "सब्जेक्ट:",
        noSubject: "(कोई सब्जेक्ट नहीं)",
        noMessage: "(खाली मेसेज)",
        enterToPreview: "प्रीव्यू के लिए सब्जेक्ट और मेसेज डालें।",
        saving: "सेव हो रहा है...",
        saveMessage: "मेसेज सेव करें",
      },
      emptyState: {
        heading: "मेसेज प्रीव्यू",
        description: "एक सेव किया गया मेसेज और ऑडियंस चुनें, फिर प्रीव्यू जनरेट करें।",
        nextStepHeading: "अगला कदम",
        step1: "1. एक सेव किया गया मेसेज चुनें।",
        step2: "2. प्राप्तकर्ता चुनें या अपनी ऑडियंस को बेहतर बनाएं।",
        step3: "3. भेजने से पहले वेरिफ़ाई करने के लिए प्रीव्यू पर क्लिक करें।",
        previewMessages: "मेसेज प्रीव्यू करें",
        previewing: "प्रीव्यू हो रहा है...",
        previewHintSelected: "प्रीव्यू एक सैंपल मेसेज दिखाता है। भेजना कन्फ़र्म करने के लिए प्राप्तकर्ता चुनें।",
        previewHintNone: "पहले एक सेव किया गया मेसेज चुनें।",
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
    manualSend: {
      pageTitle: "मेसेज पाठवा",
      errors: {
        failedToLoadTemplates: "टेम्पलेट्स लोड होऊ शकले नाहीत",
        failedToLoadAudience: "ऑडियंस लोड होऊ शकली नाही",
        failedToSelectMatching: "जुळणारे कॉन्टॅक्ट्स निवडले जाऊ शकले नाहीत",
        failedToSaveEmail: "ईमेल सेव्ह होऊ शकला नाही",
        selectTemplateFirst: "आधी एक टेम्पलेट निवडा",
        failedToPreview: "मेसेज प्रीव्ह्यू होऊ शकले नाहीत",
        selectionChanged: "प्रीव्ह्यूनंतर निवड बदलली आहे. पाठवण्यापूर्वी पुन्हा प्रीव्ह्यू करा.",
        failedToSend: "मेसेज पाठवले जाऊ शकले नाहीत",
      },
      preselectedContacts: (count) =>
        `कॉन्टॅक्ट्समधून ${count} कॉन्टॅक्ट आधीच निवडले गेले आहेत.`,
      suggestedTemplate: (categoryName) =>
        `“${categoryName}” कॅटेगरीमधून सुचवलेले टेम्पलेट. तुम्ही ते बदलू शकता.`,
      sendingBatch: (index, total, count) =>
        `बॅच ${index} पैकी ${total} पाठवला जात आहे (${count} प्राप्तकर्ते)…`,
      failedOnBatch: (index, total, created) =>
        `बॅच ${index} पैकी ${total} अयशस्वी झाला. ${created} मेसेज आधीच क्यूमध्ये जोडले गेले आहेत.`,
      networkErrorBatching: (created) =>
        `बॅचिंग दरम्यान नेटवर्क एरर आली. ${created} मेसेज आधीच क्यूमध्ये जोडले गेले आहेत.`,
      results: {
        heading: "ग्रीटिंग तयार आहे",
        batches: "बॅच:",
        queued: "क्यूमध्ये:",
        requested: "विनंती केलेले:",
        skippedLimit: "वगळले (लिमिट):",
        skippedRecipients: (count) =>
          `${count} प्राप्तकर्ते वगळले (मासिक लिमिट पूर्ण झाली).`,
        someBatchesIncomplete:
          "काही बॅच पूर्ण झाल्या नाहीत. अ‍ॅक्टिव्हिटीमध्ये शेड्यूल्ड आणि सबमिटेड तपासा.",
        openActivity: "अ‍ॅक्टिव्हिटी उघडा",
        viewSubmitted: "सबमिटेड पहा",
        viewActivity: "अ‍ॅक्टिव्हिटी पहा",
        setupAutomatic: "ऑटोमॅटिक पाठवणे सेट करा",
        backgroundSendingNote:
          "तुमची ग्रीटिंग बॅकग्राउंडमध्ये पाठवली जात आहे. निकाल पाहण्यासाठी अ‍ॅक्टिव्हिटी उघडा.",
        sendAnother: "आणखी एक ग्रीटिंग पाठवा",
      },
      setup: {
        channelLabel: "चॅनल",
        emailHint: "ईमेल प्लॅटफॉर्म Resend मार्फत पाठवले जातात. कॉन्टॅक्टचा ईमेल पत्ता आवश्यक आहे.",
        whatsappNotConfigured: "पाठवण्यापूर्वी WhatsApp चॅनल कॉन्फिगर करणे आवश्यक आहे.",
        configureWhatsapp: "WhatsApp चॅनल कॉन्फिगर करा",
        sendModeLabel: "पाठवण्याची पद्धत:",
        customHttpMode: "कस्टम HTTP (लाइव्ह गेटवे)",
        testMode: "टेस्ट (सिम्युलेटेड - खऱ्या फोनवर डिलिव्हर होत नाही)",
        switchToCustomHttp:
          "खऱ्या नंबरवर डिलिव्हर करण्यासाठी WhatsApp सेटिंग्जमध्ये कस्टम HTTP वर स्विच करा.",
        savedMessagesLabel: "सेव्ह केलेले मेसेज",
        loadingTemplates: "टेम्पलेट्स लोड होत आहेत...",
        noSmsReady:
          "पाठवण्यासाठी कोणतेही SMS मेसेज तयार नाहीत. Settings → Channels मध्ये लाइव्ह SMS कॉन्फिगर करा, नंतर प्रोव्हायडर-मंजूर टेम्पलेटसाठी अ‍ॅडव्हान्स्ड SMS सेटअप वापरा.",
        noSavedMessages: (channel) => `अजून कोणताही सेव्ह केलेला ${channel} मेसेज नाही. खाली एक तयार करा.`,
        configureAdvancedSms: "अ‍ॅडव्हान्स्ड SMS सेटअप कॉन्फिगर करा",
        openChannels: "चॅनल्स उघडा",
        selectSavedMessage: "एक सेव्ह केलेला मेसेज निवडा",
      },
      audience: {
        heading: "ऑडियंस",
        countingContacts: "एक्टिव्ह कॉन्टॅक्ट्स मोजले जात आहेत…",
        activeContacts: (count) => `${count} एक्टिव्ह कॉन्टॅक्ट्स.`,
        noAudienceData: "कोणताही ऑडियंस डेटा उपलब्ध नाही.",
        selectedContacts: (count) => `${count} कॉन्टॅक्ट्स निवडले`,
        categoryLabel: "कॅटेगरी",
        allCategories: "सर्व कॅटेगरी",
        searchLabel: "शोधा",
        searchPlaceholderEmail: "नाव, मोबाइल किंवा ईमेल",
        searchPlaceholderDefault: "नाव किंवा मोबाइल",
        selecting: "निवडले जात आहे…",
        selectMatchingAudience: "जुळणारी ऑडियंस निवडा",
        clearSelection: "निवड रद्द करा",
      },
      preview: {
        messagePreviewHeading: "मेसेज प्रीव्ह्यू",
        confirmSendHeading: "पाठवणे कन्फर्म करा",
        messageLabel: "मेसेज:",
        recipientsLabel: "प्राप्तकर्ते:",
        noneSelected: "कोणीही निवडले नाही (सॅम्पल प्रीव्ह्यू)",
        batchesLabel: "बॅच:",
        batchesOfUpTo: (count, max) => `${max} पर्यंतचे ${count} सेंड`,
        modeLabel: "मोड:",
        samplePreviewNote:
          "हा प्लेसहोल्डर नाव “Alex” सह एक सॅम्पल प्रीव्ह्यू आहे. खाली प्राप्तकर्ते निवडा, नंतर पाठवणे कन्फर्म करण्यासाठी पुन्हा प्रीव्ह्यू करा.",
        testModeEmailNote: "टेस्ट मोड फक्त एक सिम्युलेटेड ईमेल क्यू करतो. तो डिलिव्हर होणार नाही.",
        testModeGenericNote:
          "टेस्ट मोड फक्त एक सिम्युलेटेड सेंड क्यू करतो. तो खऱ्या फोनवर येणार नाही.",
        backgroundNote:
          "क्यू केलेले मेसेज बॅकग्राउंडमध्ये पाठवले जातात. पेंडिंग असताना शेड्यूल्ड आणि निकालासाठी अ‍ॅक्टिव्हिटीमध्ये सबमिटेड तपासा.",
        firstBatchNote: (total) =>
          `प्रीव्ह्यू पहिला बॅच दाखवतो. सर्व ${total} प्राप्तकर्ते क्यू केले जातील.`,
        sampleMessageLabel: "सॅम्पल मेसेज",
        samplePreviewsLabel: "सॅम्पल प्रीव्ह्यू",
        monthlyLimitNote: "हे तुमच्या मासिक लिमिटमध्ये मोजले जाते.",
        confirming: "कन्फर्म होत आहे…",
        confirmSendBatches: (count) => `पाठवणे कन्फर्म करा (${count} बॅच)`,
        confirmSend: "पाठवणे कन्फर्म करा",
        back: "मागे",
      },
      emailComposer: {
        heading: "ईमेल मेसेज तयार करा",
        description:
          "तुमचा ईमेल लिहा आणि तो टेम्पलेट म्हणून सेव्ह करा. प्रीव्ह्यूसाठी कोणत्याही प्राप्तकर्त्याची गरज नाही.",
        subjectLabel: "विषय",
        subjectPlaceholder: "वाढदिवसाच्या हार्दिक शुभेच्छा {{name}}!",
        messageLabel: "मेसेज",
        messagePlaceholder: "वाढदिवसाच्या हार्दिक शुभेच्छा {{name}}! तुमचा दिवस छान जावो.",
        previewLabel: "प्रीव्ह्यू",
        subjectPrefix: "विषय:",
        noSubject: "(विषय नाही)",
        noMessage: "(रिकामा मेसेज)",
        enterToPreview: "प्रीव्ह्यूसाठी विषय आणि मेसेज टाका.",
        saving: "सेव्ह होत आहे...",
        saveMessage: "मेसेज सेव्ह करा",
      },
      emptyState: {
        heading: "मेसेज प्रीव्ह्यू",
        description: "एक सेव्ह केलेला मेसेज आणि ऑडियंस निवडा, नंतर प्रीव्ह्यू तयार करा.",
        nextStepHeading: "पुढची पायरी",
        step1: "1. एक सेव्ह केलेला मेसेज निवडा.",
        step2: "2. प्राप्तकर्ते निवडा किंवा तुमची ऑडियंस अधिक चांगली करा.",
        step3: "3. पाठवण्यापूर्वी खात्री करण्यासाठी प्रीव्ह्यूवर क्लिक करा.",
        previewMessages: "मेसेज प्रीव्ह्यू करा",
        previewing: "प्रीव्ह्यू होत आहे...",
        previewHintSelected: "प्रीव्ह्यू एक सॅम्पल मेसेज दाखवतो. पाठवणे कन्फर्म करण्यासाठी प्राप्तकर्ते निवडा.",
        previewHintNone: "आधी एक सेव्ह केलेला मेसेज निवडा.",
      },
    },
  },
};

export function getMessagesDict(locale: Locale): MessagesDict {
  return MESSAGES_DICT[locale];
}
