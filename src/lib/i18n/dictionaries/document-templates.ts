import type { Locale } from "../constants";

export type DocumentTemplatesDict = {
  pageList: {
    title: string;
    description: string;
    generatedDocuments: string;
    couldNotLoad: string;
    couldNotLoadConn: string;
    chooseFile: string;
    couldNotUpload: string;
    couldNotUploadConn: string;
    couldNotRename: string;
    couldNotRenameConn: string;
    confirmDelete: (name: string) => string;
    couldNotDelete: string;
    couldNotDeleteConn: string;
    nameLabel: string;
    namePlaceholder: string;
    occasionLabel: string;
    noneOption: string;
    pdfFileLabel: string;
    uploading: string;
    upload: string;
    loading: string;
    empty: string;
    colName: string;
    colOccasion: string;
    colFile: string;
    colStatus: string;
    colActionsSr: string;
    active: string;
    inactive: string;
    save: string;
    cancel: string;
    preview: string;
    editLayout: string;
    rename: string;
    delete: string;
    emptyDash: string;
  };
  editor: {
    couldNotLoadTemplate: string;
    couldNotLoadEditorConn: string;
    couldNotSaveLayout: string;
    couldNotSaveLayoutConn: string;
    couldNotGenerate: string;
    couldNotGenerateConn: string;
    defaultTemplateName: string;
    loadingEditor: string;
    newTextDefault: string;
  };
  toolbar: {
    hint: string;
    saved: string;
    back: string;
    addText: string;
    saving: string;
    saveLayout: string;
  };
  generatePanel: {
    title: string;
    hint: string;
    noVariables: string;
    generatedSaved: string;
    viewInGenerated: string;
    generating: string;
    generate: string;
  };
  pdfViewer: {
    couldNotLoad: string;
    loading: string;
  };
  textBox: {
    deleteAria: string;
  };
  typographyPanel: {
    selectPrompt: string;
    formatLabel: string;
    fontSizeAria: string;
    decreaseFontSizeAria: string;
    increaseFontSizeAria: string;
    boldAria: string;
    italicAria: string;
    underlineAria: string;
    alignLeft: string;
    alignCenter: string;
    alignRight: string;
    alignAria: (alignLabel: string) => string;
    colorLabel: string;
    colorAria: string;
  };
  variablePanel: {
    selectPrompt: string;
    insertPrompt: string;
  };
};

