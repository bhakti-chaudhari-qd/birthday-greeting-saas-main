import type { Locale } from "../constants";

export type ContactsDict = {
  header: {
    title: string;
    description: string;
    exportCsv: string;
    exporting: string;
    importCsv: string;
    importing: string;
    addContact: string;
  };
  importProgress: {
    importingFile: (fileName: string) => string;
    rowsProcessed: (processed: string, total: string) => string;
    preparingFile: string;
    addedUpdatedSoFar: (created: string, updated: string) => string;
  };
  importDetails: {
    heading: (count: number) => string;
    rowError: (row: number, message: string) => string;
  };
  filters: {
    searchContacts: string;
    searchPlaceholder: string;
    categoryFilter: string;
    allCategories: string;
    occasionFilter: string;
    allOccasions: string;
    statusFilter: string;
    active: string;
    inactive: string;
    allStatuses: string;
    hintMobile: string;
    hintText: string;
  };
  bulk: {
    selected: (count: number) => string;
    markActive: string;
    updating: string;
    markInactive: string;
    exportSelected: string;
    delete: string;
    clearSelection: string;
    confirmBulkStatus: (nextActive: boolean, count: number) => string;
    confirmBulkDelete: (count: number) => string;
  };
  messages: {
    couldNotLoadContacts: string;
    couldNotLoadContactsConn: string;
    noStatusChangeNeeded: string;
    updatedContacts: (count: number) => string;
    couldNotChangeStatus: (action: "activate" | "deactivate") => string;
    couldNotUpdateConn: string;
    deletedContacts: (count: number) => string;
    couldNotDeleteContacts: string;
    couldNotDeleteConn: string;
    couldNotExportSelected: string;
    exportedSelected: (count: number) => string;
    couldNotExportConn: string;
    couldNotExportContacts: string;
    importFileTypeError: string;
    couldNotImportContacts: string;
    couldNotImportConn: string;
    importStarted: string;
    importFailed: string;
    importFinishedSummary: (summary: {
      created: number;
      updated: number;
      skippedDuplicate: number;
      invalid: number;
      skippedLimit: number;
    }) => string;
  };
  table: {
    selectAllAria: string;
    selectOneAria: (name: string) => string;
    colName: string;
    colCategory: string;
    colPhone: string;
    colNextOccasion: string;
    colStatus: string;
    colActionsSr: string;
    edit: string;
    active: string;
    inactive: string;
    emptyDash: string;
  };
  emptyState: {
    noMatchingTitle: string;
    noContactsTitle: string;
    tryDifferentSearch: string;
    startByAdding: string;
    addContactAction: string;
  };
  pagination: {
    pageOf: (page: number, totalPages: number, total: number) => string;
    selectedAcrossPages: (count: number) => string;
    previous: string;
    next: string;
  };
  loadingAria: string;
};

