import type { Locale } from "../constants";

export type AdminVendorDetailDict = {
  backToVendors: string;
  vendorWasCreatedBut: (issue: string) => string;
  mobile: string;
  latestInvitation: string;
  registrationSubmittedIst: string;
  notSubmitted: string;
  currentActiveConnections: string;
  currentActiveConnectionsHint: string;
  currentRoutedDeliveriesThisMonthIst: string;
  okFailed: (ok: string, failed: string) => string;
  currentRoutedSuccessRateThisMonthIst: string;
  noDecidedDeliveries: string;
  recentOnboardingActivity: string;
  noActivityRecorded: string;
  publicRegistration: string;
  active: string;
  suspended: string;
  form: {
    name: string;
    referralCode: string;
    referralCodeHint: string;
    saveVendor: string;
    saving: string;
    vendorSaved: string;
    failedToSaveVendor: string;
    retryInvitationSms: string;
    reissueInvitationSms: string;
    reissueSmsUncertain: string;
    confirmSendNewSms: string;
    confirmUncertainReissue: string;
    approve: string;
    reject: string;
    confirmApprove: string;
    confirmReject: string;
    suspendVendor: string;
    reactivateVendor: string;
    confirmSuspend: string;
    confirmReactivate: string;
    approveCompleted: string;
    rejectCompleted: string;
    suspendCompleted: string;
    reactivateCompleted: string;
    smsRetryCompleted: string;
    smsReissueCompleted: string;
    failedToApprove: string;
    failedToReject: string;
    failedToSuspend: string;
    failedToReactivate: string;
    failedToSendSms: string;
  };
};

