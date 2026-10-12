import type { Locale } from "../constants";

export type CallRecordingsDict = {
  heading: string;
  intro: string;
  gatewayMissing: string;
  howItWorksHeading: string;
  howItWorksSteps: string[];
  newRecordingHeading: string;
  name: string;
  namePlaceholder: string;
  occasion: string;
  message: string;
  record: string;
  stop: string;
  recording: (elapsed: string, limit: string) => string;
  uploadInstead: string;
  recordAgain: string;
  limitNote: (seconds: number) => string;
  microphoneBlocked: string;
  recordingUnsupported: string;
  save: string;
  saving: string;
  saved: string;
  failedToSave: string;
  failedToLoad: string;
  failedToDelete: string;
  nameRequired: string;
  audioRequired: string;
  listHeading: string;
  loading: string;
  empty: string;
  seconds: (count: number) => string;
  usedByRoutes: (count: number) => string;
  notUsed: string;
  delete: string;
  confirmDelete: (name: string) => string;
  deleted: string;
  setUpRoutes: string;
  gateway: {
    heading: string;
    intro: string;
    route: string;
    routeHint: string;
    callerId: string;
    callerIdHint: string;
    notConfigured: string;
    failedToLoad: string;
    failedToSave: string;
    savedSuccess: string;
  };
};

