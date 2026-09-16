import type { Locale } from "../constants";

export type AuthDict = {
  passwordField: { show: string; hide: string };
  login: {
    title: string;
    subtitle: string;
    identifierLabel: string;
    jsRequired: string;
    passwordLabel: string;
    submit: string;
    submitting: string;
    forgotPassword: string;
    register: string;
    fallbackError: string;
  };
  register: {
    title: string;
    subtitle: string;
    jsRequired: string;
    organizationNameLabel: string;
    ownerNameLabel: string;
    emailLabel: string;
    passwordLabel: string;
    passwordHint: string;
    referralLabel: string;
    referralPlaceholder: string;
    submit: string;
    submitting: string;
    signIn: string;
    loading: string;
    fallbackError: string;
  };
  forgotPassword: {
    title: string;
    subtitle: string;
    emailLabel: string;
    submit: string;
    submitting: string;
    backToSignIn: string;
    fallbackError: string;
    fallbackTooMany: string;
    fallbackSent: string;
  };
  resetPassword: {
    title: string;
    subtitle: string;
    newPasswordLabel: string;
    confirmPasswordLabel: string;
    submit: string;
    submitting: string;
    loading: string;
    signIn: string;
    fallbackError: string;
    fallbackMismatch: string;
    fallbackUpdated: string;
  };
};

