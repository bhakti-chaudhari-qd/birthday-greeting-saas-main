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
  card: {
    statusActive: string;
    statusDisabled: string;
    statusPaused: string;
    occasion: string;
    category: string;
    sendTime: string;
    channels: string;
    noChannelConfigured: string;
    edit: string;
    pause: string;
    resume: string;
    delete: string;
  };
  drawer: {
    notSet: string;
    createTitle: string;
    editDescription: string;
    createDescription: string;
    cancel: string;
    save: string;
    saving: string;
    basicInformation: string;
    occasion: string;
    category: string;
    categoriesCount: (n: number) => string;
    categoriesCountCaps: (n: number) => string;
    alreadyConfiguredWarning: (occasionLabel: string) => string;
    selectedCategoriesLabel: string;
    deliveryChannels: string;
    channelsLabel: string;
    emailServiceNote: string;
    businessAccount: string;
    smsProvider: string;
    checking: string;
    connected: string;
    notConnected: string;
    setUpInSettings: string;
    approvedTemplate: string;
    chooseTemplate: string;
    noApprovedTemplates: (label: string) => string;
    loadingPreview: string;
    manageTemplates: string;
    schedule: string;
    sendTimeLabel: string;
    timezone: string;
    timezoneValue: string;
    review: string;
    automation: string;
    dash: string;
    errorChooseCategory: string;
    errorSaveGeneric: string;
    errorSaveConnection: string;
  };
  categoryMultiSelect: {
    defaultLabel: string;
    emptyLabel: string;
    placeholder: string;
    removeAria: (name: string) => string;
    moreCount: (n: number) => string;
    closeCategories: string;
    openCategories: string;
    selectAllAria: string;
    selectAll: string;
    noMatching: string;
    selectAria: (name: string) => string;
  };
  manualQuickSend: {
    heading: string;
    subtitle: string;
    failedToLoadRecipients: string;
    modeCategories: string;
    modeIndividual: string;
    modeQuickList: string;
    recipients: string;
    noCategoriesSelected: string;
    categoriesSelectedCount: (n: number) => string;
    countingUniqueRecipients: string;
    uniqueRecipients: (n: number) => string;
    countingRecipients: string;
    categoriesSelectedHeading: string;
    contactsCount: (n: number) => string;
    totalUniqueRecipients: string;
    selectedContacts: string;
    removeContactAria: (name: string) => string;
    noContactsSelected: string;
    searchContactsPlaceholder: string;
    selectContactAria: (name: string) => string;
    contactsSelectedCount: (n: number) => string;
    quickListLabel: string;
    clearList: string;
    quickListPlaceholder: string;
    recipientsHeading: string;
    noValidRecipientsYet: string;
    moreValidRecipients: (n: number) => string;
    recipientsReady: (n: number) => string;
    invalidEntriesCount: (n: number) => string;
    duplicatesIgnored: (n: number) => string;
    invalidEntriesHeading: string;
    moreInvalidEntries: (n: number) => string;
    invalidPhoneNumber: string;
    unnamedRecipient: string;
    occasion: string;
    deliveryChannels: string;
    templatesHeading: string;
    chooseAtLeastOneChannel: string;
    templateLabel: (channelLabel: string) => string;
    chooseTemplate: string;
    noApprovedTemplatesYet: (label: string) => string;
    preview: string;
    loadingPreview: string;
    sendNow: string;
    sending: string;
    errorSelectCategory: string;
    errorSelectContact: string;
    errorEnterRecipient: string;
    errorPreviewLoad: string;
    errorNoMatchingContacts: string;
    errorSendChannel: (label: string) => string;
    errorSendGeneric: string;
    sentSummary: (count: number, summary: string) => string;
    summaryPart: (count: number, label: string) => string;
    messagesSentToast: string;
    openActivity: string;
  };
  quickCreateTemplate: {
    createLink: (channel: "SMS" | "WHATSAPP") => string;
    cancel: string;
    newMessageTitle: (occasionLabel: string, channel: string) => string;
    autoSetNote: string;
    name: string;
    providerTemplateName: string;
    providerTemplatePlaceholder: string;
    language: string;
    messageLabel: string;
    previewTextLabel: string;
    suggestWithAi: string;
    generating: string;
    whatsappLiveNote: string;
    smsPracticeNote: string;
    creating: string;
    createAndSelect: string;
    errorSuggest: string;
    errorNameMessageRequired: string;
    errorProviderTemplateRequired: string;
    errorCreateFailed: string;
  };
  sendMessagesPage: {
    failedToLoad: string;
    title: string;
    description: string;
    createAutomation: string;
    tabScheduled: string;
    tabManual: string;
    searchAria: string;
    searchPlaceholder: string;
    categoryFilterAria: string;
    allCategories: string;
    occasionFilterAria: string;
    allOccasions: string;
    statusFilterAria: string;
    allStatuses: string;
    statusActive: string;
    statusPaused: string;
    statusDisabled: string;
    loading: string;
    noMatchingAutomations: string;
    noAutomationsYet: string;
    tryDifferentSearch: string;
    createFirstAutomation: string;
    confirmDelete: (title: string) => string;
    toastPaused: string;
    toastResumed: string;
    errorUpdate: string;
    toastDeleted: string;
    errorDelete: string;
    toastUpdated: string;
    toastCreated: string;
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
    card: {
      statusActive: "Active",
      statusDisabled: "Disabled",
      statusPaused: "Paused",
      occasion: "Occasion",
      category: "Category",
      sendTime: "Send Time",
      channels: "Channels",
      noChannelConfigured: "No channel configured",
      edit: "Edit",
      pause: "Pause",
      resume: "Resume",
      delete: "Delete",
    },
    drawer: {
      notSet: "Not set",
      createTitle: "Create Automation",
      editDescription: "Edit automation",
      createDescription: "New automation",
      cancel: "Cancel",
      save: "Save Automation",
      saving: "Saving…",
      basicInformation: "Basic Information",
      occasion: "Occasion",
      category: "Category",
      categoriesCount: (n) => `${n} categories`,
      categoriesCountCaps: (n) => `${n} Categories`,
      alreadyConfiguredWarning: (occasionLabel) =>
        `One or more selected categories already has a ${occasionLabel} automation. Edit the existing automation instead of creating a new one.`,
      selectedCategoriesLabel: "Selected Categories",
      deliveryChannels: "Delivery Channels",
      channelsLabel: "Channels",
      emailServiceNote:
        "Email Service: sent automatically through the platform's email provider - no setup needed.",
      businessAccount: "Business Account",
      smsProvider: "SMS Provider",
      checking: "Checking…",
      connected: "Connected",
      notConnected: "Not connected",
      setUpInSettings: "set up in Settings",
      approvedTemplate: "Approved Template",
      chooseTemplate: "Choose a template",
      noApprovedTemplates: (label) =>
        `No approved ${label} templates for the selected categories yet.`,
      loadingPreview: "Loading preview…",
      manageTemplates: "Manage Templates",
      schedule: "Schedule",
      sendTimeLabel: "Send Time",
      timezone: "Timezone",
      timezoneValue: "India Standard Time (IST)",
      review: "Review",
      automation: "Automation",
      dash: "—",
      errorChooseCategory:
        "Choose a category, at least one channel with a template, and a send time.",
      errorSaveGeneric: "Could not save automation.",
      errorSaveConnection: "Could not save automation. Check your connection and try again.",
    },
    categoryMultiSelect: {
      defaultLabel: "Selected Categories",
      emptyLabel: "No categories selected",
      placeholder: "Search categories...",
      removeAria: (name) => `Remove ${name}`,
      moreCount: (n) => `+${n} more`,
      closeCategories: "Close categories",
      openCategories: "Open categories",
      selectAllAria: "Select all categories",
      selectAll: "Select All",
      noMatching: "No matching categories",
      selectAria: (name) => `Select ${name}`,
    },
    manualQuickSend: {
      heading: "Send Now",
      subtitle: "Send a one-time greeting now, no scheduling involved.",
      failedToLoadRecipients: "Could not load recipients.",
      modeCategories: "Categories",
      modeIndividual: "Saved Contacts",
      modeQuickList: "Quick List",
      recipients: "Recipients",
      noCategoriesSelected: "No categories selected",
      categoriesSelectedCount: (n) =>
        `${n} Categor${n === 1 ? "y" : "ies"} Selected`,
      countingUniqueRecipients: "Counting unique recipients...",
      uniqueRecipients: (n) => `${n} Unique Recipient${n === 1 ? "" : "s"}`,
      countingRecipients: "Counting recipients...",
      categoriesSelectedHeading: "Categories Selected",
      contactsCount: (n) => `${n} Contact${n === 1 ? "" : "s"}`,
      totalUniqueRecipients: "Total Unique Recipients",
      selectedContacts: "Selected Contacts",
      removeContactAria: (name) => `Remove ${name}`,
      noContactsSelected: "No contacts selected",
      searchContactsPlaceholder: "Search contacts...",
      selectContactAria: (name) => `Select ${name}`,
      contactsSelectedCount: (n) =>
        n === 0 ? "No contacts selected" : `${n} Contact${n === 1 ? "" : "s"} Selected`,
      quickListLabel: "Quick List",
      clearList: "Clear List",
      quickListPlaceholder: `Paste recipients here...

Name, Phone Number
Name Phone Number
Phone Number

Supports:
- Name + Number
- Number only
- Excel/Google Sheets paste`,
      recipientsHeading: "Recipients",
      noValidRecipientsYet: "No valid recipients yet",
      moreValidRecipients: (n) => `+${n} more valid recipients`,
      recipientsReady: (n) => `Recipients Ready: ${n}`,
      invalidEntriesCount: (n) => `Invalid Entries: ${n}`,
      duplicatesIgnored: (n) => `Duplicate Entries Ignored: ${n}`,
      invalidEntriesHeading: "Invalid Entries",
      moreInvalidEntries: (n) => `+${n} more invalid entries`,
      invalidPhoneNumber: "Invalid phone number",
      unnamedRecipient: "Unnamed Recipient",
      occasion: "Occasion",
      deliveryChannels: "Delivery Channels",
      templatesHeading: "Templates",
      chooseAtLeastOneChannel: "Choose at least one delivery channel.",
      templateLabel: (channelLabel) => `${channelLabel} Template`,
      chooseTemplate: "Choose a template",
      noApprovedTemplatesYet: (label) => `No approved ${label} templates yet.`,
      preview: "Preview",
      loadingPreview: "Loading preview...",
      sendNow: "Send Now",
      sending: "Sending...",
      errorSelectCategory: "Please select at least one category.",
      errorSelectContact: "Please select at least one contact.",
      errorEnterRecipient: "Please enter at least one valid recipient.",
      errorPreviewLoad: "Could not load a preview. Check your connection and try again.",
      errorNoMatchingContacts: "No matching contacts to send to.",
      errorSendChannel: (label) => `Could not send ${label} messages.`,
      errorSendGeneric: "Could not send these messages.",
      sentSummary: (count, summary) =>
        `Queued for ${count} recipient${count === 1 ? "" : "s"}: ${summary}. Check Activity for the delivery status.`,
      summaryPart: (count, label) => `${count} via ${label}`,
      messagesSentToast: "Messages queued. Check the status in Activity.",
      openActivity: "Open Activity",
    },
    quickCreateTemplate: {
      createLink: (channel) =>
        `Create a ${channel === "SMS" ? "text message" : "WhatsApp message"}`,
      cancel: "Cancel",
      newMessageTitle: (occasionLabel, channel) => `New ${occasionLabel} ${channel} message`,
      autoSetNote: "Type, channel, and Active are set automatically.",
      name: "Name",
      providerTemplateName: "Provider template name",
      providerTemplatePlaceholder: "Exact name from your provider",
      language: "Language",
      messageLabel: "Message",
      previewTextLabel: "Preview text (not sent in Live mode)",
      suggestWithAi: "Suggest with AI",
      generating: "Generating…",
      whatsappLiveNote:
        "Live WhatsApp sends the provider-approved message attached to the template name above.",
      smsPracticeNote: "Ready for Practice mode. Live SMS may also require DLT setup.",
      creating: "Creating…",
      createAndSelect: "Create and select",
      errorSuggest: "Could not suggest a message",
      errorNameMessageRequired: "Name and message are required",
      errorProviderTemplateRequired: "Provider template name and language are required",
      errorCreateFailed: "Could not create this message",
    },
    sendMessagesPage: {
      failedToLoad: "Could not load automations. Check your connection and try again.",
      title: "Send Messages",
      description: "Create and manage automated birthday and anniversary greetings.",
      createAutomation: "+ Create Automation",
      tabScheduled: "Scheduled",
      tabManual: "Send Now",
      searchAria: "Search automations",
      searchPlaceholder: "Search by name or category",
      categoryFilterAria: "Category filter",
      allCategories: "All categories",
      occasionFilterAria: "Occasion filter",
      allOccasions: "All occasions",
      statusFilterAria: "Status filter",
      allStatuses: "All statuses",
      statusActive: "Active",
      statusPaused: "Paused",
      statusDisabled: "Disabled",
      loading: "Loading automations…",
      noMatchingAutomations: "No matching automations",
      noAutomationsYet: "No automations created yet.",
      tryDifferentSearch: "Try a different search or clear the filters.",
      createFirstAutomation: "Create your first birthday or anniversary automation.",
      confirmDelete: (title) => `Delete the ${title} automation?`,
      toastPaused: "Automation paused.",
      toastResumed: "Automation resumed.",
      errorUpdate: "Could not update automation.",
      toastDeleted: "Automation deleted.",
      errorDelete: "Could not delete automation.",
      toastUpdated: "Automation updated.",
      toastCreated: "Automation created.",
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
    card: {
      statusActive: "एक्टिव",
      statusDisabled: "डिसेबल",
      statusPaused: "पॉज़्ड",
      occasion: "अवसर",
      category: "कैटेगरी",
      sendTime: "भेजने का समय",
      channels: "चैनल",
      noChannelConfigured: "कोई चैनल कॉन्फ़िगर नहीं है",
      edit: "एडिट करें",
      pause: "पॉज़ करें",
      resume: "फिर से शुरू करें",
      delete: "डिलीट करें",
    },
    drawer: {
      notSet: "सेट नहीं है",
      createTitle: "ऑटोमेशन बनाएं",
      editDescription: "ऑटोमेशन एडिट करें",
      createDescription: "नया ऑटोमेशन",
      cancel: "रद्द करें",
      save: "ऑटोमेशन सेव करें",
      saving: "सेव हो रहा है…",
      basicInformation: "बेसिक जानकारी",
      occasion: "अवसर",
      category: "कैटेगरी",
      categoriesCount: (n) => `${n} कैटेगरी`,
      categoriesCountCaps: (n) => `${n} कैटेगरी`,
      alreadyConfiguredWarning: (occasionLabel) =>
        `चुनी गई एक या ज़्यादा कैटेगरी में पहले से ${occasionLabel} ऑटोमेशन मौजूद है। नया बनाने के बजाय मौजूदा ऑटोमेशन को एडिट करें।`,
      selectedCategoriesLabel: "चुनी गई कैटेगरी",
      deliveryChannels: "डिलीवरी चैनल",
      channelsLabel: "चैनल",
      emailServiceNote:
        "ईमेल सेवा: प्लेटफ़ॉर्म के ईमेल प्रोवाइडर के ज़रिए अपने आप भेजी जाती है - किसी सेटअप की ज़रूरत नहीं।",
      businessAccount: "बिज़नेस अकाउंट",
      smsProvider: "SMS प्रोवाइडर",
      checking: "जांचा जा रहा है…",
      connected: "जुड़ा हुआ",
      notConnected: "जुड़ा नहीं है",
      setUpInSettings: "Settings में सेटअप करें",
      approvedTemplate: "अप्रूव्ड टेम्पलेट",
      chooseTemplate: "टेम्पलेट चुनें",
      noApprovedTemplates: (label) =>
        `चुनी गई कैटेगरी के लिए अभी कोई अप्रूव्ड ${label} टेम्पलेट नहीं है।`,
      loadingPreview: "प्रीव्यू लोड हो रहा है…",
      manageTemplates: "टेम्पलेट मैनेज करें",
      schedule: "शेड्यूल",
      sendTimeLabel: "भेजने का समय",
      timezone: "टाइमज़ोन",
      timezoneValue: "India Standard Time (IST)",
      review: "रिव्यू",
      automation: "ऑटोमेशन",
      dash: "—",
      errorChooseCategory:
        "एक कैटेगरी, टेम्पलेट के साथ कम से कम एक चैनल और भेजने का समय चुनें।",
      errorSaveGeneric: "ऑटोमेशन सेव नहीं हो सका।",
      errorSaveConnection: "ऑटोमेशन सेव नहीं हो सका। अपना कनेक्शन जांचकर फिर से कोशिश करें।",
    },
    categoryMultiSelect: {
      defaultLabel: "चुनी गई कैटेगरी",
      emptyLabel: "कोई कैटेगरी नहीं चुनी गई",
      placeholder: "कैटेगरी खोजें...",
      removeAria: (name) => `${name} हटाएं`,
      moreCount: (n) => `+${n} और`,
      closeCategories: "कैटेगरी बंद करें",
      openCategories: "कैटेगरी खोलें",
      selectAllAria: "सभी कैटेगरी चुनें",
      selectAll: "सभी चुनें",
      noMatching: "कोई मिलती-जुलती कैटेगरी नहीं",
      selectAria: (name) => `${name} चुनें`,
    },
    manualQuickSend: {
      heading: "अभी भेजें",
      subtitle: "बिना शेड्यूल किए अभी एक बार का ग्रीटिंग भेजें।",
      failedToLoadRecipients: "प्राप्तकर्ता लोड नहीं हो सके।",
      modeCategories: "कैटेगरी",
      modeIndividual: "सेव किए गए कॉन्टैक्ट",
      modeQuickList: "क्विक लिस्ट",
      recipients: "प्राप्तकर्ता",
      noCategoriesSelected: "कोई कैटेगरी नहीं चुनी गई",
      categoriesSelectedCount: (n) => `${n} कैटेगरी चुनी गई`,
      countingUniqueRecipients: "यूनीक प्राप्तकर्ता गिने जा रहे हैं...",
      uniqueRecipients: (n) => `${n} यूनीक प्राप्तकर्ता`,
      countingRecipients: "प्राप्तकर्ता गिने जा रहे हैं...",
      categoriesSelectedHeading: "चुनी गई कैटेगरी",
      contactsCount: (n) => `${n} कॉन्टैक्ट`,
      totalUniqueRecipients: "कुल यूनीक प्राप्तकर्ता",
      selectedContacts: "चुने गए कॉन्टैक्ट",
      removeContactAria: (name) => `${name} हटाएं`,
      noContactsSelected: "कोई कॉन्टैक्ट नहीं चुना गया",
      searchContactsPlaceholder: "कॉन्टैक्ट खोजें...",
      selectContactAria: (name) => `${name} चुनें`,
      contactsSelectedCount: (n) =>
        n === 0 ? "कोई कॉन्टैक्ट नहीं चुना गया" : `${n} कॉन्टैक्ट चुने गए`,
      quickListLabel: "क्विक लिस्ट",
      clearList: "लिस्ट हटाएं",
      quickListPlaceholder: `प्राप्तकर्ता यहां पेस्ट करें...

नाम, फ़ोन नंबर
नाम फ़ोन नंबर
फ़ोन नंबर

सपोर्ट करता है:
- नाम + नंबर
- सिर्फ़ नंबर
- Excel/Google Sheets से पेस्ट`,
      recipientsHeading: "प्राप्तकर्ता",
      noValidRecipientsYet: "अभी तक कोई सही प्राप्तकर्ता नहीं",
      moreValidRecipients: (n) => `+${n} और सही प्राप्तकर्ता`,
      recipientsReady: (n) => `भेजने के लिए तैयार प्राप्तकर्ता: ${n}`,
      invalidEntriesCount: (n) => `गलत एंट्री: ${n}`,
      duplicatesIgnored: (n) => `डुप्लीकेट एंट्री नज़रअंदाज़ की गईं: ${n}`,
      invalidEntriesHeading: "गलत एंट्री",
      moreInvalidEntries: (n) => `+${n} और गलत एंट्री`,
      invalidPhoneNumber: "गलत फ़ोन नंबर",
      unnamedRecipient: "बेनाम प्राप्तकर्ता",
      occasion: "अवसर",
      deliveryChannels: "डिलीवरी चैनल",
      templatesHeading: "टेम्पलेट",
      chooseAtLeastOneChannel: "कम से कम एक डिलीवरी चैनल चुनें।",
      templateLabel: (channelLabel) => `${channelLabel} टेम्पलेट`,
      chooseTemplate: "टेम्पलेट चुनें",
      noApprovedTemplatesYet: (label) => `अभी कोई अप्रूव्ड ${label} टेम्पलेट नहीं है।`,
      preview: "प्रीव्यू",
      loadingPreview: "प्रीव्यू लोड हो रहा है...",
      sendNow: "अभी भेजें",
      sending: "भेजा जा रहा है...",
      errorSelectCategory: "कृपया कम से कम एक कैटेगरी चुनें।",
      errorSelectContact: "कृपया कम से कम एक कॉन्टैक्ट चुनें।",
      errorEnterRecipient: "कृपया कम से कम एक सही प्राप्तकर्ता डालें।",
      errorPreviewLoad: "प्रीव्यू लोड नहीं हो सका। अपना कनेक्शन जांचकर फिर से कोशिश करें।",
      errorNoMatchingContacts: "भेजने के लिए कोई मिलता-जुलता कॉन्टैक्ट नहीं है।",
      errorSendChannel: (label) => `${label} मेसेज नहीं भेजे जा सके।`,
      errorSendGeneric: "ये मेसेज नहीं भेजे जा सके।",
      sentSummary: (count, summary) =>
        `${count} प्राप्तकर्ताओं के लिए क्यू में: ${summary}। डिलीवरी की स्थिति Activity में देखें।`,
      summaryPart: (count, label) => `${count} ${label} के ज़रिए`,
      messagesSentToast: "मेसेज क्यू में हैं। स्थिति Activity में देखें।",
      openActivity: "Activity खोलें",
    },
    quickCreateTemplate: {
      createLink: (channel) =>
        `${channel === "SMS" ? "टेक्स्ट मेसेज" : "WhatsApp मेसेज"} बनाएं`,
      cancel: "रद्द करें",
      newMessageTitle: (occasionLabel, channel) => `नया ${occasionLabel} ${channel} मेसेज`,
      autoSetNote: "टाइप, चैनल और Active अपने आप सेट हो जाते हैं।",
      name: "नाम",
      providerTemplateName: "प्रोवाइडर टेम्पलेट का नाम",
      providerTemplatePlaceholder: "अपने प्रोवाइडर से मिला सटीक नाम",
      language: "भाषा",
      messageLabel: "मेसेज",
      previewTextLabel: "प्रीव्यू टेक्स्ट (Live मोड में नहीं भेजा जाता)",
      suggestWithAi: "AI से सुझाव लें",
      generating: "बनाया जा रहा है…",
      whatsappLiveNote:
        "Live WhatsApp ऊपर दिए टेम्पलेट नाम से जुड़ा प्रोवाइडर-अप्रूव्ड मेसेज भेजता है।",
      smsPracticeNote: "Practice मोड के लिए तैयार है। Live SMS के लिए DLT सेटअप भी ज़रूरी हो सकता है।",
      creating: "बनाया जा रहा है…",
      createAndSelect: "बनाएं और चुनें",
      errorSuggest: "मेसेज का सुझाव नहीं मिल सका",
      errorNameMessageRequired: "नाम और मेसेज ज़रूरी हैं",
      errorProviderTemplateRequired: "प्रोवाइडर टेम्पलेट का नाम और भाषा ज़रूरी हैं",
      errorCreateFailed: "यह मेसेज नहीं बन सका",
    },
    sendMessagesPage: {
      failedToLoad: "ऑटोमेशन लोड नहीं हो सके। अपना कनेक्शन जांचकर फिर से कोशिश करें।",
      title: "मेसेज भेजें",
      description: "ऑटोमेटिक बर्थडे और एनिवर्सरी ग्रीटिंग बनाएं और मैनेज करें।",
      createAutomation: "+ ऑटोमेशन बनाएं",
      tabScheduled: "शेड्यूल्ड",
      tabManual: "अभी भेजें",
      searchAria: "ऑटोमेशन खोजें",
      searchPlaceholder: "नाम या कैटेगरी से खोजें",
      categoryFilterAria: "कैटेगरी फ़िल्टर",
      allCategories: "सभी कैटेगरी",
      occasionFilterAria: "अवसर फ़िल्टर",
      allOccasions: "सभी अवसर",
      statusFilterAria: "स्टेटस फ़िल्टर",
      allStatuses: "सभी स्टेटस",
      statusActive: "एक्टिव",
      statusPaused: "पॉज़्ड",
      statusDisabled: "डिसेबल",
      loading: "ऑटोमेशन लोड हो रहे हैं…",
      noMatchingAutomations: "कोई मिलता-जुलता ऑटोमेशन नहीं",
      noAutomationsYet: "अभी तक कोई ऑटोमेशन नहीं बनाया गया।",
      tryDifferentSearch: "कोई और सर्च करें या फ़िल्टर हटाएं।",
      createFirstAutomation: "अपना पहला बर्थडे या एनिवर्सरी ऑटोमेशन बनाएं।",
      confirmDelete: (title) => `${title} ऑटोमेशन डिलीट करें?`,
      toastPaused: "ऑटोमेशन पॉज़ किया गया।",
      toastResumed: "ऑटोमेशन फिर से शुरू किया गया।",
      errorUpdate: "ऑटोमेशन अपडेट नहीं हो सका।",
      toastDeleted: "ऑटोमेशन डिलीट किया गया।",
      errorDelete: "ऑटोमेशन डिलीट नहीं हो सका।",
      toastUpdated: "ऑटोमेशन अपडेट किया गया।",
      toastCreated: "ऑटोमेशन बनाया गया।",
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
    card: {
      statusActive: "अ‍ॅक्टिव्ह",
      statusDisabled: "डिसेबल्ड",
      statusPaused: "पॉज़्ड",
      occasion: "प्रसंग",
      category: "कॅटेगरी",
      sendTime: "पाठवण्याची वेळ",
      channels: "चॅनेल",
      noChannelConfigured: "कोणतेही चॅनेल कॉन्फिगर केलेले नाही",
      edit: "एडिट करा",
      pause: "पॉज़ करा",
      resume: "पुन्हा सुरू करा",
      delete: "डिलीट करा",
    },
    drawer: {
      notSet: "सेट नाही",
      createTitle: "ऑटोमेशन तयार करा",
      editDescription: "ऑटोमेशन एडिट करा",
      createDescription: "नवीन ऑटोमेशन",
      cancel: "रद्द करा",
      save: "ऑटोमेशन सेव्ह करा",
      saving: "सेव्ह होत आहे…",
      basicInformation: "मूलभूत माहिती",
      occasion: "प्रसंग",
      category: "कॅटेगरी",
      categoriesCount: (n) => `${n} कॅटेगरी`,
      categoriesCountCaps: (n) => `${n} कॅटेगरी`,
      alreadyConfiguredWarning: (occasionLabel) =>
        `निवडलेल्या एक किंवा अधिक कॅटेगरींसाठी आधीच ${occasionLabel} ऑटोमेशन आहे. नवीन तयार करण्याऐवजी सध्याचे ऑटोमेशन एडिट करा.`,
      selectedCategoriesLabel: "निवडलेल्या कॅटेगरी",
      deliveryChannels: "डिलिव्हरी चॅनेल",
      channelsLabel: "चॅनेल",
      emailServiceNote:
        "ईमेल सेवा: प्लॅटफॉर्मच्या ईमेल प्रोव्हायडरमार्फत आपोआप पाठवली जाते - कोणत्याही सेटअपची गरज नाही.",
      businessAccount: "बिझनेस अकाउंट",
      smsProvider: "SMS प्रोव्हायडर",
      checking: "तपासत आहे…",
      connected: "कनेक्ट झाले",
      notConnected: "कनेक्ट झालेले नाही",
      setUpInSettings: "Settings मध्ये सेटअप करा",
      approvedTemplate: "मंजूर टेम्पलेट",
      chooseTemplate: "टेम्पलेट निवडा",
      noApprovedTemplates: (label) =>
        `निवडलेल्या कॅटेगरींसाठी अजून कोणतेही मंजूर ${label} टेम्पलेट नाही.`,
      loadingPreview: "प्रिव्ह्यू लोड होत आहे…",
      manageTemplates: "टेम्पलेट मॅनेज करा",
      schedule: "शेड्यूल",
      sendTimeLabel: "पाठवण्याची वेळ",
      timezone: "टाइमझोन",
      timezoneValue: "India Standard Time (IST)",
      review: "रिव्ह्यू",
      automation: "ऑटोमेशन",
      dash: "—",
      errorChooseCategory:
        "एक कॅटेगरी, टेम्पलेटसह किमान एक चॅनेल आणि पाठवण्याची वेळ निवडा.",
      errorSaveGeneric: "ऑटोमेशन सेव्ह होऊ शकले नाही.",
      errorSaveConnection: "ऑटोमेशन सेव्ह होऊ शकले नाही. तुमचे कनेक्शन तपासून पुन्हा प्रयत्न करा.",
    },
    categoryMultiSelect: {
      defaultLabel: "निवडलेल्या कॅटेगरी",
      emptyLabel: "कोणतीही कॅटेगरी निवडलेली नाही",
      placeholder: "कॅटेगरी शोधा...",
      removeAria: (name) => `${name} काढा`,
      moreCount: (n) => `+${n} आणखी`,
      closeCategories: "कॅटेगरी बंद करा",
      openCategories: "कॅटेगरी उघडा",
      selectAllAria: "सर्व कॅटेगरी निवडा",
      selectAll: "सर्व निवडा",
      noMatching: "जुळणारी कोणतीही कॅटेगरी नाही",
      selectAria: (name) => `${name} निवडा`,
    },
    manualQuickSend: {
      heading: "आत्ता पाठवा",
      subtitle: "शेड्यूलिंगशिवाय आत्ता एकदाचे ग्रीटिंग पाठवा.",
      failedToLoadRecipients: "प्राप्तकर्ते लोड होऊ शकले नाहीत.",
      modeCategories: "कॅटेगरी",
      modeIndividual: "सेव्ह केलेले कॉन्टॅक्ट्स",
      modeQuickList: "क्विक लिस्ट",
      recipients: "प्राप्तकर्ते",
      noCategoriesSelected: "कोणतीही कॅटेगरी निवडलेली नाही",
      categoriesSelectedCount: (n) => `${n} कॅटेगरी निवडली`,
      countingUniqueRecipients: "युनिक प्राप्तकर्ते मोजले जात आहेत...",
      uniqueRecipients: (n) => `${n} युनिक प्राप्तकर्ते`,
      countingRecipients: "प्राप्तकर्ते मोजले जात आहेत...",
      categoriesSelectedHeading: "निवडलेल्या कॅटेगरी",
      contactsCount: (n) => `${n} कॉन्टॅक्ट`,
      totalUniqueRecipients: "एकूण युनिक प्राप्तकर्ते",
      selectedContacts: "निवडलेले कॉन्टॅक्ट्स",
      removeContactAria: (name) => `${name} काढा`,
      noContactsSelected: "कोणताही कॉन्टॅक्ट निवडलेला नाही",
      searchContactsPlaceholder: "कॉन्टॅक्ट्स शोधा...",
      selectContactAria: (name) => `${name} निवडा`,
      contactsSelectedCount: (n) =>
        n === 0 ? "कोणताही कॉन्टॅक्ट निवडलेला नाही" : `${n} कॉन्टॅक्ट निवडले`,
      quickListLabel: "क्विक लिस्ट",
      clearList: "लिस्ट हटवा",
      quickListPlaceholder: `प्राप्तकर्ते इथे पेस्ट करा...

नाव, फोन नंबर
नाव फोन नंबर
फोन नंबर

सपोर्ट करते:
- नाव + नंबर
- फक्त नंबर
- Excel/Google Sheets मधून पेस्ट`,
      recipientsHeading: "प्राप्तकर्ते",
      noValidRecipientsYet: "अजून कोणतेही वैध प्राप्तकर्ते नाहीत",
      moreValidRecipients: (n) => `+${n} आणखी वैध प्राप्तकर्ते`,
      recipientsReady: (n) => `पाठवण्यासाठी तयार प्राप्तकर्ते: ${n}`,
      invalidEntriesCount: (n) => `अवैध नोंदी: ${n}`,
      duplicatesIgnored: (n) => `डुप्लिकेट नोंदी दुर्लक्षित केल्या: ${n}`,
      invalidEntriesHeading: "अवैध नोंदी",
      moreInvalidEntries: (n) => `+${n} आणखी अवैध नोंदी`,
      invalidPhoneNumber: "अवैध फोन नंबर",
      unnamedRecipient: "अनामित प्राप्तकर्ता",
      occasion: "प्रसंग",
      deliveryChannels: "डिलिव्हरी चॅनेल",
      templatesHeading: "टेम्पलेट",
      chooseAtLeastOneChannel: "किमान एक डिलिव्हरी चॅनेल निवडा.",
      templateLabel: (channelLabel) => `${channelLabel} टेम्पलेट`,
      chooseTemplate: "टेम्पलेट निवडा",
      noApprovedTemplatesYet: (label) => `अजून कोणतेही मंजूर ${label} टेम्पलेट नाही.`,
      preview: "प्रिव्ह्यू",
      loadingPreview: "प्रिव्ह्यू लोड होत आहे...",
      sendNow: "आत्ता पाठवा",
      sending: "पाठवत आहे...",
      errorSelectCategory: "कृपया किमान एक कॅटेगरी निवडा.",
      errorSelectContact: "कृपया किमान एक कॉन्टॅक्ट निवडा.",
      errorEnterRecipient: "कृपया किमान एक वैध प्राप्तकर्ता टाका.",
      errorPreviewLoad: "प्रिव्ह्यू लोड होऊ शकला नाही. तुमचे कनेक्शन तपासून पुन्हा प्रयत्न करा.",
      errorNoMatchingContacts: "पाठवण्यासाठी जुळणारा कोणताही कॉन्टॅक्ट नाही.",
      errorSendChannel: (label) => `${label} मेसेज पाठवले जाऊ शकले नाहीत.`,
      errorSendGeneric: "हे मेसेज पाठवले जाऊ शकले नाहीत.",
      sentSummary: (count, summary) =>
        `${count} प्राप्तकर्त्यांसाठी रांगेत: ${summary}. डिलिव्हरीची स्थिती Activity मध्ये पाहा.`,
      summaryPart: (count, label) => `${count} ${label} मार्गे`,
      messagesSentToast: "मेसेज रांगेत आहेत. स्थिती Activity मध्ये पाहा.",
      openActivity: "Activity उघडा",
    },
    quickCreateTemplate: {
      createLink: (channel) =>
        `${channel === "SMS" ? "टेक्स्ट मेसेज" : "WhatsApp मेसेज"} तयार करा`,
      cancel: "रद्द करा",
      newMessageTitle: (occasionLabel, channel) => `नवीन ${occasionLabel} ${channel} मेसेज`,
      autoSetNote: "टाइप, चॅनेल आणि Active आपोआप सेट होतात.",
      name: "नाव",
      providerTemplateName: "प्रोव्हायडर टेम्पलेटचे नाव",
      providerTemplatePlaceholder: "तुमच्या प्रोव्हायडरकडून मिळालेले नेमके नाव",
      language: "भाषा",
      messageLabel: "मेसेज",
      previewTextLabel: "प्रिव्ह्यू टेक्स्ट (Live मोडमध्ये पाठवले जात नाही)",
      suggestWithAi: "AI कडून सुचवा",
      generating: "तयार होत आहे…",
      whatsappLiveNote:
        "Live WhatsApp वरील टेम्पलेट नावाशी जोडलेला प्रोव्हायडर-मंजूर मेसेज पाठवतो.",
      smsPracticeNote: "Practice मोडसाठी तयार आहे. Live SMS साठी DLT सेटअपही आवश्यक असू शकतो.",
      creating: "तयार होत आहे…",
      createAndSelect: "तयार करा आणि निवडा",
      errorSuggest: "मेसेजचा सल्ला मिळू शकला नाही",
      errorNameMessageRequired: "नाव आणि मेसेज आवश्यक आहेत",
      errorProviderTemplateRequired: "प्रोव्हायडर टेम्पलेटचे नाव आणि भाषा आवश्यक आहे",
      errorCreateFailed: "हा मेसेज तयार होऊ शकला नाही",
    },
    sendMessagesPage: {
      failedToLoad: "ऑटोमेशन लोड होऊ शकले नाहीत. तुमचे कनेक्शन तपासून पुन्हा प्रयत्न करा.",
      title: "मेसेज पाठवा",
      description: "ऑटोमॅटिक बर्थडे आणि अ‍ॅनिव्हर्सरी ग्रीटिंग तयार करा आणि मॅनेज करा.",
      createAutomation: "+ ऑटोमेशन तयार करा",
      tabScheduled: "शेड्यूल्ड",
      tabManual: "आत्ता पाठवा",
      searchAria: "ऑटोमेशन शोधा",
      searchPlaceholder: "नावाने किंवा कॅटेगरीने शोधा",
      categoryFilterAria: "कॅटेगरी फिल्टर",
      allCategories: "सर्व कॅटेगरी",
      occasionFilterAria: "प्रसंग फिल्टर",
      allOccasions: "सर्व प्रसंग",
      statusFilterAria: "स्टेटस फिल्टर",
      allStatuses: "सर्व स्टेटस",
      statusActive: "अ‍ॅक्टिव्ह",
      statusPaused: "पॉज़्ड",
      statusDisabled: "डिसेबल्ड",
      loading: "ऑटोमेशन लोड होत आहेत…",
      noMatchingAutomations: "जुळणारे कोणतेही ऑटोमेशन नाही",
      noAutomationsYet: "अजून कोणतेही ऑटोमेशन तयार केलेले नाही.",
      tryDifferentSearch: "वेगळा शोध करून पहा किंवा फिल्टर हटवा.",
      createFirstAutomation: "तुमचे पहिले बर्थडे किंवा अ‍ॅनिव्हर्सरी ऑटोमेशन तयार करा.",
      confirmDelete: (title) => `${title} ऑटोमेशन डिलीट करायचे?`,
      toastPaused: "ऑटोमेशन पॉज़ केले.",
      toastResumed: "ऑटोमेशन पुन्हा सुरू केले.",
      errorUpdate: "ऑटोमेशन अपडेट होऊ शकले नाही.",
      toastDeleted: "ऑटोमेशन डिलीट केले.",
      errorDelete: "ऑटोमेशन डिलीट होऊ शकले नाही.",
      toastUpdated: "ऑटोमेशन अपडेट केले.",
      toastCreated: "ऑटोमेशन तयार केले.",
    },
  },
};

export function getGreetingRoutesDict(locale: Locale): GreetingRoutesDict {
  return GREETING_ROUTES_DICT[locale];
}