const CALL_RECORDINGS_DICT: Record<Locale, CallRecordingsDict> = {
  en: {
    heading: "Call recordings",
    intro:
      "Record a voice message once. On the occasion day, each contact gets a phone call that plays it.",
    gatewayMissing:
      "Calls are not set up yet. Save your call gateway details above, with Active ticked, or recordings you save here will not be played.",
    howItWorksHeading: "How to set up calls",
    howItWorksSteps: [
      "Get your voice gateway details from your provider's Voice API page: Base URL, send path, username, password, voice route and a verified caller ID.",
      "Enter them under \"Call gateway\", tick \"Active\" and press \"Save Configuration\".",
      "Record or upload your message below and save it for an occasion.",
      "Open Automatic greetings, tick \"Call\" for a group and choose the recording.",
      "Pick a send time between 9 AM and 9 PM. Calls are not placed outside those hours.",
    ],
    newRecordingHeading: "New recording",
    name: "Name",
    namePlaceholder: "e.g. Birthday wishes",
    occasion: "Occasion",
    message: "Voice message",
    record: "Record",
    stop: "Stop",
    recording: (elapsed, limit) => `Recording… ${elapsed} / ${limit}`,
    uploadInstead: "Upload an audio file",
    recordAgain: "Remove and start again",
    limitNote: (seconds) =>
      `Up to ${seconds} seconds. MP3, WAV, M4A and browser recordings are accepted.`,
    microphoneBlocked:
      "The microphone could not be used. Allow microphone access in your browser, or upload an audio file instead.",
    recordingUnsupported:
      "This browser cannot record audio. Upload an audio file instead.",
    save: "Save recording",
    saving: "Saving…",
    saved: "Recording saved. Choose it under Automatic greetings to start calling.",
    failedToSave: "Failed to save the recording",
    failedToLoad: "Failed to load call recordings",
    failedToDelete: "Failed to delete the recording",
    nameRequired: "Give the recording a name",
    audioRequired: "Record or upload a voice message first",
    listHeading: "Saved recordings",
    loading: "Loading recordings…",
    empty: "No recordings yet.",
    seconds: (count) => `${count} sec`,
    usedByRoutes: (count) =>
      count === 1 ? "Used by 1 automatic greeting" : `Used by ${count} automatic greetings`,
    notUsed: "Not used by any automatic greeting",
    delete: "Delete",
    confirmDelete: (name) =>
      `Delete the recording “${name}”? Automatic greetings that use it will stop calling.`,
    deleted: "Recording deleted",
    setUpRoutes: "Open Automatic greetings",
    gateway: {
      heading: "Call gateway",
      intro:
        "Your voice gateway account. Calls are placed through it and play your recorded message.",
      route: "Voice route",
      routeHint: "Exact voice route code from your provider.",
      callerId: "Caller ID",
      callerIdHint: "Must be a caller ID verified on your gateway account.",
      notConfigured:
        "Not configured - calls are unavailable until you save your gateway details",
      failedToLoad: "Failed to load Call channel configuration",
      failedToSave: "Failed to save Call channel configuration",
      savedSuccess: "Configuration saved successfully.",
    },
  },
  hi: {
    heading: "कॉल रिकॉर्डिंग",
    intro:
      "एक बार अपना वॉइस मैसेज रिकॉर्ड करें। अवसर के दिन हर संपर्क को फ़ोन कॉल जाती है जिसमें यह सुनाया जाता है।",
    gatewayMissing:
      "कॉल अभी सेट नहीं है। ऊपर अपने कॉल गेटवे की जानकारी \"एक्टिव\" चुनकर सेव करें, वरना यहाँ सेव की गई रिकॉर्डिंग नहीं चलेगी।",
    howItWorksHeading: "कॉल कैसे सेट करें",
    howItWorksSteps: [
      "अपने प्रोवाइडर के Voice API पेज से वॉइस गेटवे की जानकारी लें: Base URL, send path, यूज़रनेम, पासवर्ड, वॉइस रूट और वेरिफ़ाइड कॉलर ID।",
      "इन्हें \"कॉल गेटवे\" में भरें, \"एक्टिव\" चुनें और कॉन्फ़िगरेशन सेव करें।",
      "नीचे अपना मैसेज रिकॉर्ड या अपलोड करें और किसी अवसर के लिए सेव करें।",
      "ऑटोमेटिक ग्रीटिंग खोलें, किसी श्रेणी के लिए \"कॉल\" चुनें और रिकॉर्डिंग चुनें।",
      "सुबह 9 से रात 9 बजे के बीच का समय चुनें। इस समय के बाहर कॉल नहीं की जाती।",
    ],
    newRecordingHeading: "नई रिकॉर्डिंग",
    name: "नाम",
    namePlaceholder: "जैसे जन्मदिन की शुभकामनाएँ",
    occasion: "अवसर",
    message: "वॉइस मैसेज",
    record: "रिकॉर्ड करें",
    stop: "रोकें",
    recording: (elapsed, limit) => `रिकॉर्ड हो रहा है… ${elapsed} / ${limit}`,
    uploadInstead: "ऑडियो फ़ाइल अपलोड करें",
    recordAgain: "हटाएँ और फिर से शुरू करें",
    limitNote: (seconds) =>
      `अधिकतम ${seconds} सेकंड। MP3, WAV, M4A और ब्राउज़र रिकॉर्डिंग मान्य हैं।`,
    microphoneBlocked:
      "माइक्रोफ़ोन इस्तेमाल नहीं हो सका। ब्राउज़र में माइक्रोफ़ोन की अनुमति दें, या ऑडियो फ़ाइल अपलोड करें।",
    recordingUnsupported:
      "यह ब्राउज़र ऑडियो रिकॉर्ड नहीं कर सकता। ऑडियो फ़ाइल अपलोड करें।",
    save: "रिकॉर्डिंग सेव करें",
    saving: "सेव हो रहा है…",
    saved: "रिकॉर्डिंग सेव हो गई। कॉल शुरू करने के लिए इसे ऑटोमेटिक ग्रीटिंग में चुनें।",
    failedToSave: "रिकॉर्डिंग सेव नहीं हो सकी",
    failedToLoad: "कॉल रिकॉर्डिंग लोड नहीं हो सकीं",
    failedToDelete: "रिकॉर्डिंग डिलीट नहीं हो सकी",
    nameRequired: "रिकॉर्डिंग को नाम दें",
    audioRequired: "पहले वॉइस मैसेज रिकॉर्ड या अपलोड करें",
    listHeading: "सेव की गई रिकॉर्डिंग",
    loading: "रिकॉर्डिंग लोड हो रही हैं…",
    empty: "अभी कोई रिकॉर्डिंग नहीं है।",
    seconds: (count) => `${count} सेकंड`,
    usedByRoutes: (count) => `${count} ऑटोमेटिक ग्रीटिंग में इस्तेमाल हो रही है`,
    notUsed: "किसी ऑटोमेटिक ग्रीटिंग में इस्तेमाल नहीं हो रही",
    delete: "डिलीट करें",
    confirmDelete: (name) =>
      `रिकॉर्डिंग “${name}” डिलीट करें? इसे इस्तेमाल करने वाले ऑटोमेटिक ग्रीटिंग कॉल करना बंद कर देंगे।`,
    deleted: "रिकॉर्डिंग डिलीट हो गई",
    setUpRoutes: "ऑटोमेटिक ग्रीटिंग खोलें",
    gateway: {
      heading: "कॉल गेटवे",
      intro:
        "आपका वॉइस गेटवे अकाउंट। कॉल इसी से की जाती हैं और आपका रिकॉर्ड किया हुआ मैसेज सुनाया जाता है।",
      route: "वॉइस रूट",
      routeHint: "आपके प्रोवाइडर से मिला सटीक वॉइस रूट कोड।",
      callerId: "कॉलर ID",
      callerIdHint: "यह आपके गेटवे अकाउंट पर वेरिफ़ाइड कॉलर ID होनी चाहिए।",
      notConfigured:
        "कॉन्फ़िगर नहीं है - गेटवे की जानकारी सेव करने तक कॉल उपलब्ध नहीं है",
      failedToLoad: "कॉल चैनल कॉन्फ़िगरेशन लोड नहीं हो सका",
      failedToSave: "कॉल चैनल कॉन्फ़िगरेशन सेव नहीं हो सका",
      savedSuccess: "कॉन्फ़िगरेशन सेव हो गया।",
    },
  },
  mr: {
    heading: "कॉल रेकॉर्डिंग",
    intro:
      "तुमचा व्हॉइस मेसेज एकदा रेकॉर्ड करा. प्रसंगाच्या दिवशी प्रत्येक संपर्काला फोन कॉल जातो आणि तो ऐकवला जातो.",
    gatewayMissing:
      "कॉल अजून सेट केलेले नाहीत. वर तुमच्या कॉल गेटवेची माहिती \"एक्टिव\" निवडून सेव्ह करा, नाहीतर इथे सेव्ह केलेली रेकॉर्डिंग वाजणार नाही.",
    howItWorksHeading: "कॉल कसे सेट करायचे",
    howItWorksSteps: [
      "तुमच्या प्रोव्हायडरच्या Voice API पेजवरून व्हॉइस गेटवेची माहिती घ्या: Base URL, send path, युजरनेम, पासवर्ड, व्हॉइस रूट आणि व्हेरिफाइड कॉलर ID.",
      "ती \"कॉल गेटवे\" मध्ये भरा, \"एक्टिव\" निवडा आणि कॉन्फिगरेशन सेव्ह करा.",
      "खाली तुमचा मेसेज रेकॉर्ड किंवा अपलोड करा आणि एखाद्या प्रसंगासाठी सेव्ह करा.",
      "ऑटोमॅटिक ग्रीटिंग उघडा, एखाद्या श्रेणीसाठी \"कॉल\" निवडा आणि रेकॉर्डिंग निवडा.",
      "सकाळी 9 ते रात्री 9 दरम्यानची वेळ निवडा. या वेळेबाहेर कॉल केले जात नाहीत.",
    ],
    newRecordingHeading: "नवीन रेकॉर्डिंग",
    name: "नाव",
    namePlaceholder: "उदा. वाढदिवसाच्या शुभेच्छा",
    occasion: "प्रसंग",
    message: "व्हॉइस मेसेज",
    record: "रेकॉर्ड करा",
    stop: "थांबवा",
    recording: (elapsed, limit) => `रेकॉर्ड होत आहे… ${elapsed} / ${limit}`,
    uploadInstead: "ऑडिओ फाइल अपलोड करा",
    recordAgain: "काढा आणि पुन्हा सुरू करा",
    limitNote: (seconds) =>
      `जास्तीत जास्त ${seconds} सेकंद. MP3, WAV, M4A आणि ब्राउझर रेकॉर्डिंग चालतात.`,
    microphoneBlocked:
      "मायक्रोफोन वापरता आला नाही. ब्राउझरमध्ये मायक्रोफोनची परवानगी द्या, किंवा ऑडिओ फाइल अपलोड करा.",
    recordingUnsupported:
      "हा ब्राउझर ऑडिओ रेकॉर्ड करू शकत नाही. ऑडिओ फाइल अपलोड करा.",
    save: "रेकॉर्डिंग सेव्ह करा",
    saving: "सेव्ह होत आहे…",
    saved: "रेकॉर्डिंग सेव्ह झाली. कॉल सुरू करण्यासाठी ती ऑटोमॅटिक ग्रीटिंग मध्ये निवडा.",
    failedToSave: "रेकॉर्डिंग सेव्ह करता आली नाही",
    failedToLoad: "कॉल रेकॉर्डिंग लोड करता आल्या नाहीत",
    failedToDelete: "रेकॉर्डिंग डिलीट करता आली नाही",
    nameRequired: "रेकॉर्डिंगला नाव द्या",
    audioRequired: "आधी व्हॉइस मेसेज रेकॉर्ड किंवा अपलोड करा",
    listHeading: "सेव्ह केलेल्या रेकॉर्डिंग",
    loading: "रेकॉर्डिंग लोड होत आहेत…",
    empty: "अजून कोणतीही रेकॉर्डिंग नाही.",
    seconds: (count) => `${count} सेकंद`,
    usedByRoutes: (count) => `${count} ऑटोमॅटिक ग्रीटिंगमध्ये वापरात आहे`,
    notUsed: "कोणत्याही ऑटोमॅटिक ग्रीटिंगमध्ये वापरात नाही",
    delete: "डिलीट करा",
    confirmDelete: (name) =>
      `रेकॉर्डिंग “${name}” डिलीट करायची? ती वापरणारे ऑटोमॅटिक ग्रीटिंग कॉल करणे थांबवतील.`,
    deleted: "रेकॉर्डिंग डिलीट झाली",
    setUpRoutes: "ऑटोमॅटिक ग्रीटिंग उघडा",
    gateway: {
      heading: "कॉल गेटवे",
      intro:
        "तुमचे व्हॉइस गेटवे अकाउंट. कॉल याच्यामार्फत केले जातात आणि तुमचा रेकॉर्ड केलेला मेसेज ऐकवला जातो.",
      route: "व्हॉइस रूट",
      routeHint: "तुमच्या प्रोव्हायडरकडून मिळालेला अचूक व्हॉइस रूट कोड.",
      callerId: "कॉलर ID",
      callerIdHint: "हा तुमच्या गेटवे अकाउंटवर व्हेरिफाइड कॉलर ID असावा.",
      notConfigured:
        "कॉन्फिगर केलेले नाही - गेटवेची माहिती सेव्ह करेपर्यंत कॉल उपलब्ध नाहीत",
      failedToLoad: "कॉल चॅनेल कॉन्फिगरेशन लोड करता आले नाही",
      failedToSave: "कॉल चॅनेल कॉन्फिगरेशन सेव्ह करता आले नाही",
      savedSuccess: "कॉन्फिगरेशन सेव्ह झाले.",
    },
  },
};

export function getCallRecordingsDict(locale: Locale): CallRecordingsDict {
  return CALL_RECORDINGS_DICT[locale];
}
