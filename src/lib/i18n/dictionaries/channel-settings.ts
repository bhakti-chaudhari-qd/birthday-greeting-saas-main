import type { Locale } from "../constants";

export type ChannelSettingsDict = {
  page: {
    title: string;
    loading: string;
  };
  common: {
    active: string;
    saving: string;
    saveConfiguration: string;
    loadingConfiguration: string;
    currentStatus: string;
    configured: string;
    notConfigured: string;
    activeWord: string;
    inactiveWord: string;
    provider: string;
  };
  sms: {
    usingPlatformDefault: string;
    platformReadyHint: string;
    saveOwnGatewayHint: string;
    credentials: string;
    credentialsConfigured: string;
    credentialsMissing: string;
    walletBalance: string;
    credits: string;
    refreshLiveBalance: string;
    testProviderNoBalance: string;
    refresh: string;
    refreshing: string;
    gateway: string;
    enterGatewayDetails: (demoNote: string) => string;
    demoPrefillNote: string;
    baseUrl: string;
    sendPath: string;
    sendPathHint: string;
    username: string;
    passwordHint: string;
    route: string;
    routeHint: (demoNote: string) => string;
    routeDemoNote: string;
    senderId: string;
    requestTimeout: string;
    requestTimeoutHint: string;
    successCode: string;
    successCodeHint: string;
    verifyConnection: string;
    verifying: string;
    saveBeforeVerify: string;
    failedToLoad: string;
    failedToSave: string;
    failedToVerify: string;
    failedToLoadBalance: string;
    savedSuccess: string;
    saveConfigToEnable: string;
    verifiedDefault: string;
  };
  whatsapp: {
    walletBalance: string;
    refreshLiveBalance: string;
    notAvailable: string;
    gateway: string;
    phoneNumberId: string;
    phoneNumberIdHint: string;
    accessToken: string;
    accessTokenHint: string;
    apiVersionOptional: string;
    baseUrl: string;
    sendPath: string;
    authenticationMethod: string;
    usernamePassword: string;
    apiKey: string;
    username: string;
    passwordHint: string;
    allowInsecureTls: string;
    allowInsecureTlsHint: string;
    currentStatusNotConfigured: string;
    currentStatusConfigured: (provider: string, status: string) => string;
    phoneNumberIdLabel: string;
    sendMessages: string;
    failedToLoad: string;
    failedToSave: string;
    savedSuccess: string;
  };
  email: {
    emailService: string;
    fromEmail: string;
    fromNameOptional: string;
    resendApiKey: string;
    resendApiKeyHint: string;
    notConfiguredDefault: (defaultFrom: string) => string;
    notConfiguredNoDefault: string;
    failedToLoad: string;
    failedToSave: string;
    savedSuccess: string;
  };
};

