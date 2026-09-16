import type { Locale } from "../constants";

export type HelpWidgetDict = {
  panelLabel: string;
  headerTitle: string;
  headerSubtitle: string;
  close: string;
  suggestedQuestions: string;
  thinking: string;
  askInputLabel: string;
  askPlaceholder: string;
  ask: string;
  toggleOpen: string;
  toggleClose: string;
  defaultWelcome: string;
  genericAnswerFailed: string;
  genericChatFailed: string;
  couldNotLoadHelp: string;
  helpRequestFailed: string;
};

const HELP_WIDGET_DICT: Record<Locale, HelpWidgetDict> = {
  en: {
    panelLabel: "Product help chat",
    headerTitle: "Product help",
    headerSubtitle: "Answers from product docs. I can't change your account.",
    close: "Close",
    suggestedQuestions: "Suggested questions",
    thinking: "Thinking…",
    askInputLabel: "Ask a product question",
    askPlaceholder: "Ask in English, हिंदी, or मराठी…",
    ask: "Ask",
    toggleOpen: "Need help?",
    toggleClose: "Hide help",
    defaultWelcome:
      "Hi! I can help with contacts, templates, automations, SMS/WhatsApp setup, roles, and billing. Ask in English, हिंदी, or मराठी - I'll reply in the same language.",
    genericAnswerFailed: "I could not form an answer. Please try another question.",
    genericChatFailed: "Sorry - I could not answer that just now. Please try again in a moment.",
    couldNotLoadHelp: "Could not load help questions",
    helpRequestFailed: "Help request failed",
  },
  hi: {
    panelLabel: "प्रोडक्ट हेल्प चैट",
    headerTitle: "प्रोडक्ट सहायता",
    headerSubtitle: "प्रोडक्ट दस्तावेज़ों से जवाब। मैं आपका खाता नहीं बदल सकता।",
    close: "बंद करें",
    suggestedQuestions: "सुझाए गए सवाल",
    thinking: "सोच रहा है…",
    askInputLabel: "प्रोडक्ट से जुड़ा सवाल पूछें",
    askPlaceholder: "English, हिंदी, या मराठी में पूछें…",
    ask: "पूछें",
    toggleOpen: "मदद चाहिए?",
    toggleClose: "मदद छिपाएँ",
    defaultWelcome:
      "नमस्ते! मैं संपर्क, टेम्पलेट, ऑटोमेशन, SMS/WhatsApp सेटअप, भूमिकाओं और बिलिंग में मदद कर सकता हूँ। English, हिंदी, या मराठी में पूछें - मैं उसी भाषा में जवाब दूँगा।",
    genericAnswerFailed: "मैं जवाब नहीं बना सका। कृपया कोई और सवाल पूछें।",
    genericChatFailed: "माफ़ करें - अभी जवाब नहीं दे सका। कुछ देर बाद फिर कोशिश करें।",
    couldNotLoadHelp: "सहायता के सवाल लोड नहीं हो सके",
    helpRequestFailed: "सहायता अनुरोध असफल रहा",
  },
  mr: {
    panelLabel: "प्रोडक्ट हेल्प चॅट",
    headerTitle: "प्रोडक्ट मदत",
    headerSubtitle: "प्रोडक्ट कागदपत्रांमधून उत्तरे. मी तुमचे खाते बदलू शकत नाही.",
    close: "बंद करा",
    suggestedQuestions: "सुचवलेले प्रश्न",
    thinking: "विचार करत आहे…",
    askInputLabel: "प्रोडक्टबद्दल प्रश्न विचारा",
    askPlaceholder: "English, हिंदी, किंवा मराठीत विचारा…",
    ask: "विचारा",
    toggleOpen: "मदत हवी?",
    toggleClose: "मदत लपवा",
    defaultWelcome:
      "नमस्कार! मी संपर्क, टेम्पलेट, ऑटोमेशन, SMS/WhatsApp सेटअप, भूमिका आणि बिलिंगमध्ये मदत करू शकतो. English, हिंदी, किंवा मराठीत विचारा - मी त्याच भाषेत उत्तर देईन.",
    genericAnswerFailed: "मी उत्तर तयार करू शकलो नाही. कृपया दुसरा प्रश्न विचारा.",
    genericChatFailed: "माफ करा - आत्ता उत्तर देऊ शकलो नाही. थोड्या वेळाने पुन्हा प्रयत्न करा.",
    couldNotLoadHelp: "मदतीचे प्रश्न लोड होऊ शकले नाहीत",
    helpRequestFailed: "मदत विनंती अयशस्वी झाली",
  },
};

export function getHelpWidgetDict(locale: Locale): HelpWidgetDict {
  return HELP_WIDGET_DICT[locale];
}