const ADMIN_VENDOR_DETAIL_DICT: Record<Locale, AdminVendorDetailDict> = {
  en: {
    backToVendors: "Back to vendors",
    vendorWasCreatedBut: (issue) => `The vendor was created, but ${issue}`,
    mobile: "Mobile",
    latestInvitation: "Latest invitation",
    registrationSubmittedIst: "Registration submitted (IST)",
    notSubmitted: "Not submitted",
    currentActiveConnections: "Current active connections",
    currentActiveConnectionsHint: "Current active channel routing; distinct from referrals",
    currentRoutedDeliveriesThisMonthIst: "Current-routed deliveries this month (IST)",
    okFailed: (ok, failed) => `${ok} ok · ${failed} failed`,
    currentRoutedSuccessRateThisMonthIst: "Current-routed success rate this month (IST)",
    noDecidedDeliveries: "No decided deliveries",
    recentOnboardingActivity: "Recent onboarding activity",
    noActivityRecorded: "No activity recorded.",
    publicRegistration: "Public registration",
    active: "Active",
    suspended: "Suspended",
    form: {
      name: "Name",
      referralCode: "Referral code",
      referralCodeHint: "One code per vendor. Letters, numbers, and hyphens (2-32 characters).",
      saveVendor: "Save vendor",
      saving: "Saving…",
      vendorSaved: "Vendor saved",
      failedToSaveVendor: "Failed to save vendor",
      retryInvitationSms: "Retry invitation SMS",
      reissueInvitationSms: "Reissue invitation SMS",
      reissueSmsUncertain: "Reissue SMS (delivery uncertain)",
      confirmSendNewSms:
        "Send a new registration SMS? Any previous invitation will be revoked.",
      confirmUncertainReissue:
        "SMS delivery is uncertain and the current invitation remains valid. Verify with the vendor before reissuing; continuing will revoke the current invitation.",
      approve: "Approve",
      reject: "Reject",
      confirmApprove: "Approve this vendor registration?",
      confirmReject: "Reject this vendor registration?",
      suspendVendor: "Suspend vendor",
      reactivateVendor: "Reactivate vendor",
      confirmSuspend: "Suspend this active vendor?",
      confirmReactivate: "Reactivate this approved vendor?",
      approveCompleted: "Approve completed",
      rejectCompleted: "Reject completed",
      suspendCompleted: "Suspend completed",
      reactivateCompleted: "Reactivate completed",
      smsRetryCompleted: "Retry SMS completed",
      smsReissueCompleted: "Reissue SMS completed",
      failedToApprove: "Failed to approve",
      failedToReject: "Failed to reject",
      failedToSuspend: "Failed to suspend",
      failedToReactivate: "Failed to reactivate",
      failedToSendSms: "Failed to send SMS",
    },
  },
  hi: {
    backToVendors: "वेंडर पर वापस जाएँ",
    vendorWasCreatedBut: (issue) => `वेंडर बन गया, लेकिन ${issue}`,
    mobile: "मोबाइल",
    latestInvitation: "पिछला इनविटेशन",
    registrationSubmittedIst: "रजिस्ट्रेशन सबमिट हुआ (IST)",
    notSubmitted: "सबमिट नहीं हुआ",
    currentActiveConnections: "करंट एक्टिव कनेक्शन",
    currentActiveConnectionsHint: "करंट एक्टिव चैनल रूटिंग; रेफ़रल से अलग",
    currentRoutedDeliveriesThisMonthIst: "करंट-रूटेड डिलीवरी इस महीने (IST)",
    okFailed: (ok, failed) => `${ok} ओके · ${failed} फ़ेल`,
    currentRoutedSuccessRateThisMonthIst: "करंट-रूटेड सक्सेस रेट इस महीने (IST)",
    noDecidedDeliveries: "कोई तय डिलीवरी नहीं",
    recentOnboardingActivity: "हाल की ऑनबोर्डिंग एक्टिविटी",
    noActivityRecorded: "कोई एक्टिविटी रिकॉर्ड नहीं हुई।",
    publicRegistration: "पब्लिक रजिस्ट्रेशन",
    active: "एक्टिव",
    suspended: "सस्पेंडेड",
    form: {
      name: "नाम",
      referralCode: "रेफ़रल कोड",
      referralCodeHint: "हर वेंडर का एक कोड। अक्षर, नंबर, और हाइफ़न (2-32 अक्षर)।",
      saveVendor: "वेंडर सेव करें",
      saving: "सेव हो रहा है…",
      vendorSaved: "वेंडर सेव हुआ",
      failedToSaveVendor: "वेंडर सेव नहीं हो सका",
      retryInvitationSms: "इनविटेशन SMS फिर भेजें",
      reissueInvitationSms: "इनविटेशन SMS दोबारा भेजें",
      reissueSmsUncertain: "SMS दोबारा भेजें (डिलीवरी अनिश्चित)",
      confirmSendNewSms:
        "नया रजिस्ट्रेशन SMS भेजें? पिछला इनविटेशन रद्द हो जाएगा।",
      confirmUncertainReissue:
        "SMS डिलीवरी अनिश्चित है और मौजूदा इनविटेशन अभी भी मान्य है। दोबारा भेजने से पहले वेंडर से पुष्टि करें; आगे बढ़ने पर मौजूदा इनविटेशन रद्द हो जाएगा।",
      approve: "अप्रूव करें",
      reject: "रिजेक्ट करें",
      confirmApprove: "इस वेंडर रजिस्ट्रेशन को अप्रूव करें?",
      confirmReject: "इस वेंडर रजिस्ट्रेशन को रिजेक्ट करें?",
      suspendVendor: "वेंडर सस्पेंड करें",
      reactivateVendor: "वेंडर फिर से एक्टिव करें",
      confirmSuspend: "इस एक्टिव वेंडर को सस्पेंड करें?",
      confirmReactivate: "इस अप्रूव्ड वेंडर को फिर से एक्टिव करें?",
      approveCompleted: "अप्रूव हो गया",
      rejectCompleted: "रिजेक्ट हो गया",
      suspendCompleted: "सस्पेंड हो गया",
      reactivateCompleted: "फिर से एक्टिव हो गया",
      smsRetryCompleted: "SMS फिर भेजा गया",
      smsReissueCompleted: "SMS दोबारा भेजा गया",
      failedToApprove: "अप्रूव नहीं हो सका",
      failedToReject: "रिजेक्ट नहीं हो सका",
      failedToSuspend: "सस्पेंड नहीं हो सका",
      failedToReactivate: "फिर से एक्टिव नहीं हो सका",
      failedToSendSms: "SMS नहीं भेजा जा सका",
    },
  },
  mr: {
    backToVendors: "व्हेंडरवर परत जा",
    vendorWasCreatedBut: (issue) => `व्हेंडर तयार झाला, पण ${issue}`,
    mobile: "मोबाइल",
    latestInvitation: "मागील इनव्हिटेशन",
    registrationSubmittedIst: "रजिस्ट्रेशन सबमिट झाले (IST)",
    notSubmitted: "सबमिट झाले नाही",
    currentActiveConnections: "करंट अ‍ॅक्टिव्ह कनेक्शन्स",
    currentActiveConnectionsHint: "करंट अ‍ॅक्टिव्ह चॅनेल राउटिंग; रेफरलपेक्षा वेगळे",
    currentRoutedDeliveriesThisMonthIst: "करंट-राउटेड डिलिव्हरी या महिन्यात (IST)",
    okFailed: (ok, failed) => `${ok} ओके · ${failed} फेल`,
    currentRoutedSuccessRateThisMonthIst: "करंट-राउटेड सक्सेस रेट या महिन्यात (IST)",
    noDecidedDeliveries: "कोणतीही ठरलेली डिलिव्हरी नाही",
    recentOnboardingActivity: "अलीकडील ऑनबोर्डिंग अ‍ॅक्टिव्हिटी",
    noActivityRecorded: "कोणतीही अ‍ॅक्टिव्हिटी रेकॉर्ड झाली नाही.",
    publicRegistration: "पब्लिक रजिस्ट्रेशन",
    active: "अ‍ॅक्टिव्ह",
    suspended: "सस्पेंडेड",
    form: {
      name: "नाव",
      referralCode: "रेफरल कोड",
      referralCodeHint: "प्रत्येक व्हेंडरचा एक कोड. अक्षरे, अंक, आणि हायफन (2-32 अक्षरे).",
      saveVendor: "व्हेंडर सेव्ह करा",
      saving: "सेव्ह होत आहे…",
      vendorSaved: "व्हेंडर सेव्ह झाला",
      failedToSaveVendor: "व्हेंडर सेव्ह होऊ शकला नाही",
      retryInvitationSms: "इनव्हिटेशन SMS पुन्हा पाठवा",
      reissueInvitationSms: "इनव्हिटेशन SMS पुन्हा जारी करा",
      reissueSmsUncertain: "SMS पुन्हा पाठवा (डिलिव्हरी अनिश्चित)",
      confirmSendNewSms:
        "नवीन रजिस्ट्रेशन SMS पाठवायचे? मागील इनव्हिटेशन रद्द होईल.",
      confirmUncertainReissue:
        "SMS डिलिव्हरी अनिश्चित आहे आणि सध्याचे इनव्हिटेशन अजून वैध आहे. पुन्हा पाठवण्यापूर्वी व्हेंडरकडून खात्री करा; पुढे गेल्यास सध्याचे इनव्हिटेशन रद्द होईल.",
      approve: "अ‍ॅप्रूव्ह करा",
      reject: "रिजेक्ट करा",
      confirmApprove: "या व्हेंडर रजिस्ट्रेशनला अ‍ॅप्रूव्ह करायचे?",
      confirmReject: "या व्हेंडर रजिस्ट्रेशनला रिजेक्ट करायचे?",
      suspendVendor: "व्हेंडर सस्पेंड करा",
      reactivateVendor: "व्हेंडर पुन्हा अ‍ॅक्टिव्ह करा",
      confirmSuspend: "या अ‍ॅक्टिव्ह व्हेंडरला सस्पेंड करायचे?",
      confirmReactivate: "या अ‍ॅप्रूव्ह्ड व्हेंडरला पुन्हा अ‍ॅक्टिव्ह करायचे?",
      approveCompleted: "अ‍ॅप्रूव्ह झाले",
      rejectCompleted: "रिजेक्ट झाले",
      suspendCompleted: "सस्पेंड झाले",
      reactivateCompleted: "पुन्हा अ‍ॅक्टिव्ह झाले",
      smsRetryCompleted: "SMS पुन्हा पाठवला",
      smsReissueCompleted: "SMS पुन्हा जारी केला",
      failedToApprove: "अ‍ॅप्रूव्ह होऊ शकले नाही",
      failedToReject: "रिजेक्ट होऊ शकले नाही",
      failedToSuspend: "सस्पेंड होऊ शकले नाही",
      failedToReactivate: "पुन्हा अ‍ॅक्टिव्ह होऊ शकले नाही",
      failedToSendSms: "SMS पाठवला जाऊ शकला नाही",
    },
  },
};

export function getAdminVendorDetailDict(locale: Locale): AdminVendorDetailDict {
  return ADMIN_VENDOR_DETAIL_DICT[locale];
}