const CONTACTS_DICT: Record<Locale, ContactsDict> = {
  en: {
    header: {
      title: "Contacts",
      description: "Manage your contacts and greeting recipients.",
      exportCsv: "Export CSV",
      exporting: "Exporting…",
      importCsv: "Import CSV",
      importing: "Importing…",
      addContact: "+ Add Contact",
    },
    importProgress: {
      importingFile: (fileName) => `Importing ${fileName}`,
      rowsProcessed: (processed, total) => `${processed} of ${total} rows processed`,
      preparingFile: "Preparing file…",
      addedUpdatedSoFar: (created, updated) =>
        `${created} added, ${updated} updated so far. You can leave this page and return later.`,
    },
    importDetails: {
      heading: (count) => `Import details (showing up to ${count} issues)`,
      rowError: (row, message) => `Row ${row}: ${message}`,
    },
    filters: {
      searchContacts: "Search contacts",
      searchPlaceholder: "Search by name or mobile",
      categoryFilter: "Category filter",
      allCategories: "All categories",
      occasionFilter: "Occasion filter",
      allOccasions: "All occasions",
      statusFilter: "Status filter",
      active: "Active",
      inactive: "Inactive",
      allStatuses: "All statuses",
      hintMobile: "Type at least 3 digits to search by mobile.",
      hintText: "Type at least 2 characters to search.",
    },
    bulk: {
      selected: (count) => `${count} selected`,
      markActive: "Mark active",
      updating: "Updating…",
      markInactive: "Mark inactive",
      exportSelected: "Export selected",
      delete: "Delete",
      clearSelection: "Clear selection",
      confirmBulkStatus: (nextActive, count) =>
        `${nextActive ? "Mark" : "Deactivate"} ${count} contact${count === 1 ? "" : "s"}?`,
      confirmBulkDelete: (count) =>
        `Permanently delete ${count} contact${count === 1 ? "" : "s"}? This cannot be undone.`,
    },
    messages: {
      couldNotLoadContacts: "Could not load contacts. Try again.",
      couldNotLoadContactsConn:
        "Could not load contacts. Check your connection and try again.",
      noStatusChangeNeeded: "No contacts needed a status change.",
      updatedContacts: (count) => `Updated ${count} contact${count === 1 ? "" : "s"}.`,
      couldNotChangeStatus: (action) => `Could not ${action} contacts.`,
      couldNotUpdateConn:
        "Could not update contacts. Check your connection and try again.",
      deletedContacts: (count) => `Deleted ${count} contact${count === 1 ? "" : "s"}.`,
      couldNotDeleteContacts: "Could not delete contacts.",
      couldNotDeleteConn:
        "Could not delete contacts. Check your connection and try again.",
      couldNotExportSelected: "Could not export selected contacts.",
      exportedSelected: (count) =>
        `Exported ${count} selected contact${count === 1 ? "" : "s"}.`,
      couldNotExportConn:
        "Could not export contacts. Check your connection and try again.",
      couldNotExportContacts: "Could not export contacts. Try again.",
      importFileTypeError: "Import a .csv, .xlsx, or .xls file.",
      couldNotImportContacts: "Could not import contacts. Try again.",
      couldNotImportConn:
        "Could not import contacts. Check your connection and try again.",
      importStarted:
        "Import started. You can stay on this page or come back later - progress updates automatically.",
      importFailed: "Import failed. Try again.",
      importFinishedSummary: (summary) =>
        `Import finished: ${summary.created} added, ${summary.updated} updated, ${summary.skippedDuplicate} duplicates in file skipped, ${summary.invalid} invalid, ${summary.skippedLimit} skipped for limit.`,
    },
    table: {
      selectAllAria: "Select all contacts on this page",
      selectOneAria: (name) => `Select ${name}`,
      colName: "Name",
      colCategory: "Category",
      colPhone: "Phone",
      colNextOccasion: "Next Occasion",
      colStatus: "Status",
      colActionsSr: "Actions",
      edit: "Edit",
      active: "Active",
      inactive: "Inactive",
      emptyDash: "—",
    },
    emptyState: {
      noMatchingTitle: "No matching contacts",
      noContactsTitle: "No contacts yet",
      tryDifferentSearch: "Try a different search or clear the filters.",
      startByAdding: "Start by adding your first contact or import them from CSV.",
      addContactAction: "Add Contact",
    },
    pagination: {
      pageOf: (page, totalPages, total) => `Page ${page} of ${totalPages} (${total} total)`,
      selectedAcrossPages: (count) => ` · ${count} selected across pages`,
      previous: "Previous",
      next: "Next",
    },
    loadingAria: "Loading contacts",
  },
  hi: {
    header: {
      title: "कॉन्टैक्ट",
      description: "अपने कॉन्टैक्ट और ग्रीटिंग प्राप्तकर्ता प्रबंधित करें।",
      exportCsv: "CSV एक्सपोर्ट करें",
      exporting: "एक्सपोर्ट हो रहा है…",
      importCsv: "CSV इंपोर्ट करें",
      importing: "इंपोर्ट हो रहा है…",
      addContact: "+ कॉन्टैक्ट जोड़ें",
    },
    importProgress: {
      importingFile: (fileName) => `${fileName} इंपोर्ट हो रही है`,
      rowsProcessed: (processed, total) => `${total} में से ${processed} पंक्तियाँ प्रोसेस हुईं`,
      preparingFile: "फ़ाइल तैयार हो रही है…",
      addedUpdatedSoFar: (created, updated) =>
        `अब तक ${created} जोड़े गए, ${updated} अपडेट हुए। आप इस पेज से जा सकते हैं और बाद में वापस आ सकते हैं।`,
    },
    importDetails: {
      heading: (count) => `इंपोर्ट विवरण (${count} तक समस्याएँ दिखाई जा रही हैं)`,
      rowError: (row, message) => `पंक्ति ${row}: ${message}`,
    },
    filters: {
      searchContacts: "कॉन्टैक्ट खोजें",
      searchPlaceholder: "नाम या मोबाइल से खोजें",
      categoryFilter: "श्रेणी फ़िल्टर",
      allCategories: "सभी श्रेणियाँ",
      occasionFilter: "अवसर फ़िल्टर",
      allOccasions: "सभी अवसर",
      statusFilter: "स्टेटस फ़िल्टर",
      active: "सक्रिय",
      inactive: "निष्क्रिय",
      allStatuses: "सभी स्टेटस",
      hintMobile: "मोबाइल से खोजने के लिए कम से कम 3 अंक टाइप करें।",
      hintText: "खोजने के लिए कम से कम 2 अक्षर टाइप करें।",
    },
    bulk: {
      selected: (count) => `${count} चुने गए`,
      markActive: "सक्रिय करें",
      updating: "अपडेट हो रहा है…",
      markInactive: "निष्क्रिय करें",
      exportSelected: "चुने हुए एक्सपोर्ट करें",
      delete: "हटाएँ",
      clearSelection: "चयन हटाएँ",
      confirmBulkStatus: (nextActive, count) =>
        `${count} कॉन्टैक्ट ${nextActive ? "सक्रिय करें" : "निष्क्रिय करें"}?`,
      confirmBulkDelete: (count) =>
        `${count} कॉन्टैक्ट हमेशा के लिए हटाएँ? यह वापस नहीं हो सकता।`,
    },
    messages: {
      couldNotLoadContacts: "कॉन्टैक्ट लोड नहीं हो सके। फिर कोशिश करें।",
      couldNotLoadContactsConn:
        "कॉन्टैक्ट लोड नहीं हो सके। अपना कनेक्शन जाँचें और फिर कोशिश करें।",
      noStatusChangeNeeded: "किसी कॉन्टैक्ट का स्टेटस बदलने की ज़रूरत नहीं थी।",
      updatedContacts: (count) => `${count} कॉन्टैक्ट अपडेट हुए।`,
      couldNotChangeStatus: (action) =>
        `कॉन्टैक्ट ${action === "activate" ? "सक्रिय" : "निष्क्रिय"} नहीं हो सके।`,
      couldNotUpdateConn:
        "कॉन्टैक्ट अपडेट नहीं हो सके। अपना कनेक्शन जाँचें और फिर कोशिश करें।",
      deletedContacts: (count) => `${count} कॉन्टैक्ट हटाए गए।`,
      couldNotDeleteContacts: "कॉन्टैक्ट हटाए नहीं जा सके।",
      couldNotDeleteConn:
        "कॉन्टैक्ट हटाए नहीं जा सके। अपना कनेक्शन जाँचें और फिर कोशिश करें।",
      couldNotExportSelected: "चुने हुए कॉन्टैक्ट एक्सपोर्ट नहीं हो सके।",
      exportedSelected: (count) => `${count} चुने हुए कॉन्टैक्ट एक्सपोर्ट हुए।`,
      couldNotExportConn:
        "कॉन्टैक्ट एक्सपोर्ट नहीं हो सके। अपना कनेक्शन जाँचें और फिर कोशिश करें।",
      couldNotExportContacts: "कॉन्टैक्ट एक्सपोर्ट नहीं हो सके। फिर कोशिश करें।",
      importFileTypeError: ".csv, .xlsx, या .xls फ़ाइल इंपोर्ट करें।",
      couldNotImportContacts: "कॉन्टैक्ट इंपोर्ट नहीं हो सके। फिर कोशिश करें।",
      couldNotImportConn:
        "कॉन्टैक्ट इंपोर्ट नहीं हो सके। अपना कनेक्शन जाँचें और फिर कोशिश करें।",
      importStarted:
        "इंपोर्ट शुरू हो गया है। आप इस पेज पर रह सकते हैं या बाद में वापस आ सकते हैं - प्रगति अपने आप अपडेट होती है।",
      importFailed: "इंपोर्ट असफल रहा। फिर कोशिश करें।",
      importFinishedSummary: (summary) =>
        `इंपोर्ट पूरा हुआ: ${summary.created} जोड़े गए, ${summary.updated} अपडेट हुए, फ़ाइल में ${summary.skippedDuplicate} डुप्लिकेट छोड़े गए, ${summary.invalid} अमान्य, सीमा के कारण ${summary.skippedLimit} छोड़े गए।`,
    },
    table: {
      selectAllAria: "इस पेज के सभी कॉन्टैक्ट चुनें",
      selectOneAria: (name) => `${name} चुनें`,
      colName: "नाम",
      colCategory: "श्रेणी",
      colPhone: "फ़ोन",
      colNextOccasion: "अगला अवसर",
      colStatus: "स्टेटस",
      colActionsSr: "कार्रवाई",
      edit: "संपादित करें",
      active: "सक्रिय",
      inactive: "निष्क्रिय",
      emptyDash: "—",
    },
    emptyState: {
      noMatchingTitle: "कोई मेल खाता कॉन्टैक्ट नहीं",
      noContactsTitle: "अभी तक कोई कॉन्टैक्ट नहीं",
      tryDifferentSearch: "कोई और खोज आज़माएँ या फ़िल्टर हटाएँ।",
      startByAdding: "अपना पहला कॉन्टैक्ट जोड़कर शुरू करें या CSV से इंपोर्ट करें।",
      addContactAction: "कॉन्टैक्ट जोड़ें",
    },
    pagination: {
      pageOf: (page, totalPages, total) => `पेज ${page} / ${totalPages} (कुल ${total})`,
      selectedAcrossPages: (count) => ` · ${count} पेजों में चुने गए`,
      previous: "पिछला",
      next: "अगला",
    },
    loadingAria: "कॉन्टैक्ट लोड हो रहे हैं",
  },
  mr: {
    header: {
      title: "कॉन्टॅक्ट",
      description: "तुमचे कॉन्टॅक्ट आणि ग्रीटिंग प्राप्तकर्ते व्यवस्थापित करा.",
      exportCsv: "CSV एक्सपोर्ट करा",
      exporting: "एक्सपोर्ट होत आहे…",
      importCsv: "CSV इंपोर्ट करा",
      importing: "इंपोर्ट होत आहे…",
      addContact: "+ कॉन्टॅक्ट जोडा",
    },
    importProgress: {
      importingFile: (fileName) => `${fileName} इंपोर्ट होत आहे`,
      rowsProcessed: (processed, total) => `${total} पैकी ${processed} ओळी प्रोसेस झाल्या`,
      preparingFile: "फाइल तयार होत आहे…",
      addedUpdatedSoFar: (created, updated) =>
        `आतापर्यंत ${created} जोडले, ${updated} अपडेट झाले. तुम्ही या पेजवरून जाऊ शकता आणि नंतर परत येऊ शकता.`,
    },
    importDetails: {
      heading: (count) => `इंपोर्ट तपशील (${count} पर्यंत समस्या दाखवत आहे)`,
      rowError: (row, message) => `ओळ ${row}: ${message}`,
    },
    filters: {
      searchContacts: "कॉन्टॅक्ट शोधा",
      searchPlaceholder: "नाव किंवा मोबाइलने शोधा",
      categoryFilter: "श्रेणी फिल्टर",
      allCategories: "सर्व श्रेणी",
      occasionFilter: "प्रसंग फिल्टर",
      allOccasions: "सर्व प्रसंग",
      statusFilter: "स्टेटस फिल्टर",
      active: "सक्रिय",
      inactive: "निष्क्रिय",
      allStatuses: "सर्व स्टेटस",
      hintMobile: "मोबाइलने शोधण्यासाठी किमान 3 अंक टाइप करा.",
      hintText: "शोधण्यासाठी किमान 2 अक्षरे टाइप करा.",
    },
    bulk: {
      selected: (count) => `${count} निवडले`,
      markActive: "सक्रिय करा",
      updating: "अपडेट होत आहे…",
      markInactive: "निष्क्रिय करा",
      exportSelected: "निवडलेले एक्सपोर्ट करा",
      delete: "हटवा",
      clearSelection: "निवड रद्द करा",
      confirmBulkStatus: (nextActive, count) =>
        `${count} कॉन्टॅक्ट ${nextActive ? "सक्रिय करायचे" : "निष्क्रिय करायचे"}?`,
      confirmBulkDelete: (count) =>
        `${count} कॉन्टॅक्ट कायमचे हटवायचे? हे परत करता येणार नाही.`,
    },
    messages: {
      couldNotLoadContacts: "कॉन्टॅक्ट लोड होऊ शकले नाहीत. पुन्हा प्रयत्न करा.",
      couldNotLoadContactsConn:
        "कॉन्टॅक्ट लोड होऊ शकले नाहीत. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.",
      noStatusChangeNeeded: "कोणत्याही कॉन्टॅक्टाचा स्टेटस बदलण्याची गरज नव्हती.",
      updatedContacts: (count) => `${count} कॉन्टॅक्ट अपडेट झाले.`,
      couldNotChangeStatus: (action) =>
        `कॉन्टॅक्ट ${action === "activate" ? "सक्रिय" : "निष्क्रिय"} करता आले नाहीत.`,
      couldNotUpdateConn:
        "कॉन्टॅक्ट अपडेट करता आले नाहीत. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.",
      deletedContacts: (count) => `${count} कॉन्टॅक्ट हटवले.`,
      couldNotDeleteContacts: "कॉन्टॅक्ट हटवता आले नाहीत.",
      couldNotDeleteConn:
        "कॉन्टॅक्ट हटवता आले नाहीत. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.",
      couldNotExportSelected: "निवडलेले कॉन्टॅक्ट एक्सपोर्ट करता आले नाहीत.",
      exportedSelected: (count) => `${count} निवडलेले कॉन्टॅक्ट एक्सपोर्ट झाले.`,
      couldNotExportConn:
        "कॉन्टॅक्ट एक्सपोर्ट करता आले नाहीत. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.",
      couldNotExportContacts: "कॉन्टॅक्ट एक्सपोर्ट करता आले नाहीत. पुन्हा प्रयत्न करा.",
      importFileTypeError: ".csv, .xlsx, किंवा .xls फाइल इंपोर्ट करा.",
      couldNotImportContacts: "कॉन्टॅक्ट इंपोर्ट करता आले नाहीत. पुन्हा प्रयत्न करा.",
      couldNotImportConn:
        "कॉन्टॅक्ट इंपोर्ट करता आले नाहीत. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.",
      importStarted:
        "इंपोर्ट सुरू झाले आहे. तुम्ही या पेजवर राहू शकता किंवा नंतर परत येऊ शकता - प्रगती आपोआप अपडेट होते.",
      importFailed: "इंपोर्ट अयशस्वी झाले. पुन्हा प्रयत्न करा.",
      importFinishedSummary: (summary) =>
        `इंपोर्ट पूर्ण झाले: ${summary.created} जोडले, ${summary.updated} अपडेट झाले, फाइलमधील ${summary.skippedDuplicate} डुप्लिकेट वगळले, ${summary.invalid} अवैध, मर्यादेमुळे ${summary.skippedLimit} वगळले.`,
    },
    table: {
      selectAllAria: "या पेजवरील सर्व कॉन्टॅक्ट निवडा",
      selectOneAria: (name) => `${name} निवडा`,
      colName: "नाव",
      colCategory: "श्रेणी",
      colPhone: "फोन",
      colNextOccasion: "पुढील प्रसंग",
      colStatus: "स्टेटस",
      colActionsSr: "कृती",
      edit: "संपादित करा",
      active: "सक्रिय",
      inactive: "निष्क्रिय",
      emptyDash: "—",
    },
    emptyState: {
      noMatchingTitle: "जुळणारा कॉन्टॅक्ट नाही",
      noContactsTitle: "अजून कोणतेही कॉन्टॅक्ट नाहीत",
      tryDifferentSearch: "वेगळा शोध करून पाहा किंवा फिल्टर हटवा.",
      startByAdding: "तुमचा पहिला कॉन्टॅक्ट जोडून सुरुवात करा किंवा CSV मधून इंपोर्ट करा.",
      addContactAction: "कॉन्टॅक्ट जोडा",
    },
    pagination: {
      pageOf: (page, totalPages, total) => `पेज ${page} / ${totalPages} (एकूण ${total})`,
      selectedAcrossPages: (count) => ` · ${count} पेजेसमध्ये निवडले`,
      previous: "मागील",
      next: "पुढील",
    },
    loadingAria: "कॉन्टॅक्ट लोड होत आहेत",
  },
};

export function getContactsDict(locale: Locale): ContactsDict {
  return CONTACTS_DICT[locale];
}
