import type { Locale } from "../constants";

export type ChannelSetupChannel = "sms" | "whatsapp" | "email";

export type ChannelSetupDict = {
  heading: Record<ChannelSetupChannel, string>;
  steps: Record<ChannelSetupChannel, string[]>;
};

const CHANNEL_SETUP_DICT: Record<Locale, ChannelSetupDict> = {
  en: {
    heading: {
      sms: "How to set up SMS",
      whatsapp: "How to set up WhatsApp",
      email: "How to set up Email",
    },
    steps: {
      sms: [
        "Get your SMS gateway details from your SMS provider: Base URL, send path, username, password, route and sender ID.",
        "Enter the \"Base URL\" and the \"Send path\" (the path must start with /).",
        "Enter your \"Username\" and password, then the \"Route\" and \"Sender ID\" your provider gave you.",
        "Tick \"Active\" and press \"Save Configuration\".",
        "Check that the status at the top says \"Configured\", then press \"Refresh balance\" to confirm the connection works.",
      ],
      whatsapp: [
        "Get your WhatsApp gateway details from your WhatsApp provider: Base URL, send path and either a username and password or an API key.",
        "Enter the \"Base URL\" and the \"Send path\".",
        "Choose the \"Authentication method\" and enter the matching credentials (Username & Password, or API Key).",
        "Tick \"Active\" and press \"Save Configuration\".",
        "Check that \"Current status\" says \"Configured\". Until it does, WhatsApp messages will not be sent.",
      ],
      email: [
        "Create an account on Resend and verify the domain you want to send emails from.",
        "In Resend, create an API key and copy it.",
        "Enter a \"From email\" on your verified domain (for example greetings@yourdomain.com) and, if you like, a \"From name\".",
        "Paste the key into \"Resend API key\", tick \"Active\" and press \"Save Configuration\".",
        "Check that \"Current status\" says \"Configured\". Until then, emails go out from the platform's default sender.",
      ],
    },
  },
  hi: {
    heading: {
      sms: "SMS कैसे सेट अप करें",
      whatsapp: "WhatsApp कैसे सेट अप करें",
      email: "Email कैसे सेट अप करें",
    },
    steps: {
      sms: [
        "अपने SMS प्रोवाइडर से SMS गेटवे की जानकारी लें: Base URL, send path, यूज़रनेम, पासवर्ड, route और sender ID।",
        "\"Base URL\" और \"Send path\" भरें (path / से शुरू होना चाहिए)।",
        "अपना \"Username\" और पासवर्ड भरें, फिर प्रोवाइडर से मिले \"Route\" और \"Sender ID\" भरें।",
        "\"Active\" पर टिक करें और \"Save Configuration\" दबाएँ।",
        "ऊपर स्टेटस में \"Configured\" दिख रहा है यह जाँचें, फिर कनेक्शन ठीक है यह पक्का करने के लिए \"Refresh balance\" दबाएँ।",
      ],
      whatsapp: [
        "अपने WhatsApp प्रोवाइडर से गेटवे की जानकारी लें: Base URL, send path और यूज़रनेम-पासवर्ड या API key।",
        "\"Base URL\" और \"Send path\" भरें।",
        "\"Authentication method\" चुनें और उसके हिसाब से क्रेडेंशियल भरें (Username & Password, या API Key)।",
        "\"Active\" पर टिक करें और \"Save Configuration\" दबाएँ।",
        "\"Current status\" में \"Configured\" दिख रहा है यह जाँचें। जब तक यह नहीं दिखता, WhatsApp मेसेज नहीं भेजे जाएँगे।",
      ],
      email: [
        "Resend पर अकाउंट बनाएँ और जिस डोमेन से Email भेजना है उसे वेरिफ़ाई करें।",
        "Resend में एक API key बनाएँ और उसे कॉपी करें।",
        "अपने वेरिफ़ाई किए डोमेन का \"From email\" भरें (जैसे greetings@yourdomain.com) और चाहें तो \"From name\" भी भरें।",
        "key को \"Resend API key\" में पेस्ट करें, \"Active\" पर टिक करें और \"Save Configuration\" दबाएँ।",
        "\"Current status\" में \"Configured\" दिख रहा है यह जाँचें। तब तक Email प्लेटफ़ॉर्म के डिफ़ॉल्ट सेंडर से जाएँगे।",
      ],
    },
  },
  mr: {
    heading: {
      sms: "SMS कसे सेट अप करावे",
      whatsapp: "WhatsApp कसे सेट अप करावे",
      email: "Email कसे सेट अप करावे",
    },
    steps: {
      sms: [
        "तुमच्या SMS प्रोव्हायडरकडून SMS गेटवेची माहिती घ्या: Base URL, send path, युजरनेम, पासवर्ड, route आणि sender ID.",
        "\"Base URL\" आणि \"Send path\" भरा (path / ने सुरू झाला पाहिजे).",
        "तुमचा \"Username\" आणि पासवर्ड भरा, मग प्रोव्हायडरने दिलेला \"Route\" आणि \"Sender ID\" भरा.",
        "\"Active\" वर टिक करा आणि \"Save Configuration\" दाबा.",
        "वरील स्टेटसमध्ये \"Configured\" दिसत आहे का ते तपासा, मग कनेक्शन नीट आहे याची खात्री करण्यासाठी \"Refresh balance\" दाबा.",
      ],
      whatsapp: [
        "तुमच्या WhatsApp प्रोव्हायडरकडून गेटवेची माहिती घ्या: Base URL, send path आणि युजरनेम-पासवर्ड किंवा API key.",
        "\"Base URL\" आणि \"Send path\" भरा.",
        "\"Authentication method\" निवडा आणि त्यानुसार क्रेडेन्शियल्स भरा (Username & Password, किंवा API Key).",
        "\"Active\" वर टिक करा आणि \"Save Configuration\" दाबा.",
        "\"Current status\" मध्ये \"Configured\" दिसत आहे का ते तपासा. ते दिसेपर्यंत WhatsApp मेसेज पाठवले जाणार नाहीत.",
      ],
      email: [
        "Resend वर अकाउंट तयार करा आणि ज्या डोमेनवरून Email पाठवायचे आहेत ते व्हेरिफाय करा.",
        "Resend मध्ये एक API key तयार करा आणि ती कॉपी करा.",
        "तुमच्या व्हेरिफाय केलेल्या डोमेनचा \"From email\" भरा (उदा. greetings@yourdomain.com) आणि हवे असल्यास \"From name\" सुद्धा भरा.",
        "key \"Resend API key\" मध्ये पेस्ट करा, \"Active\" वर टिक करा आणि \"Save Configuration\" दाबा.",
        "\"Current status\" मध्ये \"Configured\" दिसत आहे का ते तपासा. तोपर्यंत Email प्लॅटफॉर्मच्या डिफॉल्ट सेंडरवरून जातील.",
      ],
    },
  },
};

export function getChannelSetupDict(locale: Locale): ChannelSetupDict {
  return CHANNEL_SETUP_DICT[locale];
}
