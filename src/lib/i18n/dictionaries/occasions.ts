import type { Locale } from "../constants";

export type OccasionsDict = {
  manage: {
    title: string;
    description: string;
    addOccasion: string;
    loading: string;
    colOccasion: string;
    colStatus: string;
    colContactsUsing: string;
    colAutomationsUsing: string;
    actionsSr: string;
    statusSystem: string;
    statusActive: string;
    edit: string;
    delete: string;
    birthdayCannotBeDeleted: string;
    emptyTitle: string;
    emptyDescription: string;
    couldNotLoad: string;
    couldNotLoadConnection: string;
  };
  form: {
    addOccasionTitle: string;
    editOccasionTitle: string;
    occasionName: string;
    namePlaceholder: string;
    nameRequired: string;
    cancel: string;
    saving: string;
    addOccasionAction: string;
    saveChanges: string;
    couldNotSave: string;
    couldNotSaveConnection: string;
  };
  deleteDialog: {
    title: string;
    confirmText: (name: string) => string;
    cancel: string;
    deleting: string;
    deleteAction: string;
    couldNotDelete: string;
    couldNotDeleteConnection: string;
  };
  list: {
    typeBirthday: string;
    typeAnniversary: string;
    typeCustom: string;
    occasionsFallback: string;
    group: string;
    allGroups: string;
    groupFallback: string;
    date: string;
    refresh: string;
    backToToday: string;
    sendAfter: (label: string) => string;
    peopleWith: (label: string, dateLabel: string) => string;
    today: string;
    automaticSendingOff: string;
    loadingGreetings: string;
    couldNotLoadGreetings: string;
    couldNotLoadGreetingsGeneric: string;
    noItemsForDate: (label: string) => string;
    inGroup: (groupName: string) => string;
    notSetUp: string;
    noGroup: string;
    pageOf: (page: number, totalPages: number, total: number) => string;
    previous: string;
    next: string;
    notConfigured: string;
  };
};