const DOCUMENT_TEMPLATES_DICT: Record<Locale, DocumentTemplatesDict> = {
  en: {
    pageList: {
      title: "Document Templates",
      description:
        "Upload a base PDF design, lay out text and variables in the editor, then generate personalized PDFs.",
      generatedDocuments: "Generated Documents",
      couldNotLoad: "Could not load document templates.",
      couldNotLoadConn:
        "Could not load document templates. Check your connection and try again.",
      chooseFile: "Choose a PDF file to upload.",
      couldNotUpload: "Could not upload PDF template.",
      couldNotUploadConn:
        "Could not upload PDF template. Check your connection and try again.",
      couldNotRename: "Could not rename template.",
      couldNotRenameConn:
        "Could not rename template. Check your connection and try again.",
      confirmDelete: (name) => `Delete "${name}"? This cannot be undone.`,
      couldNotDelete: "Could not delete template.",
      couldNotDeleteConn:
        "Could not delete template. Check your connection and try again.",
      nameLabel: "Name",
      namePlaceholder: "Birthday Card",
      occasionLabel: "Occasion (optional)",
      noneOption: "None",
      pdfFileLabel: "PDF file",
      uploading: "Uploading...",
      upload: "Upload",
      loading: "Loading document templates...",
      empty: "No document templates yet. Upload a PDF above to get started.",
      colName: "Name",
      colOccasion: "Occasion",
      colFile: "File",
      colStatus: "Status",
      colActionsSr: "Actions",
      active: "Active",
      inactive: "Inactive",
      save: "Save",
      cancel: "Cancel",
      preview: "Preview",
      editLayout: "Edit Layout",
      rename: "Rename",
      delete: "Delete",
      emptyDash: "—",
    },
    editor: {
      couldNotLoadTemplate: "Could not load document template.",
      couldNotLoadEditorConn:
        "Could not load the editor. Check your connection and try again.",
      couldNotSaveLayout: "Could not save layout.",
      couldNotSaveLayoutConn:
        "Could not save layout. Check your connection and try again.",
      couldNotGenerate: "Could not generate PDF.",
      couldNotGenerateConn:
        "Could not generate PDF. Check your connection and try again.",
      defaultTemplateName: "Document Template",
      loadingEditor: "Loading editor...",
      newTextDefault: "New Text",
    },
    toolbar: {
      hint: "Drag text boxes onto the PDF, then save the layout.",
      saved: "Saved",
      back: "Back",
      addText: "Add Text",
      saving: "Saving...",
      saveLayout: "Save Layout",
    },
    generatePanel: {
      title: "Generate PDF",
      hint: "Fill in the values below, then generate a personalized PDF. It's saved for 7 days in Generated Documents.",
      noVariables:
        "This layout has no variables - generating will use the text as written.",
      generatedSaved: "Generated and saved.",
      viewInGenerated: "View in Generated Documents",
      generating: "Generating...",
      generate: "Generate PDF",
    },
    pdfViewer: {
      couldNotLoad: "Could not load this PDF.",
      loading: "Loading PDF...",
    },
    textBox: {
      deleteAria: "Delete text box",
    },
    typographyPanel: {
      selectPrompt: "Select a text box to format it:",
      formatLabel: "Format:",
      fontSizeAria: "Font size",
      decreaseFontSizeAria: "Decrease font size",
      increaseFontSizeAria: "Increase font size",
      boldAria: "Bold",
      italicAria: "Italic",
      underlineAria: "Underline",
      alignLeft: "Left",
      alignCenter: "Center",
      alignRight: "Right",
      alignAria: (alignLabel) => `Align ${alignLabel.toLowerCase()}`,
      colorLabel: "Color",
      colorAria: "Text color",
    },
    variablePanel: {
      selectPrompt: "Click into a text box to insert a variable:",
      insertPrompt: "Insert variable:",
    },
  },
  hi: {
    pageList: {
      title: "डॉक्यूमेंट टेम्पलेट",
      description:
        "एक बेस पीडीएफ डिज़ाइन अपलोड करें, एडिटर में टेक्स्ट और वेरिएबल लगाएँ, फिर पर्सनलाइज़्ड पीडीएफ जनरेट करें।",
      generatedDocuments: "जनरेट किए गए डॉक्यूमेंट",
      couldNotLoad: "डॉक्यूमेंट टेम्पलेट लोड नहीं हो सके।",
      couldNotLoadConn:
        "डॉक्यूमेंट टेम्पलेट लोड नहीं हो सके। अपना कनेक्शन जाँचें और फिर कोशिश करें।",
      chooseFile: "अपलोड करने के लिए एक पीडीएफ फ़ाइल चुनें।",
      couldNotUpload: "पीडीएफ टेम्पलेट अपलोड नहीं हो सका।",
      couldNotUploadConn:
        "पीडीएफ टेम्पलेट अपलोड नहीं हो सका। अपना कनेक्शन जाँचें और फिर कोशिश करें।",
      couldNotRename: "टेम्पलेट का नाम नहीं बदल सका।",
      couldNotRenameConn:
        "टेम्पलेट का नाम नहीं बदल सका। अपना कनेक्शन जाँचें और फिर कोशिश करें।",
      confirmDelete: (name) => `"${name}" को हटाएँ? यह वापस नहीं हो सकता।`,
      couldNotDelete: "टेम्पलेट हटाया नहीं जा सका।",
      couldNotDeleteConn:
        "टेम्पलेट हटाया नहीं जा सका। अपना कनेक्शन जाँचें और फिर कोशिश करें।",
      nameLabel: "नाम",
      namePlaceholder: "बर्थडे कार्ड",
      occasionLabel: "अवसर (वैकल्पिक)",
      noneOption: "कोई नहीं",
      pdfFileLabel: "पीडीएफ फ़ाइल",
      uploading: "अपलोड हो रहा है...",
      upload: "अपलोड करें",
      loading: "डॉक्यूमेंट टेम्पलेट लोड हो रहे हैं...",
      empty: "अभी तक कोई डॉक्यूमेंट टेम्पलेट नहीं है। शुरू करने के लिए ऊपर एक पीडीएफ अपलोड करें।",
      colName: "नाम",
      colOccasion: "अवसर",
      colFile: "फ़ाइल",
      colStatus: "स्टेटस",
      colActionsSr: "कार्रवाई",
      active: "एक्टिव",
      inactive: "इनएक्टिव",
      save: "सेव करें",
      cancel: "रद्द करें",
      preview: "प्रीव्यू",
      editLayout: "लेआउट एडिट करें",
      rename: "नाम बदलें",
      delete: "हटाएँ",
      emptyDash: "—",
    },
    editor: {
      couldNotLoadTemplate: "डॉक्यूमेंट टेम्पलेट लोड नहीं हो सका।",
      couldNotLoadEditorConn:
        "एडिटर लोड नहीं हो सका। अपना कनेक्शन जाँचें और फिर कोशिश करें।",
      couldNotSaveLayout: "लेआउट सेव नहीं हो सका।",
      couldNotSaveLayoutConn:
        "लेआउट सेव नहीं हो सका। अपना कनेक्शन जाँचें और फिर कोशिश करें।",
      couldNotGenerate: "पीडीएफ जनरेट नहीं हो सका।",
      couldNotGenerateConn:
        "पीडीएफ जनरेट नहीं हो सका। अपना कनेक्शन जाँचें और फिर कोशिश करें।",
      defaultTemplateName: "डॉक्यूमेंट टेम्पलेट",
      loadingEditor: "एडिटर लोड हो रहा है...",
      newTextDefault: "नया टेक्स्ट",
    },
    toolbar: {
      hint: "टेक्स्ट बॉक्स को पीडीएफ पर खींचकर रखें, फिर लेआउट सेव करें।",
      saved: "सेव हो गया",
      back: "पीछे",
      addText: "टेक्स्ट जोड़ें",
      saving: "सेव हो रहा है...",
      saveLayout: "लेआउट सेव करें",
    },
    generatePanel: {
      title: "पीडीएफ जनरेट करें",
      hint: "नीचे वैल्यू भरें, फिर एक पर्सनलाइज़्ड पीडीएफ जनरेट करें। यह जनरेट किए गए डॉक्यूमेंट में 7 दिन के लिए सेव रहता है।",
      noVariables: "इस लेआउट में कोई वेरिएबल नहीं है - जनरेट करने पर टेक्स्ट जैसा लिखा है वैसा ही इस्तेमाल होगा।",
      generatedSaved: "जनरेट होकर सेव हो गया।",
      viewInGenerated: "जनरेट किए गए डॉक्यूमेंट में देखें",
      generating: "जनरेट हो रहा है...",
      generate: "पीडीएफ जनरेट करें",
    },
    pdfViewer: {
      couldNotLoad: "यह पीडीएफ लोड नहीं हो सका।",
      loading: "पीडीएफ लोड हो रहा है...",
    },
    textBox: {
      deleteAria: "टेक्स्ट बॉक्स हटाएँ",
    },
    typographyPanel: {
      selectPrompt: "फ़ॉर्मेट करने के लिए एक टेक्स्ट बॉक्स चुनें:",
      formatLabel: "फ़ॉर्मेट:",
      fontSizeAria: "फ़ॉन्ट साइज़",
      decreaseFontSizeAria: "फ़ॉन्ट साइज़ घटाएँ",
      increaseFontSizeAria: "फ़ॉन्ट साइज़ बढ़ाएँ",
      boldAria: "बोल्ड",
      italicAria: "इटैलिक",
      underlineAria: "अंडरलाइन",
      alignLeft: "बाएँ",
      alignCenter: "बीच में",
      alignRight: "दाएँ",
      alignAria: (alignLabel) => `${alignLabel} अलाइन करें`,
      colorLabel: "रंग",
      colorAria: "टेक्स्ट का रंग",
    },
    variablePanel: {
      selectPrompt: "वेरिएबल डालने के लिए किसी टेक्स्ट बॉक्स में क्लिक करें:",
      insertPrompt: "वेरिएबल डालें:",
    },
  },
  mr: {
    pageList: {
      title: "डॉक्युमेंट टेम्पलेट",
      description:
        "बेस पीडीएफ डिझाइन अपलोड करा, एडिटरमध्ये टेक्स्ट आणि व्हेरिएबल्स मांडा, नंतर पर्सनलाइझ्ड पीडीएफ तयार करा.",
      generatedDocuments: "तयार केलेले डॉक्युमेंट",
      couldNotLoad: "डॉक्युमेंट टेम्पलेट लोड होऊ शकले नाहीत.",
      couldNotLoadConn:
        "डॉक्युमेंट टेम्पलेट लोड होऊ शकले नाहीत. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.",
      chooseFile: "अपलोड करण्यासाठी एक पीडीएफ फाइल निवडा.",
      couldNotUpload: "पीडीएफ टेम्पलेट अपलोड होऊ शकले नाही.",
      couldNotUploadConn:
        "पीडीएफ टेम्पलेट अपलोड होऊ शकले नाही. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.",
      couldNotRename: "टेम्पलेटचे नाव बदलता आले नाही.",
      couldNotRenameConn:
        "टेम्पलेटचे नाव बदलता आले नाही. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.",
      confirmDelete: (name) => `"${name}" हटवायचे? हे परत करता येणार नाही.`,
      couldNotDelete: "टेम्पलेट हटवता आले नाही.",
      couldNotDeleteConn:
        "टेम्पलेट हटवता आले नाही. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.",
      nameLabel: "नाव",
      namePlaceholder: "बर्थडे कार्ड",
      occasionLabel: "प्रसंग (ऐच्छिक)",
      noneOption: "काहीही नाही",
      pdfFileLabel: "पीडीएफ फाइल",
      uploading: "अपलोड होत आहे...",
      upload: "अपलोड करा",
      loading: "डॉक्युमेंट टेम्पलेट लोड होत आहेत...",
      empty: "अजून कोणतेही डॉक्युमेंट टेम्पलेट नाही. सुरुवात करण्यासाठी वर एक पीडीएफ अपलोड करा.",
      colName: "नाव",
      colOccasion: "प्रसंग",
      colFile: "फाइल",
      colStatus: "स्टेटस",
      colActionsSr: "कृती",
      active: "अ‍ॅक्टिव्ह",
      inactive: "इनअ‍ॅक्टिव्ह",
      save: "सेव्ह करा",
      cancel: "रद्द करा",
      preview: "प्रीव्ह्यू",
      editLayout: "लेआउट एडिट करा",
      rename: "नाव बदला",
      delete: "हटवा",
      emptyDash: "—",
    },
    editor: {
      couldNotLoadTemplate: "डॉक्युमेंट टेम्पलेट लोड होऊ शकले नाही.",
      couldNotLoadEditorConn:
        "एडिटर लोड होऊ शकला नाही. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.",
      couldNotSaveLayout: "लेआउट सेव्ह होऊ शकला नाही.",
      couldNotSaveLayoutConn:
        "लेआउट सेव्ह होऊ शकला नाही. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.",
      couldNotGenerate: "पीडीएफ तयार होऊ शकला नाही.",
      couldNotGenerateConn:
        "पीडीएफ तयार होऊ शकला नाही. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.",
      defaultTemplateName: "डॉक्युमेंट टेम्पलेट",
      loadingEditor: "एडिटर लोड होत आहे...",
      newTextDefault: "नवीन मजकूर",
    },
    toolbar: {
      hint: "टेक्स्ट बॉक्सेस पीडीएफवर ड्रॅग करा, नंतर लेआउट सेव्ह करा.",
      saved: "सेव्ह झाले",
      back: "मागे",
      addText: "टेक्स्ट जोडा",
      saving: "सेव्ह होत आहे...",
      saveLayout: "लेआउट सेव्ह करा",
    },
    generatePanel: {
      title: "पीडीएफ तयार करा",
      hint: "खालील व्हॅल्यूज भरा, नंतर पर्सनलाइझ्ड पीडीएफ तयार करा. हा तयार केलेल्या डॉक्युमेंटमध्ये 7 दिवसांसाठी सेव्ह होतो.",
      noVariables: "या लेआउटमध्ये कोणतेही व्हेरिएबल नाही - तयार करताना टेक्स्ट जसा लिहिला आहे तसाच वापरला जाईल.",
      generatedSaved: "तयार होऊन सेव्ह झाले.",
      viewInGenerated: "तयार केलेल्या डॉक्युमेंटमध्ये पाहा",
      generating: "तयार होत आहे...",
      generate: "पीडीएफ तयार करा",
    },
    pdfViewer: {
      couldNotLoad: "हा पीडीएफ लोड होऊ शकला नाही.",
      loading: "पीडीएफ लोड होत आहे...",
    },
    textBox: {
      deleteAria: "टेक्स्ट बॉक्स हटवा",
    },
    typographyPanel: {
      selectPrompt: "फॉरमॅट करण्यासाठी एक टेक्स्ट बॉक्स निवडा:",
      formatLabel: "फॉरमॅट:",
      fontSizeAria: "फॉन्ट साइज़",
      decreaseFontSizeAria: "फॉन्ट साइज़ कमी करा",
      increaseFontSizeAria: "फॉन्ट साइज़ वाढवा",
      boldAria: "बोल्ड",
      italicAria: "इटॅलिक",
      underlineAria: "अंडरलाइन",
      alignLeft: "डावीकडे",
      alignCenter: "मध्यभागी",
      alignRight: "उजवीकडे",
      alignAria: (alignLabel) => `${alignLabel} अलाइन करा`,
      colorLabel: "रंग",
      colorAria: "टेक्स्टचा रंग",
    },
    variablePanel: {
      selectPrompt: "व्हेरिएबल घालण्यासाठी टेक्स्ट बॉक्समध्ये क्लिक करा:",
      insertPrompt: "व्हेरिएबल घाला:",
    },
  },
};

export function getDocumentTemplatesDict(locale: Locale): DocumentTemplatesDict {
  return DOCUMENT_TEMPLATES_DICT[locale];
}