const CHANNEL_SETTINGS_DICT: Record<Locale, ChannelSettingsDict> = {
  en: {
    page: {
      title: "Channels",
      loading: "Loading channel settings…",
    },
    common: {
      active: "Active",
      saving: "Saving…",
      saveConfiguration: "Save Configuration",
      loadingConfiguration: "Loading configuration…",
      currentStatus: "Current status",
      configured: "Configured",
      notConfigured: "Not configured",
      activeWord: "active",
      inactiveWord: "inactive",
      provider: "Provider",
    },
    sms: {
      usingPlatformDefault: "Using the platform SMS service",
      platformReadyHint:
        "SMS is ready to use with the platform gateway. Save your own gateway below if you prefer to send through your own account.",
      saveOwnGatewayHint: "Save a configuration to enable SMS.",
      credentials: "Credentials",
      credentialsConfigured: "configured",
      credentialsMissing: "missing or invalid",
      walletBalance: "SMS wallet balance",
      credits: "credits",
      refreshLiveBalance: "Refresh to load your live SMS gateway balance.",
      testProviderNoBalance: "Test provider has no live wallet balance.",
      refresh: "Refresh balance",
      refreshing: "Refreshing…",
      gateway: "SMS gateway",
      enterGatewayDetails: (demoNote) =>
        `Enter your SMS gateway details.${demoNote}`,
      demoPrefillNote: " Empty fields are prefilled locally for testing.",
      baseUrl: "Base URL",
      sendPath: "Send path",
      sendPathHint: "Must start with /.",
      username: "Username",
      passwordHint: "Required the first time you set up Custom HTTP.",
      route: "Route",
      routeHint: (demoNote) => `Exact route code from your SMS provider${demoNote}.`,
      routeDemoNote: " (local demo: trans1)",
      senderId: "Sender ID",
      requestTimeout: "Request timeout",
      requestTimeoutHint: "Seconds to wait for the SMS provider response.",
      successCode: "Success code",
      successCodeHint: "First value in a successful provider response.",
      verifyConnection: "Verify Connection",
      verifying: "Verifying…",
      saveBeforeVerify: "Save a configuration before verifying the connection.",
      failedToLoad: "Failed to load SMS channel configuration",
      failedToSave: "Failed to save SMS channel configuration",
      failedToVerify: "Failed to verify SMS channel configuration",
      failedToLoadBalance: "Failed to load SMS wallet balance",
      savedSuccess: "Configuration saved successfully.",
      saveConfigToEnable: "Save a configuration to enable SMS.",
      verifiedDefault: "Configuration verified",
    },
    whatsapp: {
      walletBalance: "WhatsApp wallet balance",
      refreshLiveBalance: "Refresh to load your live WhatsApp gateway balance.",
      notAvailable: "Not available from the current WhatsApp provider.",
      gateway: "WhatsApp gateway",
      phoneNumberId: "Phone number ID",
      phoneNumberIdHint:
        "From Meta's WhatsApp API Setup page - the number before /messages in your API URL.",
      accessToken: "Access token",
      accessTokenHint:
        "A permanent System User token is recommended - a temporary token from the Meta dashboard expires within hours/days.",
      apiVersionOptional: "API version (optional)",
      baseUrl: "Base URL",
      sendPath: "Send path",
      authenticationMethod: "Authentication method",
      usernamePassword: "Username & Password",
      apiKey: "API Key",
      username: "Username",
      passwordHint: "Leave blank if your provider doesn't require one.",
      allowInsecureTls: "Allow insecure TLS (testing)",
      allowInsecureTlsHint: "For self-signed test gateways.",
      currentStatusNotConfigured: "Not configured - WhatsApp Send will fail closed",
      currentStatusConfigured: (provider, status) =>
        `Configured · ${provider} · ${status}`,
      phoneNumberIdLabel: "Phone number ID",
      sendMessages: "Send Messages",
      failedToLoad: "Failed to load WhatsApp channel configuration",
      failedToSave: "Failed to save WhatsApp channel configuration",
      savedSuccess: "Configuration saved successfully.",
    },
    email: {
      emailService: "Email service",
      fromEmail: "From email",
      fromNameOptional: "From name (optional)",
      resendApiKey: "Resend API key",
      resendApiKeyHint: "Required the first time you set up Resend.",
      notConfiguredDefault: (defaultFrom) =>
        `Not configured - Email is sent from the platform default sender (${defaultFrom}). Add your own Resend details to send from your own address.`,
      notConfiguredNoDefault:
        "Not configured - Email is unavailable until you add your Resend details",
      failedToLoad: "Failed to load Email channel configuration",
      failedToSave: "Failed to save Email channel configuration",
      savedSuccess: "Configuration saved successfully.",
    },
  },
  hi: {
    page: {
      title: "चैनल",
      loading: "चैनल सेटिंग्स लोड हो रही हैं…",
    },
    common: {
      active: "एक्टिव",
      saving: "सेव हो रहा है…",
      saveConfiguration: "कॉन्फ़िगरेशन सेव करें",
      loadingConfiguration: "कॉन्फ़िगरेशन लोड हो रहा है…",
      currentStatus: "मौजूदा स्टेटस",
      configured: "कॉन्फ़िगर हो चुका है",
      notConfigured: "कॉन्फ़िगर नहीं है",
      activeWord: "एक्टिव",
      inactiveWord: "इनएक्टिव",
      provider: "प्रोवाइडर",
    },
    sms: {
      usingPlatformDefault: "प्लेटफ़ॉर्म SMS सेवा इस्तेमाल हो रही है",
      platformReadyHint:
        "प्लेटफ़ॉर्म गेटवे के साथ SMS भेजने के लिए तैयार है। अपने खुद के अकाउंट से भेजना चाहें तो नीचे अपना गेटवे सेव करें।",
      saveOwnGatewayHint: "SMS चालू करने के लिए एक कॉन्फ़िगरेशन सेव करें।",
      credentials: "क्रेडेंशियल",
      credentialsConfigured: "कॉन्फ़िगर हो चुके हैं",
      credentialsMissing: "गायब हैं या अमान्य हैं",
      walletBalance: "SMS वॉलेट बैलेंस",
      credits: "क्रेडिट",
      refreshLiveBalance: "अपने लाइव SMS गेटवे बैलेंस के लिए रीफ़्रेश करें।",
      testProviderNoBalance: "टेस्ट प्रोवाइडर का कोई लाइव वॉलेट बैलेंस नहीं है।",
      refresh: "बैलेंस रीफ़्रेश करें",
      refreshing: "रीफ़्रेश हो रहा है…",
      gateway: "SMS गेटवे",
      enterGatewayDetails: (demoNote) => `अपने SMS गेटवे की जानकारी भरें।${demoNote}`,
      demoPrefillNote:
        " टेस्टिंग के लिए खाली फ़ील्ड लोकल रूप से अपने आप भर जाती हैं।",
      baseUrl: "Base URL",
      sendPath: "Send path",
      sendPathHint: "/ से शुरू होना चाहिए।",
      username: "Username",
      passwordHint: "Custom HTTP पहली बार सेट करते समय ज़रूरी है।",
      route: "Route",
      routeHint: (demoNote) => `आपके SMS प्रोवाइडर से मिला सटीक route कोड${demoNote}।`,
      routeDemoNote: " (लोकल डेमो: trans1)",
      senderId: "Sender ID",
      requestTimeout: "रिक्वेस्ट टाइमआउट",
      requestTimeoutHint: "SMS प्रोवाइडर के जवाब का इंतज़ार करने के सेकंड।",
      successCode: "सक्सेस कोड",
      successCodeHint: "सफल प्रोवाइडर रिस्पॉन्स की पहली वैल्यू।",
      verifyConnection: "कनेक्शन वेरिफ़ाई करें",
      verifying: "वेरिफ़ाई हो रहा है…",
      saveBeforeVerify: "कनेक्शन वेरिफ़ाई करने से पहले एक कॉन्फ़िगरेशन सेव करें।",
      failedToLoad: "SMS चैनल कॉन्फ़िगरेशन लोड नहीं हो सका",
      failedToSave: "SMS चैनल कॉन्फ़िगरेशन सेव नहीं हो सका",
      failedToVerify: "SMS चैनल कॉन्फ़िगरेशन वेरिफ़ाई नहीं हो सका",
      failedToLoadBalance: "SMS वॉलेट बैलेंस लोड नहीं हो सका",
      savedSuccess: "कॉन्फ़िगरेशन सफलतापूर्वक सेव हो गया।",
      saveConfigToEnable: "SMS चालू करने के लिए एक कॉन्फ़िगरेशन सेव करें।",
      verifiedDefault: "कॉन्फ़िगरेशन वेरिफ़ाई हो गया",
    },
    whatsapp: {
      walletBalance: "WhatsApp वॉलेट बैलेंस",
      refreshLiveBalance: "अपने लाइव WhatsApp गेटवे बैलेंस के लिए रीफ़्रेश करें।",
      notAvailable: "मौजूदा WhatsApp प्रोवाइडर से यह उपलब्ध नहीं है।",
      gateway: "WhatsApp गेटवे",
      phoneNumberId: "फ़ोन नंबर ID",
      phoneNumberIdHint:
        "Meta के WhatsApp API Setup पेज से - आपके API URL में /messages से पहले का नंबर।",
      accessToken: "एक्सेस टोकन",
      accessTokenHint:
        "एक स्थायी (permanent) System User टोकन सुझाया जाता है - Meta डैशबोर्ड का टेम्पररी टोकन कुछ घंटों/दिनों में एक्सपायर हो जाता है।",
      apiVersionOptional: "API वर्शन (वैकल्पिक)",
      baseUrl: "Base URL",
      sendPath: "Send path",
      authenticationMethod: "ऑथेंटिकेशन तरीका",
      usernamePassword: "यूज़रनेम और पासवर्ड",
      apiKey: "API Key",
      username: "Username",
      passwordHint: "अगर आपके प्रोवाइडर को इसकी ज़रूरत नहीं है तो खाली छोड़ दें।",
      allowInsecureTls: "असुरक्षित TLS की अनुमति दें (टेस्टिंग)",
      allowInsecureTlsHint: "सेल्फ़-साइन्ड टेस्ट गेटवे के लिए।",
      currentStatusNotConfigured:
        "कॉन्फ़िगर नहीं है - WhatsApp भेजना नहीं हो पाएगा",
      currentStatusConfigured: (provider, status) =>
        `कॉन्फ़िगर हो चुका है · ${provider} · ${status}`,
      phoneNumberIdLabel: "फ़ोन नंबर ID",
      sendMessages: "मेसेज भेजें",
      failedToLoad: "WhatsApp चैनल कॉन्फ़िगरेशन लोड नहीं हो सका",
      failedToSave: "WhatsApp चैनल कॉन्फ़िगरेशन सेव नहीं हो सका",
      savedSuccess: "कॉन्फ़िगरेशन सफलतापूर्वक सेव हो गया।",
    },
    email: {
      emailService: "Email सेवा",
      fromEmail: "From email",
      fromNameOptional: "From name (वैकल्पिक)",
      resendApiKey: "Resend API key",
      resendApiKeyHint: "Resend पहली बार सेट करते समय ज़रूरी है।",
      notConfiguredDefault: (defaultFrom) =>
        `कॉन्फ़िगर नहीं है - Email प्लेटफ़ॉर्म के डिफ़ॉल्ट सेंडर (${defaultFrom}) से जाती है। अपने पते से भेजने के लिए अपनी Resend जानकारी जोड़ें।`,
      notConfiguredNoDefault:
        "कॉन्फ़िगर नहीं है - जब तक आप अपनी Resend जानकारी नहीं जोड़ते, Email उपलब्ध नहीं है",
      failedToLoad: "Email चैनल कॉन्फ़िगरेशन लोड नहीं हो सका",
      failedToSave: "Email चैनल कॉन्फ़िगरेशन सेव नहीं हो सका",
      savedSuccess: "कॉन्फ़िगरेशन सफलतापूर्वक सेव हो गया।",
    },
  },
  mr: {
    page: {
      title: "चॅनेल",
      loading: "चॅनेल सेटिंग्ज लोड होत आहेत…",
    },
    common: {
      active: "एक्टिव",
      saving: "सेव्ह होत आहे…",
      saveConfiguration: "कॉन्फिगरेशन सेव्ह करा",
      loadingConfiguration: "कॉन्फिगरेशन लोड होत आहे…",
      currentStatus: "सध्याचा स्टेटस",
      configured: "कॉन्फिगर झाले",
      notConfigured: "कॉन्फिगर केलेले नाही",
      activeWord: "एक्टिव्ह",
      inactiveWord: "इनएक्टिव्ह",
      provider: "प्रोव्हायडर",
    },
    sms: {
      usingPlatformDefault: "प्लॅटफॉर्म SMS सेवा वापरली जात आहे",
      platformReadyHint:
        "प्लॅटफॉर्म गेटवेसह SMS पाठवायला तयार आहे. तुमच्या स्वतःच्या खात्यातून पाठवायचे असल्यास खाली तुमचे गेटवे सेव्ह करा.",
      saveOwnGatewayHint: "SMS सुरू करण्यासाठी कॉन्फिगरेशन सेव्ह करा.",
      credentials: "क्रेडेन्शियल्स",
      credentialsConfigured: "कॉन्फिगर झाले आहेत",
      credentialsMissing: "गहाळ आहेत किंवा अवैध आहेत",
      walletBalance: "SMS वॉलेट बॅलन्स",
      credits: "क्रेडिट्स",
      refreshLiveBalance: "तुमच्या लाइव्ह SMS गेटवे बॅलन्ससाठी रीफ्रेश करा.",
      testProviderNoBalance: "टेस्ट प्रोव्हायडरचा कोणताही लाइव्ह वॉलेट बॅलन्स नाही.",
      refresh: "बॅलन्स रीफ्रेश करा",
      refreshing: "रीफ्रेश होत आहे…",
      gateway: "SMS गेटवे",
      enterGatewayDetails: (demoNote) => `तुमच्या SMS गेटवेची माहिती भरा.${demoNote}`,
      demoPrefillNote:
        " टेस्टिंगसाठी रिकामी फील्ड्स स्थानिक पातळीवर आपोआप भरली जातात.",
      baseUrl: "Base URL",
      sendPath: "Send path",
      sendPathHint: "/ ने सुरू झाला पाहिजे.",
      username: "Username",
      passwordHint: "Custom HTTP पहिल्यांदा सेट करताना आवश्यक आहे.",
      route: "Route",
      routeHint: (demoNote) => `तुमच्या SMS प्रोव्हायडरने दिलेला अचूक route कोड${demoNote}.`,
      routeDemoNote: " (स्थानिक डेमो: trans1)",
      senderId: "Sender ID",
      requestTimeout: "रिक्वेस्ट टाइमआउट",
      requestTimeoutHint: "SMS प्रोव्हायडरच्या प्रतिसादासाठी वाट पाहण्याचे सेकंद.",
      successCode: "सक्सेस कोड",
      successCodeHint: "यशस्वी प्रोव्हायडर प्रतिसादातील पहिली व्हॅल्यू.",
      verifyConnection: "कनेक्शन व्हेरिफाय करा",
      verifying: "व्हेरिफाय होत आहे…",
      saveBeforeVerify: "कनेक्शन व्हेरिफाय करण्यापूर्वी कॉन्फिगरेशन सेव्ह करा.",
      failedToLoad: "SMS चॅनेल कॉन्फिगरेशन लोड होऊ शकले नाही",
      failedToSave: "SMS चॅनेल कॉन्फिगरेशन सेव्ह होऊ शकले नाही",
      failedToVerify: "SMS चॅनेल कॉन्फिगरेशन व्हेरिफाय होऊ शकले नाही",
      failedToLoadBalance: "SMS वॉलेट बॅलन्स लोड होऊ शकला नाही",
      savedSuccess: "कॉन्फिगरेशन यशस्वीरित्या सेव्ह झाले.",
      saveConfigToEnable: "SMS सुरू करण्यासाठी कॉन्फिगरेशन सेव्ह करा.",
      verifiedDefault: "कॉन्फिगरेशन व्हेरिफाय झाले",
    },
    whatsapp: {
      walletBalance: "WhatsApp वॉलेट बॅलन्स",
      refreshLiveBalance: "तुमच्या लाइव्ह WhatsApp गेटवे बॅलन्ससाठी रीफ्रेश करा.",
      notAvailable: "सध्याच्या WhatsApp प्रोव्हायडरकडून हे उपलब्ध नाही.",
      gateway: "WhatsApp गेटवे",
      phoneNumberId: "फोन नंबर ID",
      phoneNumberIdHint:
        "Meta च्या WhatsApp API Setup पेजवरून - तुमच्या API URL मध्ये /messages च्या आधीचा नंबर.",
      accessToken: "अ‍ॅक्सेस टोकन",
      accessTokenHint:
        "कायमस्वरूपी (permanent) System User टोकन सुचवले जाते - Meta डॅशबोर्डवरील तात्पुरता टोकन काही तास/दिवसांत एक्सपायर होतो.",
      apiVersionOptional: "API व्हर्जन (ऐच्छिक)",
      baseUrl: "Base URL",
      sendPath: "Send path",
      authenticationMethod: "ऑथेंटिकेशन पद्धत",
      usernamePassword: "युजरनेम आणि पासवर्ड",
      apiKey: "API Key",
      username: "Username",
      passwordHint: "तुमच्या प्रोव्हायडरला याची गरज नसल्यास रिकामे ठेवा.",
      allowInsecureTls: "असुरक्षित TLS ला परवानगी द्या (टेस्टिंग)",
      allowInsecureTlsHint: "सेल्फ-साइन्ड टेस्ट गेटवेसाठी.",
      currentStatusNotConfigured: "कॉन्फिगर केलेले नाही - WhatsApp पाठवणे शक्य होणार नाही",
      currentStatusConfigured: (provider, status) =>
        `कॉन्फिगर झाले · ${provider} · ${status}`,
      phoneNumberIdLabel: "फोन नंबर ID",
      sendMessages: "मेसेज पाठवा",
      failedToLoad: "WhatsApp चॅनेल कॉन्फिगरेशन लोड होऊ शकले नाही",
      failedToSave: "WhatsApp चॅनेल कॉन्फिगरेशन सेव्ह होऊ शकले नाही",
      savedSuccess: "कॉन्फिगरेशन यशस्वीरित्या सेव्ह झाले.",
    },
    email: {
      emailService: "Email सेवा",
      fromEmail: "From email",
      fromNameOptional: "From name (ऐच्छिक)",
      resendApiKey: "Resend API key",
      resendApiKeyHint: "Resend पहिल्यांदा सेट करताना आवश्यक आहे.",
      notConfiguredDefault: (defaultFrom) =>
        `कॉन्फिगर केलेले नाही - Email प्लॅटफॉर्मच्या डिफॉल्ट सेंडरवरून (${defaultFrom}) जाते. तुमच्या पत्त्यावरून पाठवण्यासाठी तुमची Resend माहिती जोडा.`,
      notConfiguredNoDefault:
        "कॉन्फिगर केलेले नाही - तुम्ही तुमची Resend माहिती जोडेपर्यंत Email उपलब्ध नाही",
      failedToLoad: "Email चॅनेल कॉन्फिगरेशन लोड होऊ शकले नाही",
      failedToSave: "Email चॅनेल कॉन्फिगरेशन सेव्ह होऊ शकले नाही",
      savedSuccess: "कॉन्फिगरेशन यशस्वीरित्या सेव्ह झाले.",
    },
  },
};

export function getChannelSettingsDict(locale: Locale): ChannelSettingsDict {
  return CHANNEL_SETTINGS_DICT[locale];
}