const OCCASIONS_DICT: Record<Locale, OccasionsDict> = {
  en: {
    manage: {
      title: "Occasion Management",
      description: "Manage occasions available for greetings and automations.",
      addOccasion: "+ Add Occasion",
      loading: "Loading occasions…",
      colOccasion: "Occasion",
      colStatus: "Status",
      colContactsUsing: "Contacts Using",
      colAutomationsUsing: "Automations Using",
      actionsSr: "Actions",
      statusSystem: "System",
      statusActive: "Active",
      edit: "Edit",
      delete: "Delete",
      birthdayCannotBeDeleted: "Birthday cannot be deleted",
      emptyTitle: "No occasions yet",
      emptyDescription:
        "Add an occasion to start creating templates and automations for it.",
      couldNotLoad: "Could not load occasions",
      couldNotLoadConnection:
        "Could not load occasions. Check your connection and try again.",
    },
    form: {
      addOccasionTitle: "Add Occasion",
      editOccasionTitle: "Edit Occasion",
      occasionName: "Occasion Name",
      namePlaceholder: "e.g. Diwali, Retirement, Joining Date",
      nameRequired: "Occasion name is required",
      cancel: "Cancel",
      saving: "Saving…",
      addOccasionAction: "Add Occasion",
      saveChanges: "Save Changes",
      couldNotSave: "Could not save occasion",
      couldNotSaveConnection:
        "Could not save occasion. Check your connection and try again.",
    },
    deleteDialog: {
      title: "Delete this occasion?",
      confirmText: (name) =>
        `"${name}" will be permanently removed. This cannot be undone.`,
      cancel: "Cancel",
      deleting: "Deleting…",
      deleteAction: "Delete",
      couldNotDelete: "Could not delete occasion",
      couldNotDeleteConnection:
        "Could not delete occasion. Check your connection and try again.",
    },
    list: {
      typeBirthday: "Birthdays",
      typeAnniversary: "Anniversaries",
      typeCustom: "Custom occasions",
      occasionsFallback: "Occasions",
      group: "Group",
      allGroups: "All groups",
      groupFallback: "Group",
      date: "Date",
      refresh: "Refresh",
      backToToday: "Back to Today",
      sendAfter: (label) => `Send after ${label} · India time`,
      peopleWith: (label, dateLabel) =>
        `People with ${label.toLowerCase()} on ${dateLabel}, and their message status.`,
      today: "today",
      automaticSendingOff: "Automatic sending is off",
      loadingGreetings: "Loading greetings…",
      couldNotLoadGreetings: "Could not load greetings",
      couldNotLoadGreetingsGeneric: "Could not load greetings",
      noItemsForDate: (label) => `No ${label.toLowerCase()} for this date`,
      inGroup: (groupName) => ` in ${groupName}`,
      notSetUp: "Not set up",
      noGroup: "No group",
      pageOf: (page, totalPages, total) =>
        `Page ${page} of ${totalPages} (${total} total)`,
      previous: "Previous",
      next: "Next",
      notConfigured: "Not configured",
    },
  },
  hi: {
    manage: {
      title: "अवसर प्रबंधन",
      description: "ग्रीटिंग्स और ऑटोमेशन के लिए उपलब्ध अवसरों को मैनेज करें।",
      addOccasion: "+ अवसर जोड़ें",
      loading: "अवसर लोड हो रहे हैं…",
      colOccasion: "अवसर",
      colStatus: "स्टेटस",
      colContactsUsing: "इस्तेमाल करने वाले कॉन्टैक्ट",
      colAutomationsUsing: "इस्तेमाल करने वाले ऑटोमेशन",
      actionsSr: "एक्शन",
      statusSystem: "सिस्टम",
      statusActive: "एक्टिव",
      edit: "एडिट करें",
      delete: "डिलीट करें",
      birthdayCannotBeDeleted: "जन्मदिन को डिलीट नहीं किया जा सकता",
      emptyTitle: "अभी तक कोई अवसर नहीं है",
      emptyDescription:
        "इसके लिए टेम्पलेट और ऑटोमेशन बनाना शुरू करने के लिए एक अवसर जोड़ें।",
      couldNotLoad: "अवसर लोड नहीं हो सके",
      couldNotLoadConnection:
        "अवसर लोड नहीं हो सके। अपना कनेक्शन जांचें और फिर से कोशिश करें।",
    },
    form: {
      addOccasionTitle: "अवसर जोड़ें",
      editOccasionTitle: "अवसर एडिट करें",
      occasionName: "अवसर का नाम",
      namePlaceholder: "जैसे दिवाली, रिटायरमेंट, ज्वाइनिंग डेट",
      nameRequired: "अवसर का नाम ज़रूरी है",
      cancel: "रद्द करें",
      saving: "सेव हो रहा है…",
      addOccasionAction: "अवसर जोड़ें",
      saveChanges: "बदलाव सेव करें",
      couldNotSave: "अवसर सेव नहीं हो सका",
      couldNotSaveConnection:
        "अवसर सेव नहीं हो सका। अपना कनेक्शन जांचें और फिर से कोशिश करें।",
    },
    deleteDialog: {
      title: "क्या इस अवसर को डिलीट करना है?",
      confirmText: (name) =>
        `"${name}" हमेशा के लिए हटा दिया जाएगा। इसे वापस नहीं लाया जा सकता।`,
      cancel: "रद्द करें",
      deleting: "डिलीट हो रहा है…",
      deleteAction: "डिलीट करें",
      couldNotDelete: "अवसर डिलीट नहीं हो सका",
      couldNotDeleteConnection:
        "अवसर डिलीट नहीं हो सका। अपना कनेक्शन जांचें और फिर से कोशिश करें।",
    },
    list: {
      typeBirthday: "जन्मदिन",
      typeAnniversary: "एनिवर्सरी",
      typeCustom: "कस्टम अवसर",
      occasionsFallback: "अवसर",
      group: "ग्रुप",
      allGroups: "सभी ग्रुप",
      groupFallback: "ग्रुप",
      date: "तारीख",
      refresh: "रीफ़्रेश करें",
      backToToday: "आज पर वापस जाएं",
      sendAfter: (label) => `${label} के बाद भेजें · भारतीय समय`,
      peopleWith: (label, dateLabel) =>
        `जिन लोगों का ${label.toLowerCase()} ${dateLabel} को है, और उनके मेसेज का स्टेटस।`,
      today: "आज",
      automaticSendingOff: "ऑटोमैटिक भेजना बंद है",
      loadingGreetings: "ग्रीटिंग्स लोड हो रही हैं…",
      couldNotLoadGreetings: "ग्रीटिंग्स लोड नहीं हो सकीं",
      couldNotLoadGreetingsGeneric: "ग्रीटिंग्स लोड नहीं हो सकीं",
      noItemsForDate: (label) => `इस तारीख के लिए कोई ${label.toLowerCase()} नहीं`,
      inGroup: (groupName) => ` ${groupName} में`,
      notSetUp: "सेट अप नहीं है",
      noGroup: "कोई ग्रुप नहीं",
      pageOf: (page, totalPages, total) =>
        `पेज ${page} / ${totalPages} (कुल ${total})`,
      previous: "पिछला",
      next: "अगला",
      notConfigured: "कॉन्फ़िगर नहीं है",
    },
  },
  mr: {
    manage: {
      title: "प्रसंग व्यवस्थापन",
      description: "ग्रीटिंग्ज आणि ऑटोमेशनसाठी उपलब्ध प्रसंग व्यवस्थापित करा.",
      addOccasion: "+ प्रसंग जोडा",
      loading: "प्रसंग लोड होत आहेत…",
      colOccasion: "प्रसंग",
      colStatus: "स्टेटस",
      colContactsUsing: "वापरणारे कॉन्टॅक्ट्स",
      colAutomationsUsing: "वापरणारे ऑटोमेशन्स",
      actionsSr: "क्रिया",
      statusSystem: "सिस्टम",
      statusActive: "एक्टिव्ह",
      edit: "एडिट करा",
      delete: "डिलीट करा",
      birthdayCannotBeDeleted: "वाढदिवस डिलीट करता येत नाही",
      emptyTitle: "अजून कोणताही प्रसंग नाही",
      emptyDescription:
        "यासाठी टेम्पलेट्स आणि ऑटोमेशन तयार करणे सुरू करण्यासाठी एक प्रसंग जोडा.",
      couldNotLoad: "प्रसंग लोड होऊ शकले नाहीत",
      couldNotLoadConnection:
        "प्रसंग लोड होऊ शकले नाहीत. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.",
    },
    form: {
      addOccasionTitle: "प्रसंग जोडा",
      editOccasionTitle: "प्रसंग एडिट करा",
      occasionName: "प्रसंगाचे नाव",
      namePlaceholder: "उदा. दिवाळी, रिटायरमेंट, जॉइनिंग डेट",
      nameRequired: "प्रसंगाचे नाव आवश्यक आहे",
      cancel: "रद्द करा",
      saving: "सेव्ह होत आहे…",
      addOccasionAction: "प्रसंग जोडा",
      saveChanges: "बदल सेव्ह करा",
      couldNotSave: "प्रसंग सेव्ह होऊ शकला नाही",
      couldNotSaveConnection:
        "प्रसंग सेव्ह होऊ शकला नाही. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.",
    },
    deleteDialog: {
      title: "हा प्रसंग डिलीट करायचा आहे का?",
      confirmText: (name) =>
        `"${name}" कायमचा काढून टाकला जाईल. हे पूर्ववत करता येणार नाही.`,
      cancel: "रद्द करा",
      deleting: "डिलीट होत आहे…",
      deleteAction: "डिलीट करा",
      couldNotDelete: "प्रसंग डिलीट होऊ शकला नाही",
      couldNotDeleteConnection:
        "प्रसंग डिलीट होऊ शकला नाही. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.",
    },
    list: {
      typeBirthday: "वाढदिवस",
      typeAnniversary: "एनिव्हर्सरी",
      typeCustom: "कस्टम प्रसंग",
      occasionsFallback: "प्रसंग",
      group: "ग्रुप",
      allGroups: "सर्व ग्रुप्स",
      groupFallback: "ग्रुप",
      date: "तारीख",
      refresh: "रीफ्रेश करा",
      backToToday: "आजच्या दिवशी परत जा",
      sendAfter: (label) => `${label} नंतर पाठवा · भारतीय वेळ`,
      peopleWith: (label, dateLabel) =>
        `ज्यांचा ${label.toLowerCase()} ${dateLabel} रोजी आहे अशी व्यक्ती, आणि त्यांच्या मेसेजचा स्टेटस.`,
      today: "आज",
      automaticSendingOff: "ऑटोमॅटिक पाठवणे बंद आहे",
      loadingGreetings: "ग्रीटिंग्ज लोड होत आहेत…",
      couldNotLoadGreetings: "ग्रीटिंग्ज लोड होऊ शकली नाहीत",
      couldNotLoadGreetingsGeneric: "ग्रीटिंग्ज लोड होऊ शकली नाहीत",
      noItemsForDate: (label) => `या तारखेसाठी कोणताही ${label.toLowerCase()} नाही`,
      inGroup: (groupName) => ` ${groupName} मध्ये`,
      notSetUp: "सेट अप केलेले नाही",
      noGroup: "ग्रुप नाही",
      pageOf: (page, totalPages, total) =>
        `पेज ${page} / ${totalPages} (एकूण ${total})`,
      previous: "मागील",
      next: "पुढील",
      notConfigured: "कॉन्फिगर केलेले नाही",
    },
  },
};

export function getOccasionsDict(locale: Locale): OccasionsDict {
  return OCCASIONS_DICT[locale];
}
