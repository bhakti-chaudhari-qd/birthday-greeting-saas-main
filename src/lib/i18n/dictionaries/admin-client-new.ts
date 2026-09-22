import type { Locale } from "../constants";

export type AdminClientNewDict = {
  title: string;
  description: string;
  backToClients: string;
  clientName: string;
  ownerName: string;
  ownerEmail: string;
  ownerMobile: string;
  mobilePlaceholder: string;
  initialPassword: string;
  passwordHint: string;
  passwordShareNote: string;
  creating: string;
  addClient: string;
  failedToCreateClient: string;
};

const ADMIN_CLIENT_NEW_DICT: Record<Locale, AdminClientNewDict> = {
  en: {
    title: "Add client",
    description:
      "Create a client and its Owner account. The Owner signs in with the email and password set here.",
    backToClients: "Back to clients",
    clientName: "Client name",
    ownerName: "Owner name",
    ownerEmail: "Owner email",
    ownerMobile: "Owner mobile",
    mobilePlaceholder: "10-digit mobile number",
    initialPassword: "Initial password",
    passwordHint: "At least 10 characters, or 8+ with uppercase, lowercase, and a number.",
    passwordShareNote: "Share it with the client securely; they can change it after signing in.",
    creating: "Creating…",
    addClient: "Add client",
    failedToCreateClient: "Failed to create client",
  },
  hi: {
    title: "क्लायंट जोड़ें",
    description:
      "क्लायंट और उसका Owner अकाउंट बनाएँ। Owner यहाँ सेट किए गए ईमेल और पासवर्ड से साइन इन करता है।",
    backToClients: "क्लायंट पर वापस जाएँ",
    clientName: "क्लायंट का नाम",
    ownerName: "Owner का नाम",
    ownerEmail: "Owner का ईमेल",
    ownerMobile: "Owner का मोबाइल",
    mobilePlaceholder: "10 अंकों का मोबाइल नंबर",
    initialPassword: "शुरुआती पासवर्ड",
    passwordHint: "कम से कम 10 अक्षर, या 8+ के साथ बड़े-छोटे अक्षर और एक अंक।",
    passwordShareNote:
      "इसे क्लायंट के साथ सुरक्षित तरीके से शेयर करें; साइन इन करने के बाद वे इसे बदल सकते हैं।",
    creating: "बन रहा है…",
    addClient: "क्लायंट जोड़ें",
    failedToCreateClient: "क्लायंट नहीं बन सका",
  },
  mr: {
    title: "क्लायंट जोडा",
    description:
      "क्लायंट आणि त्याचे Owner खाते तयार करा. Owner इथे सेट केलेल्या ईमेल आणि पासवर्डने साइन इन करतो.",
    backToClients: "क्लायंटवर परत जा",
    clientName: "क्लायंटचे नाव",
    ownerName: "Owner चे नाव",
    ownerEmail: "Owner चा ईमेल",
    ownerMobile: "Owner चा मोबाइल",
    mobilePlaceholder: "10 अंकी मोबाइल नंबर",
    initialPassword: "सुरुवातीचा पासवर्ड",
    passwordHint: "किमान 10 अक्षरे, किंवा 8+ सह मोठी-लहान अक्षरे आणि एक अंक.",
    passwordShareNote:
      "हे क्लायंटसोबत सुरक्षितपणे शेअर करा; साइन इन केल्यानंतर ते बदलू शकतात.",
    creating: "तयार होत आहे…",
    addClient: "क्लायंट जोडा",
    failedToCreateClient: "क्लायंट तयार होऊ शकला नाही",
  },
};

export function getAdminClientNewDict(locale: Locale): AdminClientNewDict {
  return ADMIN_CLIENT_NEW_DICT[locale];
}
