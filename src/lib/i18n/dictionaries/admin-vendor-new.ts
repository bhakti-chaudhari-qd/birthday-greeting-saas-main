import type { Locale } from "../constants";

export type AdminVendorNewDict = {
  title: string;
  description: string;
  backToVendors: string;
  vendorName: string;
  mobile: string;
  mobileHint: string;
  mobilePlaceholder: string;
  creatingAndSending: string;
  createVendorAndSendSms: string;
  failedToCreateVendor: string;
  inviteIssueUncertain: string;
  inviteIssueNotSent: string;
};

const ADMIN_VENDOR_NEW_DICT: Record<Locale, AdminVendorNewDict> = {
  en: {
    title: "Create vendor",
    description: "Create the vendor record and send its secure registration invitation by SMS.",
    backToVendors: "Back to vendors",
    vendorName: "Vendor name",
    mobile: "Mobile",
    mobileHint: "The registration invitation is sent by SMS.",
    mobilePlaceholder: "98765 43210",
    creatingAndSending: "Creating and sending…",
    createVendorAndSendSms: "Create vendor and send SMS",
    failedToCreateVendor: "Failed to create vendor",
    inviteIssueUncertain:
      "SMS delivery is uncertain. Verify with the vendor before resending, to avoid a duplicate message.",
    inviteIssueNotSent:
      "the invitation SMS could not be sent. You can retry sending it from this page.",
  },
  hi: {
    title: "वेंडर बनाएँ",
    description: "वेंडर रिकॉर्ड बनाएँ और SMS से उसका सिक्योर रजिस्ट्रेशन इनविटेशन भेजें।",
    backToVendors: "वेंडर पर वापस जाएँ",
    vendorName: "वेंडर का नाम",
    mobile: "मोबाइल",
    mobileHint: "रजिस्ट्रेशन इनविटेशन SMS से भेजा जाता है।",
    mobilePlaceholder: "98765 43210",
    creatingAndSending: "बन रहा है और भेजा जा रहा है…",
    createVendorAndSendSms: "वेंडर बनाएँ और SMS भेजें",
    failedToCreateVendor: "वेंडर नहीं बन सका",
    inviteIssueUncertain:
      "SMS डिलीवरी अनिश्चित है। दोबारा भेजने से पहले वेंडर से पुष्टि करें, ताकि डुप्लिकेट मेसेज न जाए।",
    inviteIssueNotSent:
      "इनविटेशन SMS नहीं भेजा जा सका। आप इस पेज से इसे फिर भेज सकते हैं।",
  },
  mr: {
    title: "व्हेंडर तयार करा",
    description: "व्हेंडर रेकॉर्ड तयार करा आणि SMS द्वारे त्याचे सिक्युअर रजिस्ट्रेशन इनव्हिटेशन पाठवा.",
    backToVendors: "व्हेंडरवर परत जा",
    vendorName: "व्हेंडरचे नाव",
    mobile: "मोबाइल",
    mobileHint: "रजिस्ट्रेशन इनव्हिटेशन SMS द्वारे पाठवले जाते.",
    mobilePlaceholder: "98765 43210",
    creatingAndSending: "तयार होत आहे आणि पाठवले जात आहे…",
    createVendorAndSendSms: "व्हेंडर तयार करा आणि SMS पाठवा",
    failedToCreateVendor: "व्हेंडर तयार होऊ शकला नाही",
    inviteIssueUncertain:
      "SMS डिलिव्हरी अनिश्चित आहे. पुन्हा पाठवण्यापूर्वी व्हेंडरकडून खात्री करा, जेणेकरून डुप्लिकेट मेसेज जाणार नाही.",
    inviteIssueNotSent:
      "इनव्हिटेशन SMS पाठवला जाऊ शकला नाही. तुम्ही या पेजवरून तो पुन्हा पाठवू शकता.",
  },
};

export function getAdminVendorNewDict(locale: Locale): AdminVendorNewDict {
  return ADMIN_VENDOR_NEW_DICT[locale];
}