const AUTH_DICT: Record<Locale, AuthDict> = {
  en: {
    passwordField: { show: "Show", hide: "Hide" },
    login: {
      title: "Sign in",
      subtitle:
        "Use your email or Indian mobile number and password. We'll route you to the right workspace.",
      identifierLabel: "Email or Indian mobile",
      jsRequired: "JavaScript is required to sign in.",
      passwordLabel: "Password",
      submit: "Sign in",
      submitting: "Signing in...",
      forgotPassword: "Forgot password",
      register: "Register",
      fallbackError: "Login failed",
    },
    register: {
      title: "Register organization",
      subtitle: "Create your organization and Owner account.",
      jsRequired: "JavaScript is required to create an account.",
      organizationNameLabel: "Organization name",
      ownerNameLabel: "Owner name",
      emailLabel: "Email",
      passwordLabel: "Password",
      passwordHint:
        "At least 10 characters, or 8+ with uppercase, lowercase, and a number.",
      referralLabel: "Referral code",
      referralPlaceholder: "From your partner, if you have one",
      submit: "Create account",
      submitting: "Creating...",
      signIn: "Sign in",
      loading: "Loading…",
      fallbackError: "Registration failed",
    },
    forgotPassword: {
      title: "Forgot password",
      subtitle:
        "Enter your organization account email. We'll send a one-hour reset link if the account exists.",
      emailLabel: "Email",
      submit: "Send reset link",
      submitting: "Sending…",
      backToSignIn: "Back to sign in",
      fallbackError: "Request failed",
      fallbackTooMany: "Too many attempts. Try again later.",
      fallbackSent:
        "If an account exists for that email, a reset link has been sent.",
    },
    resetPassword: {
      title: "Reset password",
      subtitle:
        "Choose a new password (at least 10 characters, or 8+ with upper, lower, and a number).",
      newPasswordLabel: "New password",
      confirmPasswordLabel: "Confirm password",
      submit: "Update password",
      submitting: "Updating…",
      loading: "Loading…",
      signIn: "Sign in",
      fallbackError: "Could not reset password",
      fallbackMismatch: "Passwords do not match",
      fallbackUpdated: "Password updated.",
    },
  },
  hi: {
    passwordField: { show: "दिखाएँ", hide: "छिपाएँ" },
    login: {
      title: "साइन इन करें",
      subtitle:
        "अपना ईमेल या भारतीय मोबाइल नंबर और पासवर्ड इस्तेमाल करें। हम आपको सही वर्कस्पेस पर भेज देंगे।",
      identifierLabel: "ईमेल या भारतीय मोबाइल",
      jsRequired: "साइन इन करने के लिए JavaScript ज़रूरी है।",
      passwordLabel: "पासवर्ड",
      submit: "साइन इन करें",
      submitting: "साइन इन हो रहा है...",
      forgotPassword: "पासवर्ड भूल गए",
      register: "रजिस्टर करें",
      fallbackError: "लॉगिन असफल रहा",
    },
    register: {
      title: "संगठन रजिस्टर करें",
      subtitle: "अपना संगठन और Owner खाता बनाएँ।",
      jsRequired: "खाता बनाने के लिए JavaScript ज़रूरी है।",
      organizationNameLabel: "संगठन का नाम",
      ownerNameLabel: "Owner का नाम",
      emailLabel: "ईमेल",
      passwordLabel: "पासवर्ड",
      passwordHint:
        "कम से कम 10 अक्षर, या 8+ के साथ बड़े-छोटे अक्षर और एक अंक।",
      referralLabel: "रेफ़रल कोड",
      referralPlaceholder: "अगर आपके पार्टनर से मिला हो",
      submit: "खाता बनाएँ",
      submitting: "बनाया जा रहा है...",
      signIn: "साइन इन करें",
      loading: "लोड हो रहा है…",
      fallbackError: "रजिस्ट्रेशन असफल रहा",
    },
    forgotPassword: {
      title: "पासवर्ड भूल गए",
      subtitle:
        "अपने संगठन खाते का ईमेल भरें। अगर खाता मौजूद है तो हम एक घंटे का रीसेट लिंक भेजेंगे।",
      emailLabel: "ईमेल",
      submit: "रीसेट लिंक भेजें",
      submitting: "भेजा जा रहा है…",
      backToSignIn: "साइन इन पर वापस जाएँ",
      fallbackError: "अनुरोध असफल रहा",
      fallbackTooMany: "बहुत सारी कोशिशें। कुछ देर बाद फिर कोशिश करें।",
      fallbackSent:
        "अगर उस ईमेल का खाता मौजूद है, तो एक रीसेट लिंक भेज दिया गया है।",
    },
    resetPassword: {
      title: "पासवर्ड रीसेट करें",
      subtitle:
        "नया पासवर्ड चुनें (कम से कम 10 अक्षर, या 8+ के साथ बड़े-छोटे अक्षर और एक अंक)।",
      newPasswordLabel: "नया पासवर्ड",
      confirmPasswordLabel: "पासवर्ड की पुष्टि करें",
      submit: "पासवर्ड अपडेट करें",
      submitting: "अपडेट हो रहा है…",
      loading: "लोड हो रहा है…",
      signIn: "साइन इन करें",
      fallbackError: "पासवर्ड रीसेट नहीं हो सका",
      fallbackMismatch: "पासवर्ड मेल नहीं खाते",
      fallbackUpdated: "पासवर्ड अपडेट हो गया।",
    },
  },
  mr: {
    passwordField: { show: "दाखवा", hide: "लपवा" },
    login: {
      title: "साइन इन करा",
      subtitle:
        "तुमचा ईमेल किंवा भारतीय मोबाइल नंबर आणि पासवर्ड वापरा. आम्ही तुम्हाला योग्य वर्कस्पेसवर घेऊन जाऊ.",
      identifierLabel: "ईमेल किंवा भारतीय मोबाइल",
      jsRequired: "साइन इन करण्यासाठी JavaScript आवश्यक आहे.",
      passwordLabel: "पासवर्ड",
      submit: "साइन इन करा",
      submitting: "साइन इन होत आहे...",
      forgotPassword: "पासवर्ड विसरलात",
      register: "रजिस्टर करा",
      fallbackError: "लॉगिन अयशस्वी झाले",
    },
    register: {
      title: "संस्था रजिस्टर करा",
      subtitle: "तुमची संस्था आणि Owner खाते तयार करा.",
      jsRequired: "खाते तयार करण्यासाठी JavaScript आवश्यक आहे.",
      organizationNameLabel: "संस्थेचे नाव",
      ownerNameLabel: "Owner चे नाव",
      emailLabel: "ईमेल",
      passwordLabel: "पासवर्ड",
      passwordHint:
        "किमान 10 अक्षरे, किंवा 8+ सह मोठी-लहान अक्षरे आणि एक अंक.",
      referralLabel: "रेफरल कोड",
      referralPlaceholder: "तुमच्या पार्टनरकडून मिळाला असल्यास",
      submit: "खाते तयार करा",
      submitting: "तयार होत आहे...",
      signIn: "साइन इन करा",
      loading: "लोड होत आहे…",
      fallbackError: "रजिस्ट्रेशन अयशस्वी झाले",
    },
    forgotPassword: {
      title: "पासवर्ड विसरलात",
      subtitle:
        "तुमच्या संस्था खात्याचा ईमेल भरा. खाते अस्तित्वात असल्यास आम्ही एका तासाची रीसेट लिंक पाठवू.",
      emailLabel: "ईमेल",
      submit: "रीसेट लिंक पाठवा",
      submitting: "पाठवत आहे…",
      backToSignIn: "साइन इनवर परत जा",
      fallbackError: "विनंती अयशस्वी झाली",
      fallbackTooMany: "खूप प्रयत्न झाले. थोड्या वेळाने पुन्हा प्रयत्न करा.",
      fallbackSent:
        "त्या ईमेलचे खाते अस्तित्वात असल्यास, रीसेट लिंक पाठवली गेली आहे.",
    },
    resetPassword: {
      title: "पासवर्ड रीसेट करा",
      subtitle:
        "नवीन पासवर्ड निवडा (किमान 10 अक्षरे, किंवा 8+ सह मोठी-लहान अक्षरे आणि एक अंक).",
      newPasswordLabel: "नवीन पासवर्ड",
      confirmPasswordLabel: "पासवर्डची पुष्टी करा",
      submit: "पासवर्ड अपडेट करा",
      submitting: "अपडेट होत आहे…",
      loading: "लोड होत आहे…",
      signIn: "साइन इन करा",
      fallbackError: "पासवर्ड रीसेट करता आला नाही",
      fallbackMismatch: "पासवर्ड जुळत नाहीत",
      fallbackUpdated: "पासवर्ड अपडेट झाला.",
    },
  },
};

export function getAuthDict(locale: Locale): AuthDict {
  return AUTH_DICT[locale];
}
