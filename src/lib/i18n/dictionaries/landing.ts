import type { Locale } from "../constants";

export type LandingDict = {
  nav: {
    features: string;
    howItWorks: string;
    useCases: string;
    contact: string;
    getStarted: string;
  };
  hero: {
    brandSignal: string;
    heading: string;
    subtitle: string;
    getStarted: string;
    contactUs: string;
    filename: string;
    cardEyebrow: string;
    cardName: string;
    cardHeadline: string;
    cardBody: string;
    cardMetaLabel: string;
  };
  whatItDoes: {
    heading: string;
    lead: string;
    flowTemplate: string;
    flowVariables: string;
    flowRecipientData: string;
    flowPersonalizedPdf: string;
  };
  features: {
    heading: string;
    lead: string;
    items: Array<{ title: string; body: string }>;
    dynamicVariablesPrefix: string;
    dynamicVariablesJoiner: string;
    dynamicVariablesSuffix: string;
  };
  howItWorks: {
    heading: string;
    lead: string;
    steps: Array<{ title: string; body: string }>;
    personalizeStepPrefix: string;
    personalizeStepSuffix: string;
  };
  preview: {
    heading: string;
    lead: string;
    editorChrome: string;
    editorRailText: string;
    editorRailVariables: string;
    editorRailLayers: string;
    editorCanvasHeadline: string;
    editorCanvasWarmWishes: string;
    editorCaption: string;
    variablesChrome: string;
    variablesDear: string;
    variablesContact: string;
    variablesResolvedDear: string;
    variablesResolvedContact: string;
    variablesCaption: string;
    resultChrome: string;
    resultEyebrow: string;
    resultName: string;
    resultBody: string;
    resultFooter: string;
    resultCaption: string;
  };
  useCases: {
    heading: string;
    lead: string;
    items: string[];
  };
  cta: {
    heading: string;
    body: string;
    getStarted: string;
  };
  contact: {
    heading: string;
    lead: string;
  };
  footer: {
    copyright: string;
  };
};

const LANDING_DICT: Record<Locale, LandingDict> = {
  en: {
    nav: {
      features: "Features",
      howItWorks: "How It Works",
      useCases: "Use Cases",
      contact: "Contact",
      getStarted: "Get Started",
    },
    hero: {
      brandSignal: "Birthday Greeting",
      heading: "Create Personalized Greetings. Effortlessly.",
      subtitle:
        "Design beautiful greeting templates once, personalize them with dynamic information, and generate professional PDFs for every recipient.",
      getStarted: "Get Started",
      contactUs: "Contact Us",
      filename: "birthday-greeting.pdf",
      cardEyebrow: "A special note for",
      cardName: "Priya Sharma",
      cardHeadline: "Happy Birthday",
      cardBody:
        "Wishing you a wonderful year ahead. With warm regards from the team.",
      cardMetaLabel: "Mobile",
    },
    whatItDoes: {
      heading: "Personalized documents without the repetitive work.",
      lead: "Create a reusable PDF template, add text boxes and dynamic variables, provide recipient information, and generate a personalized PDF — without rebuilding the design each time.",
      flowTemplate: "Template",
      flowVariables: "Variables",
      flowRecipientData: "Recipient Data",
      flowPersonalizedPdf: "Personalized PDF",
    },
    features: {
      heading: "Everything you need to personalize documents",
      lead: "A focused toolkit for designing templates and generating recipient-ready PDFs.",
      items: [
        { title: "Design Templates", body: "Create reusable branded PDF templates." },
        { title: "Visual Editor", body: "Add, move and resize text boxes." },
        {
          title: "Dynamic Variables",
          body: "Use variables such as {{name}} and {{mobile}}.",
        },
        {
          title: "Personalized PDFs",
          body: "Generate a personalized PDF for each recipient.",
        },
      ],
      dynamicVariablesPrefix: "Use variables such as ",
      dynamicVariablesJoiner: " and ",
      dynamicVariablesSuffix: ".",
    },
    howItWorks: {
      heading: "How it works",
      lead: "Four clear steps from blank template to finished document.",
      steps: [
        { title: "Create", body: "Upload your blank PDF template." },
        { title: "Design", body: "Add and position your text boxes." },
        { title: "Personalize", body: "" },
        {
          title: "Generate",
          body: "Provide recipient data and generate the final PDF.",
        },
      ],
      personalizeStepPrefix: "Add variables such as ",
      personalizeStepSuffix: ".",
    },
    preview: {
      heading: "See the product",
      lead: "From editor to variables to the finished personalized PDF.",
      editorChrome: "Template Editor",
      editorRailText: "Text",
      editorRailVariables: "Variables",
      editorRailLayers: "Layers",
      editorCanvasHeadline: "Happy Birthday",
      editorCanvasWarmWishes: "With warm wishes",
      editorCaption: "Template editor — place and resize text boxes on your PDF.",
      variablesChrome: "Variables",
      variablesDear: "Dear",
      variablesContact: "Contact:",
      variablesResolvedDear: "→ Dear Ananya Mehta,",
      variablesResolvedContact: "→ Contact: +91 91234 56789",
      variablesCaption:
        "Dynamic variables — highlight placeholders and map recipient fields.",
      resultChrome: "Generated PDF",
      resultEyebrow: "Certificate of Appreciation",
      resultName: "Rohan Patel",
      resultBody: "In recognition of outstanding contribution and dedication.",
      resultFooter: "Generated document · Ready to download",
      resultCaption: "Personalized PDF — one finished document per recipient.",
    },
    useCases: {
      heading: "Built for more than birthdays.",
      lead: "Use the same template workflow for greetings, recognition, and everyday documents.",
      items: [
        "Birthday Greetings",
        "Anniversary Greetings",
        "Certificates",
        "Employee Recognition",
        "Customer Communication",
        "Events & Occasions",
      ],
    },
    cta: {
      heading: "Create your first personalized greeting.",
      body: "Build a reusable template and turn it into personalized documents in minutes.",
      getStarted: "Get Started",
    },
    contact: {
      heading: "Have questions? Let's talk.",
      lead: "Reach out by phone — we're happy to walk you through the product.",
    },
    footer: {
      copyright: "© 2026 Birthday Greeting",
    },
  },
  hi: {
    nav: {
      features: "फ़ीचर्स",
      howItWorks: "यह कैसे काम करता है",
      useCases: "उपयोग के मामले",
      contact: "संपर्क",
      getStarted: "शुरू करें",
    },
    hero: {
      brandSignal: "Birthday Greeting",
      heading: "आसानी से पर्सनलाइज़्ड ग्रीटिंग बनाएँ।",
      subtitle:
        "एक बार सुंदर ग्रीटिंग टेम्पलेट डिज़ाइन करें, डायनामिक जानकारी से पर्सनलाइज़ करें, और हर प्राप्तकर्ता के लिए प्रोफ़ेशनल PDF बनाएँ।",
      getStarted: "शुरू करें",
      contactUs: "संपर्क करें",
      filename: "birthday-greeting.pdf",
      cardEyebrow: "एक खास संदेश",
      cardName: "Priya Sharma",
      cardHeadline: "जन्मदिन मुबारक",
      cardBody:
        "आपका आने वाला साल शानदार हो। टीम की ओर से हार्दिक शुभकामनाएँ।",
      cardMetaLabel: "मोबाइल",
    },
    whatItDoes: {
      heading: "बार-बार का काम किए बिना पर्सनलाइज़्ड दस्तावेज़।",
      lead: "एक पुन: प्रयोज्य PDF टेम्पलेट बनाएँ, टेक्स्ट बॉक्स और डायनामिक वेरिएबल जोड़ें, प्राप्तकर्ता की जानकारी दें, और हर बार डिज़ाइन दोबारा बनाए बिना पर्सनलाइज़्ड PDF बनाएँ।",
      flowTemplate: "टेम्पलेट",
      flowVariables: "वेरिएबल",
      flowRecipientData: "प्राप्तकर्ता डेटा",
      flowPersonalizedPdf: "पर्सनलाइज़्ड PDF",
    },
    features: {
      heading: "दस्तावेज़ पर्सनलाइज़ करने के लिए जो भी चाहिए",
      lead: "टेम्पलेट डिज़ाइन करने और प्राप्तकर्ता-तैयार PDF बनाने के लिए एक फ़ोकस्ड टूलकिट।",
      items: [
        { title: "टेम्पलेट डिज़ाइन करें", body: "पुन: प्रयोज्य ब्रांडेड PDF टेम्पलेट बनाएँ।" },
        { title: "विज़ुअल एडिटर", body: "टेक्स्ट बॉक्स जोड़ें, हिलाएँ और आकार बदलें।" },
        {
          title: "डायनामिक वेरिएबल",
          body: "{{name}} और {{mobile}} जैसे वेरिएबल इस्तेमाल करें।",
        },
        {
          title: "पर्सनलाइज़्ड PDF",
          body: "हर प्राप्तकर्ता के लिए एक पर्सनलाइज़्ड PDF बनाएँ।",
        },
      ],
      dynamicVariablesPrefix: "ऐसे वेरिएबल इस्तेमाल करें जैसे ",
      dynamicVariablesJoiner: " और ",
      dynamicVariablesSuffix: "।",
    },
    howItWorks: {
      heading: "यह कैसे काम करता है",
      lead: "खाली टेम्पलेट से तैयार दस्तावेज़ तक चार आसान कदम।",
      steps: [
        { title: "बनाएँ", body: "अपना खाली PDF टेम्पलेट अपलोड करें।" },
        { title: "डिज़ाइन करें", body: "अपने टेक्स्ट बॉक्स जोड़ें और सेट करें।" },
        { title: "पर्सनलाइज़ करें", body: "" },
        {
          title: "जनरेट करें",
          body: "प्राप्तकर्ता डेटा दें और अंतिम PDF बनाएँ।",
        },
      ],
      personalizeStepPrefix: "ऐसे वेरिएबल जोड़ें जैसे ",
      personalizeStepSuffix: "।",
    },
    preview: {
      heading: "प्रोडक्ट देखें",
      lead: "एडिटर से वेरिएबल तक और फिर तैयार पर्सनलाइज़्ड PDF तक।",
      editorChrome: "टेम्पलेट एडिटर",
      editorRailText: "टेक्स्ट",
      editorRailVariables: "वेरिएबल",
      editorRailLayers: "लेयर्स",
      editorCanvasHeadline: "जन्मदिन मुबारक",
      editorCanvasWarmWishes: "हार्दिक शुभकामनाओं सहित",
      editorCaption: "टेम्पलेट एडिटर — अपने PDF पर टेक्स्ट बॉक्स रखें और आकार बदलें।",
      variablesChrome: "वेरिएबल",
      variablesDear: "प्रिय",
      variablesContact: "संपर्क:",
      variablesResolvedDear: "→ प्रिय Ananya Mehta,",
      variablesResolvedContact: "→ संपर्क: +91 91234 56789",
      variablesCaption:
        "डायनामिक वेरिएबल — प्लेसहोल्डर हाइलाइट करें और प्राप्तकर्ता फ़ील्ड मैप करें।",
      resultChrome: "जनरेटेड PDF",
      resultEyebrow: "सराहना प्रमाणपत्र",
      resultName: "Rohan Patel",
      resultBody: "उत्कृष्ट योगदान और समर्पण की सराहना में।",
      resultFooter: "जनरेटेड दस्तावेज़ · डाउनलोड के लिए तैयार",
      resultCaption: "पर्सनलाइज़्ड PDF — हर प्राप्तकर्ता के लिए एक तैयार दस्तावेज़।",
    },
    useCases: {
      heading: "सिर्फ़ जन्मदिन ही नहीं, और भी बहुत कुछ के लिए।",
      lead: "ग्रीटिंग, सराहना और रोज़मर्रा के दस्तावेज़ों के लिए वही टेम्पलेट वर्कफ़्लो इस्तेमाल करें।",
      items: [
        "जन्मदिन की ग्रीटिंग",
        "वर्षगाँठ की ग्रीटिंग",
        "प्रमाणपत्र",
        "कर्मचारी सराहना",
        "ग्राहक संचार",
        "इवेंट्स और अवसर",
      ],
    },
    cta: {
      heading: "अपनी पहली पर्सनलाइज़्ड ग्रीटिंग बनाएँ।",
      body: "एक पुन: प्रयोज्य टेम्पलेट बनाएँ और मिनटों में इसे पर्सनलाइज़्ड दस्तावेज़ों में बदलें।",
      getStarted: "शुरू करें",
    },
    contact: {
      heading: "सवाल हैं? बात करते हैं।",
      lead: "फ़ोन पर संपर्क करें — हम खुशी से आपको प्रोडक्ट समझाएँगे।",
    },
    footer: {
      copyright: "© 2026 Birthday Greeting",
    },
  },
  mr: {
    nav: {
      features: "वैशिष्ट्ये",
      howItWorks: "हे कसे काम करते",
      useCases: "वापर प्रकार",
      contact: "संपर्क",
      getStarted: "सुरुवात करा",
    },
    hero: {
      brandSignal: "Birthday Greeting",
      heading: "सहजपणे पर्सनलाइझ्ड ग्रीटिंग तयार करा.",
      subtitle:
        "एकदा सुंदर ग्रीटिंग टेम्पलेट डिझाइन करा, डायनॅमिक माहितीने पर्सनलाइझ करा, आणि प्रत्येक प्राप्तकर्त्यासाठी प्रोफेशनल PDF तयार करा.",
      getStarted: "सुरुवात करा",
      contactUs: "संपर्क करा",
      filename: "birthday-greeting.pdf",
      cardEyebrow: "एक खास निरोप",
      cardName: "Priya Sharma",
      cardHeadline: "वाढदिवसाच्या शुभेच्छा",
      cardBody: "तुमचे येणारे वर्ष उत्तम जावो. टीमकडून मनःपूर्वक शुभेच्छा.",
      cardMetaLabel: "मोबाइल",
    },
    whatItDoes: {
      heading: "पुनरावृत्तीचे काम न करता पर्सनलाइझ्ड कागदपत्रे.",
      lead: "पुन्हा वापरता येणारा PDF टेम्पलेट तयार करा, टेक्स्ट बॉक्स आणि डायनॅमिक व्हेरिएबल्स जोडा, प्राप्तकर्त्याची माहिती द्या, आणि दरवेळी डिझाइन पुन्हा न बनवता पर्सनलाइझ्ड PDF तयार करा.",
      flowTemplate: "टेम्पलेट",
      flowVariables: "व्हेरिएबल्स",
      flowRecipientData: "प्राप्तकर्ता डेटा",
      flowPersonalizedPdf: "पर्सनलाइझ्ड PDF",
    },
    features: {
      heading: "कागदपत्रे पर्सनलाइझ करण्यासाठी लागणारे सर्व काही",
      lead: "टेम्पलेट डिझाइन करण्यासाठी आणि प्राप्तकर्त्यासाठी तयार PDF तयार करण्यासाठी एक फोकस्ड टूलकिट.",
      items: [
        { title: "टेम्पलेट डिझाइन करा", body: "पुन्हा वापरता येणारे ब्रँडेड PDF टेम्पलेट तयार करा." },
        { title: "व्हिज्युअल एडिटर", body: "टेक्स्ट बॉक्स जोडा, हलवा आणि आकार बदला." },
        {
          title: "डायनॅमिक व्हेरिएबल्स",
          body: "{{name}} आणि {{mobile}} सारखी व्हेरिएबल्स वापरा.",
        },
        {
          title: "पर्सनलाइझ्ड PDF",
          body: "प्रत्येक प्राप्तकर्त्यासाठी पर्सनलाइझ्ड PDF तयार करा.",
        },
      ],
      dynamicVariablesPrefix: "अशी व्हेरिएबल्स वापरा जसे की ",
      dynamicVariablesJoiner: " आणि ",
      dynamicVariablesSuffix: ".",
    },
    howItWorks: {
      heading: "हे कसे काम करते",
      lead: "रिकाम्या टेम्पलेटपासून तयार कागदपत्रापर्यंत चार सोपे टप्पे.",
      steps: [
        { title: "तयार करा", body: "तुमचा रिकामा PDF टेम्पलेट अपलोड करा." },
        { title: "डिझाइन करा", body: "तुमचे टेक्स्ट बॉक्स जोडा आणि सेट करा." },
        { title: "पर्सनलाइझ करा", body: "" },
        {
          title: "जनरेट करा",
          body: "प्राप्तकर्ता डेटा द्या आणि अंतिम PDF तयार करा.",
        },
      ],
      personalizeStepPrefix: "अशी व्हेरिएबल्स जोडा जसे की ",
      personalizeStepSuffix: ".",
    },
    preview: {
      heading: "प्रोडक्ट पाहा",
      lead: "एडिटरपासून व्हेरिएबल्सपर्यंत आणि नंतर तयार पर्सनलाइझ्ड PDF पर्यंत.",
      editorChrome: "टेम्पलेट एडिटर",
      editorRailText: "टेक्स्ट",
      editorRailVariables: "व्हेरिएबल्स",
      editorRailLayers: "लेयर्स",
      editorCanvasHeadline: "वाढदिवसाच्या शुभेच्छा",
      editorCanvasWarmWishes: "मनःपूर्वक शुभेच्छांसह",
      editorCaption: "टेम्पलेट एडिटर — तुमच्या PDF वर टेक्स्ट बॉक्स ठेवा आणि आकार बदला.",
      variablesChrome: "व्हेरिएबल्स",
      variablesDear: "प्रिय",
      variablesContact: "संपर्क:",
      variablesResolvedDear: "→ प्रिय Ananya Mehta,",
      variablesResolvedContact: "→ संपर्क: +91 91234 56789",
      variablesCaption:
        "डायनॅमिक व्हेरिएबल्स — प्लेसहोल्डर हायलाइट करा आणि प्राप्तकर्ता फील्ड्स मॅप करा.",
      resultChrome: "जनरेटेड PDF",
      resultEyebrow: "प्रशंसा प्रमाणपत्र",
      resultName: "Rohan Patel",
      resultBody: "उत्कृष्ट योगदान आणि समर्पणाच्या सन्मानार्थ.",
      resultFooter: "जनरेटेड कागदपत्र · डाउनलोडसाठी तयार",
      resultCaption: "पर्सनलाइझ्ड PDF — प्रत्येक प्राप्तकर्त्यासाठी एक तयार कागदपत्र.",
    },
    useCases: {
      heading: "फक्त वाढदिवसांपुरते नाही, त्याहून अधिक.",
      lead: "ग्रीटिंग, सन्मान आणि रोजच्या कागदपत्रांसाठी तोच टेम्पलेट वर्कफ्लो वापरा.",
      items: [
        "वाढदिवस ग्रीटिंग",
        "वर्धापनदिन ग्रीटिंग",
        "प्रमाणपत्रे",
        "कर्मचारी सन्मान",
        "ग्राहक संवाद",
        "इव्हेंट्स आणि प्रसंग",
      ],
    },
    cta: {
      heading: "तुमची पहिली पर्सनलाइझ्ड ग्रीटिंग तयार करा.",
      body: "पुन्हा वापरता येणारा टेम्पलेट तयार करा आणि काही मिनिटांत पर्सनलाइझ्ड कागदपत्रांमध्ये बदला.",
      getStarted: "सुरुवात करा",
    },
    contact: {
      heading: "प्रश्न आहेत? बोलूया.",
      lead: "फोनवर संपर्क करा — आम्हाला तुम्हाला प्रोडक्ट दाखवायला आनंद होईल.",
    },
    footer: {
      copyright: "© 2026 Birthday Greeting",
    },
  },
};

export function getLandingDict(locale: Locale): LandingDict {
  return LANDING_DICT[locale];
}
