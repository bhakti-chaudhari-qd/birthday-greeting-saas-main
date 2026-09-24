import type { Locale } from "../constants";

export type AdminClientDetailDict = {
  tabs: {
    overview: string;
    billing: string;
    activity: string;
    users: string;
    contacts: string;
  };
  page: {
    backToList: string;
    created: string;
    active: string;
    inactive: string;
    contacts: string;
    messagesThisMonth: string;
    users: string;
    outstandingBalance: string;
    outstandingBalanceHint: string;
    loading: string;
    usersTabDescription: string;
  };
  overview: {
    clientHealth: string;
    executableRoutes: string;
    categoryRules: string;
    deliveryThisMonth: string;
    ok: string;
    failed: string;
    queueRightNow: string;
    pending: string;
    stuck: string;
    retrying: string;
    activeConfiguredChannels: string;
    none: string;
    successRateThisMonth: string;
    noDecidedDeliveries: string;
    clientSettings: string;
    clientSettingsDescription: string;
  };
  opsForm: {
    clientActive: string;
    approveLiveCustomHttp: string;
    allowStaffVisibility: string;
    allowStaffVisibilityHint: string;
    timezone: string;
    saving: string;
    saveOpsSettings: string;
    failedToSaveClient: string;
    clientUpdated: string;
    deactivateTitle: string;
    deactivateMessage: (name: string) => string;
    deactivate: string;
    cancel: string;
  };
  billing: {
    activatePlan: string;
    activatePlanDescription: string;
    dealHistory: string;
    dealHistoryDescription: string;
    channelTopUps: string;
    channelTopUpsDescription: string;
    recordPayment: string;
    recordPaymentDescription: string;
    paymentLinks: string;
    paymentLinksDescription: string;
  };
  planActivation: {
    currentPlan: string;
    limits: string;
    contactsWord: string;
    messagesPerMonth: string;
    sent: string;
    accessUntil: string;
    notSet: string;
    description: string;
    plan: string;
    amountInr: string;
    optionalOverride: string;
    durationDays: string;
    contactLimit: string;
    smsMessagesPerMonth: string;
    whatsappMessagesPerMonth: string;
    emailMessagesPerMonth: string;
    totalMonthlyMessages: string;
    totalMonthlyMessagesHint: string;
    customerEmail: string;
    creatingLink: string;
    createPaymentLink: string;
    activating: string;
    activateWithoutPayment: string;
    activateWithoutPaymentNote: (durationDays: number) => string;
    link: string;
    amountPreview: string;
    failedToCreateLink: string;
    failedToActivate: string;
    linkCreatedSuccess: (planLabel: string) => string;
    activatedSuccess: (planLabel: string) => string;
    confirmRenewalTitle: string;
    continueAnyway: string;
    cancel: string;
    paymentLinkWarning: (
      activeLabel: string,
      paidUntil: string,
      changingPlan: boolean,
      dealLabel: string,
    ) => string;
    renewalWarning: (
      activeLabel: string,
      paidUntil: string,
      changingPlan: boolean,
      dealLabel: string,
      newPaidUntil: string,
      amountLabel: string,
    ) => string;
    itsCatalougePrice: string;
  };
  dealHistory: {
    noDeals: string;
    activated: string;
    plan: string;
    source: string;
    amount: string;
    status: string;
    duration: string;
    limits: string;
    expiryAfterDeal: string;
    messagesPerMonth: string;
  };
  channelTopUp: {
    hint: string;
    channel: string;
    messagesToAdd: string;
    amountInr: string;
    currentLimit: (
      channel: string,
      used: string,
      limit: string,
    ) => string;
    currentLimitNoAllocation: string;
    adding: string;
    addCapacity: string;
    failedToAdd: string;
    addedSuccess: (count: string, channel: string) => string;
    history: string;
    noTopUps: string;
    date: string;
    messagesAdded: string;
    total: string;
    status: string;
  };
  recordPayment: {
    amountInr: string;
    note: string;
    optional: string;
    hint: string;
    recording: string;
    recordPayment: string;
    failedToRecord: string;
    recordedSuccess: string;
    history: string;
    by: (name: string) => string;
  };
  paymentLinks: {
    noLinks: string;
    created: string;
    plan: string;
    amount: string;
    status: string;
    duration: string;
    cancelling: string;
    cancel: string;
    failedToCancel: string;
    cancelTitle: string;
    cancelMessage: string;
    cancelLink: string;
    keepIt: string;
  };
  activity: {
    failedQueueDiagnostics: string;
    failedQueueDescription: string;
    recentActivity: string;
    recentActivityDescription: string;
    noActivity: string;
    deletedAdmin: string;
  };
  failedQueue: {
    refresh: string;
    refreshing: string;
    ambiguousConfirm: string;
    failedToRetry: string;
    queue: string;
    channel: string;
    failure: string;
    attempts: string;
    updated: string;
    action: string;
    noFailedItems: string;
    scheduling: string;
    retry: string;
  };
  usersTable: {
    name: string;
    email: string;
    role: string;
    status: string;
    action: string;
    noUsers: string;
    updating: string;
    deactivate: string;
    activate: string;
    sending: string;
    sendPasswordReset: string;
    failedToUpdate: string;
    failedToSendReset: string;
    resetEmailSentDefault: string;
    active: string;
    inactive: string;
    deactivateTitle: string;
    deactivateMessage: (name: string, email: string) => string;
    deactivateConfirm: string;
    cancel: string;
    addUser: string;
  };
  addUser: {
    name: string;
    role: string;
    staff: string;
    owner: string;
    email: string;
    mobile: string;
    optional: string;
    initialPassword: string;
    passwordHint: string;
    adding: string;
    add: string;
    cancel: string;
    failedToAdd: string;
  };
  contactsTab: {
    title: string;
    description: string;
    addContact: string;
    addContactDescription: string;
    name: string;
    mobile: string;
    birthday: string;
    optional: string;
    email: string;
    category: string;
    newCategory: string;
    cancel: string;
    additionalCategories: string;
    additionalCategoriesHint: string;
    noCategory: string;
    adding: string;
    add: string;
    failedToAdd: string;
    addedSuccess: (name: string) => string;
    importTitle: string;
    importDescription: string;
    importing: string;
    importSummary: (
      created: number,
      updated: number,
      duplicate: number,
      limit: number,
      invalid: number,
    ) => string;
    failedToImport: string;
  };
};

const ADMIN_CLIENT_DETAIL_DICT: Record<Locale, AdminClientDetailDict> = {
  en: {
    tabs: {
      overview: "Overview",
      billing: "Billing",
      activity: "Activity",
      users: "Users",
      contacts: "Contacts",
    },
    page: {
      backToList: "Back to list",
      created: "Created",
      active: "Active",
      inactive: "Inactive",
      contacts: "Contacts",
      messagesThisMonth: "Messages this month",
      users: "Users",
      outstandingBalance: "Outstanding balance",
      outstandingBalanceHint: "Settles via payments — never affects access",
      loading: "Loading…",
      usersTabDescription:
        "Activate or deactivate client users (Owner / Staff), or add one directly.",
    },
    overview: {
      clientHealth: "Client health",
      executableRoutes: "Executable routes",
      categoryRules: "Category rules",
      deliveryThisMonth: "Delivery, this month (IST)",
      ok: "ok",
      failed: "failed",
      queueRightNow: "Queue right now",
      pending: "pending",
      stuck: "stuck",
      retrying: "retrying",
      activeConfiguredChannels: "Active configured channels",
      none: "None",
      successRateThisMonth: "Success rate this month (IST)",
      noDecidedDeliveries: "No decided deliveries",
      clientSettings: "Client settings",
      clientSettingsDescription:
        "Active/inactive, live Custom HTTP approval, and timezone. Not related to billing.",
    },
    opsForm: {
      clientActive: "Client active",
      approveLiveCustomHttp: "Approve live Custom HTTP (even on FREE)",
      allowStaffVisibility: "Allow Staff to see admin-added contact details",
      allowStaffVisibilityHint:
        "Sets the ceiling only - the client's Owner still decides whether Staff actually sees it. Turn off to force-hide it regardless of what the Owner sets.",
      timezone: "Timezone",
      saving: "Saving…",
      saveOpsSettings: "Save ops settings",
      failedToSaveClient: "Failed to save client",
      clientUpdated: "Client updated.",
      deactivateTitle: "Deactivate client?",
      deactivateMessage: (name) =>
        `${name} and everyone in it will immediately lose access. This can be undone later by re-activating the client.`,
      deactivate: "Deactivate",
      cancel: "Cancel",
    },
    billing: {
      activatePlan: "Activate a plan",
      activatePlanDescription:
        "Razorpay payment links for STARTER/PRO/CUSTOM, or activate immediately without payment.",
      dealHistory: "Deal history",
      dealHistoryDescription:
        "Every STARTER/PRO/CUSTOM deal activated for this org, independent of access/expiry.",
      channelTopUps: "Channel top-ups",
      channelTopUpsDescription:
        "CUSTOM plan only: add capacity to one channel for the current period without a new deal.",
      recordPayment: "Record a payment",
      recordPaymentDescription:
        "Settles the outstanding balance only — never changes access or the expiry date.",
      paymentLinks: "Payment links",
      paymentLinksDescription:
        "History for all plans. Creating a new link auto-cancels any still-outstanding one for this org.",
    },
    planActivation: {
      currentPlan: "Current plan",
      limits: "Limits",
      contactsWord: "contacts",
      messagesPerMonth: "messages/mo",
      sent: "sent",
      accessUntil: "Access until",
      notSet: "Not set",
      description:
        "Create a Razorpay link for STARTER, PRO, or a CUSTOM deal — limits apply only after the client pays. You can also activate immediately without payment and settle later (see below).",
      plan: "Plan",
      amountInr: "Amount (INR)",
      optionalOverride: " optional override",
      durationDays: "Duration (days)",
      contactLimit: "Contact limit",
      smsMessagesPerMonth: "SMS messages/mo",
      whatsappMessagesPerMonth: "WhatsApp messages/mo",
      emailMessagesPerMonth: "Email messages/mo",
      totalMonthlyMessages: "Total monthly messages",
      totalMonthlyMessagesHint:
        "(computed automatically as SMS + WhatsApp + Email)",
      customerEmail: "Customer email (optional)",
      creatingLink: "Creating link…",
      createPaymentLink: "Create Razorpay payment link",
      activating: "Activating…",
      activateWithoutPayment: "Activate Without Payment",
      activateWithoutPaymentNote: (durationDays) =>
        `"Activate Without Payment" turns on access and starts the ${durationDays}-day period immediately; the amount (catalogue price for STARTER/PRO unless overridden above) is tracked as outstanding balance below until you record a payment. It never extends/restarts access on its own.`,
      link: "Link",
      amountPreview: "Amount preview",
      failedToCreateLink: "Failed to create payment link",
      failedToActivate: "Failed to activate deal",
      linkCreatedSuccess: (planLabel) =>
        `Payment link created for ${planLabel}. Send it to the client — plan updates only after Razorpay payment.`,
      activatedSuccess: (planLabel) =>
        `${planLabel} activated immediately — access is live now. Payment is tracked separately in the ledger below.`,
      confirmRenewalTitle: "Confirm renewal",
      continueAnyway: "Continue anyway",
      cancel: "Cancel",
      paymentLinkWarning: (activeLabel, paidUntil, changingPlan, dealLabel) =>
        `This client already has an active ${activeLabel} plan until ${paidUntil}. Once paid, this link will ${changingPlan ? `replace it with ${dealLabel}` : `renew it, extending access from ${paidUntil}`}.`,
      renewalWarning: (
        activeLabel,
        paidUntil,
        changingPlan,
        dealLabel,
        newPaidUntil,
        amountLabel,
      ) =>
        `This client already has an active ${activeLabel} plan until ${paidUntil}. Activating ${dealLabel} will ${changingPlan ? "switch the plan and extend" : "extend"} access to ${newPaidUntil} and add ${amountLabel} to the outstanding balance.`,
      itsCatalougePrice: "its catalogue price",
    },
    dealHistory: {
      noDeals: "No plan deals activated yet.",
      activated: "Activated",
      plan: "Plan",
      source: "Source",
      amount: "Amount",
      status: "Status",
      duration: "Duration",
      limits: "Limits",
      expiryAfterDeal: "Expiry after this deal",
      messagesPerMonth: "messages/mo",
    },
    channelTopUp: {
      hint: "Increases one channel's limit for the current period only — never extends access or resets the other channels.",
      channel: "Channel",
      messagesToAdd: "Messages to add",
      amountInr: "Amount (INR)",
      currentLimit: (channel, used, limit) =>
        `Current ${channel} limit: ${used} / ${limit} used this month`,
      currentLimitNoAllocation:
        "no dedicated allocation yet — using the shared aggregate limit",
      adding: "Adding…",
      addCapacity: "Add Capacity Without Payment",
      failedToAdd: "Failed to add channel capacity",
      addedSuccess: (count, channel) =>
        `Added ${count} messages to ${channel}. Access and expiry are unchanged.`,
      history: "Channel top-up history",
      noTopUps: "No channel top-ups added yet.",
      date: "Date",
      messagesAdded: "Messages added",
      total: "total",
      status: "Status",
    },
    recordPayment: {
      amountInr: "Amount (INR)",
      note: "Note",
      optional: "(optional)",
      hint: "Applied automatically to the oldest unpaid deal(s)/top-up(s) first.",
      recording: "Recording…",
      recordPayment: "Record payment",
      failedToRecord: "Failed to record payment",
      recordedSuccess:
        "Payment recorded. It does not change access or the expiry date.",
      history: "Payment history",
      by: (name) => `(by ${name})`,
    },
    paymentLinks: {
      noLinks: "No payment links created yet.",
      created: "Created",
      plan: "Plan",
      amount: "Amount",
      status: "Status",
      duration: "Duration",
      cancelling: "Cancelling…",
      cancel: "Cancel",
      failedToCancel: "Failed to cancel payment link",
      cancelTitle: "Cancel payment link?",
      cancelMessage: "It will no longer be payable. This can't be undone from here.",
      cancelLink: "Cancel link",
      keepIt: "Keep it",
    },
    activity: {
      failedQueueDiagnostics: "Failed queue diagnostics",
      failedQueueDescription:
        "Safe operational details only. Ambiguous retries require duplicate risk confirmation.",
      recentActivity: "Recent Platform Admin activity",
      recentActivityDescription: "Security-relevant changes recorded for this client.",
      noActivity: "No Platform Admin activity recorded yet.",
      deletedAdmin: "Deleted Platform Admin",
    },
    failedQueue: {
      refresh: "Refresh",
      refreshing: "Refreshing…",
      ambiguousConfirm:
        "This may send a second message if the first already went through. Retry anyway?",
      failedToRetry: "Failed to schedule retry",
      queue: "Queue",
      channel: "Channel",
      failure: "Failure",
      attempts: "Attempts",
      updated: "Updated",
      action: "Action",
      noFailedItems: "No failed queue items.",
      scheduling: "Scheduling…",
      retry: "Retry",
    },
    usersTable: {
      name: "Name",
      email: "Email",
      role: "Role",
      status: "Status",
      action: "Action",
      noUsers: "No users in this client.",
      updating: "Updating…",
      deactivate: "Deactivate",
      activate: "Activate",
      sending: "Sending…",
      sendPasswordReset: "Send password reset link",
      failedToUpdate: "Failed to update user",
      failedToSendReset: "Failed to send password reset email",
      resetEmailSentDefault: "Password reset email sent",
      active: "Active",
      inactive: "Inactive",
      deactivateTitle: "Deactivate user?",
      deactivateMessage: (name, email) =>
        `${name} (${email}) will immediately lose access to this client. They can be reactivated later.`,
      deactivateConfirm: "Deactivate",
      cancel: "Cancel",
      addUser: "+ Add user",
    },
    addUser: {
      name: "Name",
      role: "Role",
      staff: "Staff",
      owner: "Owner",
      email: "Email",
      mobile: "Mobile",
      optional: "(optional)",
      initialPassword: "Initial password",
      passwordHint:
        "At least 10 characters, or 8+ with uppercase, lowercase, and a number. Share it with the client securely.",
      adding: "Adding…",
      add: "Add user",
      cancel: "Cancel",
      failedToAdd: "Failed to add user",
    },
    contactsTab: {
      title: "Contacts",
      description:
        "Add contacts to this client's account, or import a CSV/Excel file on their behalf.",
      addContact: "Add a contact",
      addContactDescription:
        "Adds a contact directly into this client's account, the same as if they added it themselves. Useful when onboarding a client who has handed you their contact list.",
      name: "Name",
      mobile: "Mobile",
      birthday: "Birthday",
      optional: "(optional)",
      email: "Email",
      category: "Category",
      newCategory: "+ New category",
      cancel: "Cancel",
      additionalCategories: "Additional categories (optional)",
      additionalCategoriesHint:
        "A contact can belong to more than one category, same as on the client's own Contacts page.",
      noCategory: "No category",
      adding: "Adding…",
      add: "Add contact",
      failedToAdd: "Failed to add contact",
      addedSuccess: (name) => `Added ${name}.`,
      importTitle: "Import contacts (CSV/Excel)",
      importDescription:
        "Columns: Name, Mobile, Email, Birthday, Category (matches this client's existing custom fields and occasions automatically). For files with thousands of rows, prefer the client's own dashboard, which processes large imports in the background.",
      importing: "Importing…",
      importSummary: (created, updated, duplicate, limit, invalid) =>
        `${created} added · ${updated} updated · ${duplicate} duplicate · ${limit} skipped (limit) · ${invalid} invalid`,
      failedToImport: "Failed to import contacts",
    },
  },
  hi: {
    tabs: {
      overview: "ओवरव्यू",
      billing: "बिलिंग",
      activity: "एक्टिविटी",
      users: "यूज़र",
      contacts: "कॉन्टैक्ट",
    },
    page: {
      backToList: "लिस्ट पर वापस जाएँ",
      created: "बनाया गया",
      active: "एक्टिव",
      inactive: "इनएक्टिव",
      contacts: "कॉन्टैक्ट",
      messagesThisMonth: "इस महीने के मेसेज",
      users: "यूज़र",
      outstandingBalance: "बकाया राशि",
      outstandingBalanceHint: "पेमेंट से सेटल होती है — एक्सेस पर कभी असर नहीं",
      loading: "लोड हो रहा है…",
      usersTabDescription:
        "क्लायंट यूज़र (Owner / Staff) को एक्टिव या इनएक्टिव करें, या नया यूज़र सीधे जोड़ें।",
    },
    overview: {
      clientHealth: "क्लायंट हेल्थ",
      executableRoutes: "चलने योग्य रूट्स",
      categoryRules: "कैटेगरी नियम",
      deliveryThisMonth: "डिलीवरी, इस महीने (IST)",
      ok: "ठीक",
      failed: "फेल",
      queueRightNow: "अभी क्यू में",
      pending: "पेंडिंग",
      stuck: "अटका हुआ",
      retrying: "फिर से कोशिश हो रही है",
      activeConfiguredChannels: "एक्टिव कॉन्फ़िगर किए गए चैनल",
      none: "कोई नहीं",
      successRateThisMonth: "इस महीने सफलता दर (IST)",
      noDecidedDeliveries: "कोई तय डिलीवरी नहीं",
      clientSettings: "क्लायंट सेटिंग्स",
      clientSettingsDescription:
        "एक्टिव/इनएक्टिव, लाइव Custom HTTP अप्रूवल, और टाइमज़ोन। बिलिंग से संबंधित नहीं।",
    },
    opsForm: {
      clientActive: "क्लायंट एक्टिव",
      approveLiveCustomHttp: "लाइव Custom HTTP मंज़ूर करें (FREE पर भी)",
      allowStaffVisibility: "स्टाफ को admin द्वारा जोड़े गए कॉन्टैक्ट की डिटेल देखने दें",
      allowStaffVisibilityHint:
        "यह सिर्फ ऊपरी सीमा सेट करता है - क्लायंट का Owner अभी भी तय करता है कि स्टाफ को असल में दिखे या नहीं। Owner ने जो भी सेट किया हो, इसे बंद करने पर यह हमेशा छुपा रहेगा।",
      timezone: "टाइमज़ोन",
      saving: "सेव हो रहा है…",
      saveOpsSettings: "ऑप्स सेटिंग्स सेव करें",
      failedToSaveClient: "क्लायंट सेव नहीं हो सका",
      clientUpdated: "क्लायंट अपडेट हो गया।",
      deactivateTitle: "क्लायंट इनएक्टिव करें?",
      deactivateMessage: (name) =>
        `${name} और उसमें मौजूद सभी की एक्सेस तुरंत बंद हो जाएगी। बाद में क्लायंट को फिर से एक्टिव करके इसे वापस किया जा सकता है।`,
      deactivate: "इनएक्टिव करें",
      cancel: "रद्द करें",
    },
    billing: {
      activatePlan: "प्लान एक्टिवेट करें",
      activatePlanDescription:
        "STARTER/PRO/CUSTOM के लिए Razorpay पेमेंट लिंक, या बिना पेमेंट के तुरंत एक्टिवेट करें।",
      dealHistory: "डील हिस्ट्री",
      dealHistoryDescription:
        "इस org के लिए एक्टिवेट की गई हर STARTER/PRO/CUSTOM डील, एक्सेस/एक्सपायरी से अलग।",
      channelTopUps: "चैनल टॉप-अप",
      channelTopUpsDescription:
        "सिर्फ CUSTOM प्लान: नई डील के बिना, मौजूदा पीरियड के लिए एक चैनल की क्षमता बढ़ाएँ।",
      recordPayment: "पेमेंट रिकॉर्ड करें",
      recordPaymentDescription:
        "सिर्फ बकाया राशि सेटल करता है — एक्सेस या एक्सपायरी डेट कभी नहीं बदलता।",
      paymentLinks: "पेमेंट लिंक",
      paymentLinksDescription:
        "सभी प्लान की हिस्ट्री। नया लिंक बनाने पर इस org का पहले से बकाया कोई भी लिंक अपने आप रद्द हो जाता है।",
    },
    planActivation: {
      currentPlan: "मौजूदा प्लान",
      limits: "सीमाएँ",
      contactsWord: "कॉन्टैक्ट",
      messagesPerMonth: "मेसेज/महीना",
      sent: "भेजे गए",
      accessUntil: "एक्सेस कब तक",
      notSet: "सेट नहीं है",
      description:
        "STARTER, PRO, या CUSTOM डील के लिए Razorpay लिंक बनाएँ — सीमाएँ क्लायंट के भुगतान के बाद ही लागू होती हैं। आप बिना पेमेंट के भी तुरंत एक्टिवेट करके बाद में सेटल कर सकते हैं (नीचे देखें)।",
      plan: "प्लान",
      amountInr: "राशि (INR)",
      optionalOverride: " वैकल्पिक ओवरराइड",
      durationDays: "अवधि (दिन)",
      contactLimit: "कॉन्टैक्ट सीमा",
      smsMessagesPerMonth: "SMS मेसेज/महीना",
      whatsappMessagesPerMonth: "WhatsApp मेसेज/महीना",
      emailMessagesPerMonth: "Email मेसेज/महीना",
      totalMonthlyMessages: "कुल मासिक मेसेज",
      totalMonthlyMessagesHint: "(SMS + WhatsApp + Email के हिसाब से अपने आप जुड़ता है)",
      customerEmail: "ग्राहक का ईमेल (वैकल्पिक)",
      creatingLink: "लिंक बन रहा है…",
      createPaymentLink: "Razorpay पेमेंट लिंक बनाएँ",
      activating: "एक्टिवेट हो रहा है…",
      activateWithoutPayment: "बिना पेमेंट के एक्टिवेट करें",
      activateWithoutPaymentNote: (durationDays) =>
        `"बिना पेमेंट के एक्टिवेट करें" तुरंत एक्सेस चालू कर देता है और ${durationDays}-दिन का पीरियड शुरू कर देता है; राशि (ऊपर ओवरराइड न होने पर STARTER/PRO की कैटलॉग कीमत) तब तक बकाया राशि में दिखती रहेगी जब तक आप पेमेंट रिकॉर्ड न करें। यह अपने आप एक्सेस को न तो बढ़ाता है, न ही फिर से शुरू करता है।`,
      link: "लिंक",
      amountPreview: "राशि का पूर्वावलोकन",
      failedToCreateLink: "पेमेंट लिंक नहीं बन सका",
      failedToActivate: "डील एक्टिवेट नहीं हो सकी",
      linkCreatedSuccess: (planLabel) =>
        `${planLabel} के लिए पेमेंट लिंक बन गया। इसे क्लायंट को भेजें — Razorpay पेमेंट के बाद ही प्लान अपडेट होगा।`,
      activatedSuccess: (planLabel) =>
        `${planLabel} तुरंत एक्टिवेट हो गया — एक्सेस अभी लाइव है। पेमेंट नीचे लेजर में अलग से ट्रैक होगा।`,
      confirmRenewalTitle: "रिन्यूअल की पुष्टि करें",
      continueAnyway: "फिर भी जारी रखें",
      cancel: "रद्द करें",
      paymentLinkWarning: (activeLabel, paidUntil, changingPlan, dealLabel) =>
        `इस क्लायंट का पहले से ही ${activeLabel} प्लान ${paidUntil} तक एक्टिव है। भुगतान होने पर, यह लिंक ${changingPlan ? `इसे ${dealLabel} से बदल देगा` : `इसे रिन्यू कर देगा, और एक्सेस ${paidUntil} से आगे बढ़ जाएगी`}।`,
      renewalWarning: (
        activeLabel,
        paidUntil,
        changingPlan,
        dealLabel,
        newPaidUntil,
        amountLabel,
      ) =>
        `इस क्लायंट का पहले से ही ${activeLabel} प्लान ${paidUntil} तक एक्टिव है। ${dealLabel} एक्टिवेट करने से ${changingPlan ? "प्लान बदलकर एक्सेस बढ़ जाएगी" : "एक्सेस बढ़ जाएगी"} ${newPaidUntil} तक, और बकाया राशि में ${amountLabel} जुड़ जाएगा।`,
      itsCatalougePrice: "इसकी कैटलॉग कीमत",
    },
    dealHistory: {
      noDeals: "अभी तक कोई प्लान डील एक्टिवेट नहीं हुई।",
      activated: "एक्टिवेट किया गया",
      plan: "प्लान",
      source: "स्रोत",
      amount: "राशि",
      status: "स्टेटस",
      duration: "अवधि",
      limits: "सीमाएँ",
      expiryAfterDeal: "इस डील के बाद एक्सपायरी",
      messagesPerMonth: "मेसेज/महीना",
    },
    channelTopUp: {
      hint: "सिर्फ मौजूदा पीरियड के लिए एक चैनल की सीमा बढ़ाता है — न एक्सेस बढ़ाता है, न दूसरे चैनल रीसेट करता है।",
      channel: "चैनल",
      messagesToAdd: "जोड़े जाने वाले मेसेज",
      amountInr: "राशि (INR)",
      currentLimit: (channel, used, limit) =>
        `मौजूदा ${channel} सीमा: इस महीने ${used} / ${limit} इस्तेमाल हुए`,
      currentLimitNoAllocation:
        "अभी कोई अलग आवंटन नहीं है — शेयर्ड कुल सीमा इस्तेमाल हो रही है",
      adding: "जोड़ा जा रहा है…",
      addCapacity: "बिना पेमेंट के क्षमता जोड़ें",
      failedToAdd: "चैनल क्षमता नहीं जुड़ सकी",
      addedSuccess: (count, channel) =>
        `${channel} में ${count} मेसेज जोड़े गए। एक्सेस और एक्सपायरी में कोई बदलाव नहीं।`,
      history: "चैनल टॉप-अप हिस्ट्री",
      noTopUps: "अभी तक कोई चैनल टॉप-अप नहीं जोड़ा गया।",
      date: "तारीख़",
      messagesAdded: "जोड़े गए मेसेज",
      total: "कुल",
      status: "स्टेटस",
    },
    recordPayment: {
      amountInr: "राशि (INR)",
      note: "नोट",
      optional: "(वैकल्पिक)",
      hint: "सबसे पुरानी बकाया डील/टॉप-अप पर पहले अपने आप लागू होता है।",
      recording: "रिकॉर्ड हो रहा है…",
      recordPayment: "पेमेंट रिकॉर्ड करें",
      failedToRecord: "पेमेंट रिकॉर्ड नहीं हो सका",
      recordedSuccess: "पेमेंट रिकॉर्ड हो गया। इससे एक्सेस या एक्सपायरी डेट नहीं बदलती।",
      history: "पेमेंट हिस्ट्री",
      by: (name) => `(${name} द्वारा)`,
    },
    paymentLinks: {
      noLinks: "अभी तक कोई पेमेंट लिंक नहीं बना।",
      created: "बनाया गया",
      plan: "प्लान",
      amount: "राशि",
      status: "स्टेटस",
      duration: "अवधि",
      cancelling: "रद्द हो रहा है…",
      cancel: "रद्द करें",
      failedToCancel: "पेमेंट लिंक रद्द नहीं हो सका",
      cancelTitle: "पेमेंट लिंक रद्द करें?",
      cancelMessage: "अब इससे पेमेंट नहीं हो सकेगा। यहाँ से इसे वापस नहीं लाया जा सकता।",
      cancelLink: "लिंक रद्द करें",
      keepIt: "रहने दें",
    },
    activity: {
      failedQueueDiagnostics: "फेल क्यू डायग्नोस्टिक्स",
      failedQueueDescription:
        "सिर्फ सुरक्षित ऑपरेशनल जानकारी। अस्पष्ट रीट्राई के लिए डुप्लिकेट रिस्क की पुष्टि ज़रूरी है।",
      recentActivity: "हाल की Platform Admin एक्टिविटी",
      recentActivityDescription: "इस क्लायंट के लिए दर्ज सुरक्षा-संबंधी बदलाव।",
      noActivity: "अभी तक कोई Platform Admin एक्टिविटी दर्ज नहीं हुई।",
      deletedAdmin: "हटाया गया Platform Admin",
    },
    failedQueue: {
      refresh: "रीफ़्रेश करें",
      refreshing: "रीफ़्रेश हो रहा है…",
      ambiguousConfirm:
        "अगर पहला मेसेज पहले ही जा चुका है, तो इससे दूसरा मेसेज भी जा सकता है। फिर भी रीट्राई करें?",
      failedToRetry: "रीट्राई शेड्यूल नहीं हो सका",
      queue: "क्यू",
      channel: "चैनल",
      failure: "फेलियर",
      attempts: "कोशिशें",
      updated: "अपडेट किया गया",
      action: "एक्शन",
      noFailedItems: "कोई फेल क्यू आइटम नहीं।",
      scheduling: "शेड्यूल हो रहा है…",
      retry: "रीट्राई करें",
    },
    usersTable: {
      name: "नाम",
      email: "ईमेल",
      role: "रोल",
      status: "स्टेटस",
      action: "एक्शन",
      noUsers: "इस क्लायंट में कोई यूज़र नहीं है।",
      updating: "अपडेट हो रहा है…",
      deactivate: "इनएक्टिव करें",
      activate: "एक्टिव करें",
      sending: "भेजा जा रहा है…",
      sendPasswordReset: "पासवर्ड रीसेट लिंक भेजें",
      failedToUpdate: "यूज़र अपडेट नहीं हो सका",
      failedToSendReset: "पासवर्ड रीसेट ईमेल नहीं भेजा जा सका",
      resetEmailSentDefault: "पासवर्ड रीसेट ईमेल भेज दिया गया",
      active: "एक्टिव",
      inactive: "इनएक्टिव",
      deactivateTitle: "यूज़र इनएक्टिव करें?",
      deactivateMessage: (name, email) =>
        `${name} (${email}) की इस क्लायंट में एक्सेस तुरंत बंद हो जाएगी। बाद में इसे फिर से एक्टिव किया जा सकता है।`,
      deactivateConfirm: "इनएक्टिव करें",
      cancel: "रद्द करें",
      addUser: "+ यूज़र जोड़ें",
    },
    addUser: {
      name: "नाम",
      role: "रोल",
      staff: "स्टाफ",
      owner: "Owner",
      email: "ईमेल",
      mobile: "मोबाइल",
      optional: "(वैकल्पिक)",
      initialPassword: "शुरुआती पासवर्ड",
      passwordHint:
        "कम से कम 10 अक्षर, या 8+ के साथ बड़े-छोटे अक्षर और एक अंक। इसे क्लायंट के साथ सुरक्षित तरीके से शेयर करें।",
      adding: "जोड़ा जा रहा है…",
      add: "यूज़र जोड़ें",
      cancel: "रद्द करें",
      failedToAdd: "यूज़र नहीं जुड़ सका",
    },
    contactsTab: {
      title: "कॉन्टैक्ट",
      description:
        "इस क्लायंट के अकाउंट में कॉन्टैक्ट जोड़ें, या उनकी ओर से CSV/Excel फ़ाइल इम्पोर्ट करें।",
      addContact: "कॉन्टैक्ट जोड़ें",
      addContactDescription:
        "यह क्लायंट के अकाउंट में सीधे कॉन्टैक्ट जोड़ता है, बिल्कुल वैसे जैसे उन्होंने खुद जोड़ा हो। किसी क्लायंट को ऑनबोर्ड करते समय उपयोगी, जिसने अपनी कॉन्टैक्ट लिस्ट आपको दी हो।",
      name: "नाम",
      mobile: "मोबाइल",
      birthday: "जन्मदिन",
      optional: "(वैकल्पिक)",
      email: "ईमेल",
      category: "कैटेगरी",
      newCategory: "+ नई कैटेगरी",
      cancel: "रद्द करें",
      additionalCategories: "अतिरिक्त कैटेगरी (वैकल्पिक)",
      additionalCategoriesHint:
        "कोई कॉन्टैक्ट एक से ज़्यादा कैटेगरी में हो सकता है, ठीक वैसे ही जैसे क्लायंट के अपने Contacts पेज पर होता है।",
      noCategory: "कोई कैटेगरी नहीं",
      adding: "जोड़ा जा रहा है…",
      add: "कॉन्टैक्ट जोड़ें",
      failedToAdd: "कॉन्टैक्ट नहीं जुड़ सका",
      addedSuccess: (name) => `${name} जोड़ा गया।`,
      importTitle: "कॉन्टैक्ट इम्पोर्ट करें (CSV/Excel)",
      importDescription:
        "कॉलम: Name, Mobile, Email, Birthday, Category (इस क्लायंट के मौजूदा कस्टम फ़ील्ड और occasions से अपने आप मैच होते हैं)। हज़ारों रो वाली फ़ाइलों के लिए, क्लायंट के अपने डैशबोर्ड का इस्तेमाल करें, जो बड़े इम्पोर्ट बैकग्राउंड में प्रोसेस करता है।",
      importing: "इम्पोर्ट हो रहा है…",
      importSummary: (created, updated, duplicate, limit, invalid) =>
        `${created} जोड़े गए · ${updated} अपडेट हुए · ${duplicate} डुप्लिकेट · ${limit} स्किप (सीमा) · ${invalid} अमान्य`,
      failedToImport: "कॉन्टैक्ट इम्पोर्ट नहीं हो सके",
    },
  },
  mr: {
    tabs: {
      overview: "ओव्हरव्ह्यू",
      billing: "बिलिंग",
      activity: "अ‍ॅक्टिव्हिटी",
      users: "युजर",
      contacts: "कॉन्टॅक्ट",
    },
    page: {
      backToList: "लिस्टवर परत जा",
      created: "तयार केले",
      active: "एक्टिव",
      inactive: "इनएक्टिव",
      contacts: "कॉन्टॅक्ट",
      messagesThisMonth: "या महिन्याचे मेसेज",
      users: "युजर",
      outstandingBalance: "थकबाकी",
      outstandingBalanceHint: "पेमेंटने सेटल होते — अ‍ॅक्सेसवर कधीच परिणाम नाही",
      loading: "लोड होत आहे…",
      usersTabDescription:
        "क्लायंट युजर (Owner / Staff) एक्टिव किंवा इनएक्टिव करा, किंवा नवीन युजर थेट जोडा.",
    },
    overview: {
      clientHealth: "क्लायंट हेल्थ",
      executableRoutes: "चालणारे रूट्स",
      categoryRules: "कॅटेगरी नियम",
      deliveryThisMonth: "डिलिव्हरी, या महिन्यात (IST)",
      ok: "ओके",
      failed: "फेल",
      queueRightNow: "सध्या क्यूमध्ये",
      pending: "पेंडिंग",
      stuck: "अडकलेले",
      retrying: "पुन्हा प्रयत्न सुरू",
      activeConfiguredChannels: "एक्टिव कॉन्फिगर केलेले चॅनेल",
      none: "काहीही नाही",
      successRateThisMonth: "या महिन्यातील यशस्वी दर (IST)",
      noDecidedDeliveries: "कोणतीही ठरलेली डिलिव्हरी नाही",
      clientSettings: "क्लायंट सेटिंग्ज",
      clientSettingsDescription:
        "एक्टिव/इनएक्टिव, लाइव्ह Custom HTTP मंजुरी, आणि टाइमझोन. बिलिंगशी संबंधित नाही.",
    },
    opsForm: {
      clientActive: "क्लायंट एक्टिव",
      approveLiveCustomHttp: "लाइव्ह Custom HTTP मंजूर करा (FREE वरही)",
      allowStaffVisibility: "स्टाफला admin ने जोडलेल्या कॉन्टॅक्टची माहिती पाहू द्या",
      allowStaffVisibilityHint:
        "हे फक्त वरची मर्यादा सेट करते - क्लायंटचा Owner अजूनही ठरवतो की स्टाफला खरोखर दिसते की नाही. Owner ने काहीही सेट केलेले असो, हे बंद केल्यास ते नेहमी लपलेले राहील.",
      timezone: "टाइमझोन",
      saving: "सेव्ह होत आहे…",
      saveOpsSettings: "ऑप्स सेटिंग्ज सेव्ह करा",
      failedToSaveClient: "क्लायंट सेव्ह होऊ शकला नाही",
      clientUpdated: "क्लायंट अपडेट झाला.",
      deactivateTitle: "क्लायंट इनएक्टिव करायचा का?",
      deactivateMessage: (name) =>
        `${name} आणि त्यातील सर्वांची अ‍ॅक्सेस लगेच बंद होईल. नंतर क्लायंट पुन्हा एक्टिव करून हे परत करता येईल.`,
      deactivate: "इनएक्टिव करा",
      cancel: "रद्द करा",
    },
    billing: {
      activatePlan: "प्लान एक्टिवेट करा",
      activatePlanDescription:
        "STARTER/PRO/CUSTOM साठी Razorpay पेमेंट लिंक, किंवा पेमेंटशिवाय लगेच एक्टिवेट करा.",
      dealHistory: "डील हिस्ट्री",
      dealHistoryDescription:
        "या org साठी एक्टिवेट केलेली प्रत्येक STARTER/PRO/CUSTOM डील, अ‍ॅक्सेस/एक्सपायरीपासून वेगळी.",
      channelTopUps: "चॅनेल टॉप-अप",
      channelTopUpsDescription:
        "फक्त CUSTOM प्लान: नवीन डीलशिवाय, चालू कालावधीसाठी एका चॅनेलची क्षमता वाढवा.",
      recordPayment: "पेमेंट रेकॉर्ड करा",
      recordPaymentDescription:
        "फक्त थकबाकी सेटल करते — अ‍ॅक्सेस किंवा एक्सपायरी डेट कधीच बदलत नाही.",
      paymentLinks: "पेमेंट लिंक्स",
      paymentLinksDescription:
        "सर्व प्लानची हिस्ट्री. नवीन लिंक तयार केल्यास या org ची आधीची थकबाकीची लिंक आपोआप रद्द होते.",
    },
    planActivation: {
      currentPlan: "सध्याचा प्लान",
      limits: "मर्यादा",
      contactsWord: "कॉन्टॅक्ट",
      messagesPerMonth: "मेसेज/महिना",
      sent: "पाठवलेले",
      accessUntil: "अ‍ॅक्सेस कधीपर्यंत",
      notSet: "सेट केलेले नाही",
      description:
        "STARTER, PRO, किंवा CUSTOM डीलसाठी Razorpay लिंक तयार करा — मर्यादा क्लायंटने पेमेंट केल्यानंतरच लागू होतात. तुम्ही पेमेंटशिवायही लगेच एक्टिवेट करून नंतर सेटल करू शकता (खाली पहा).",
      plan: "प्लान",
      amountInr: "रक्कम (INR)",
      optionalOverride: " ऐच्छिक ओव्हरराइड",
      durationDays: "कालावधी (दिवस)",
      contactLimit: "कॉन्टॅक्ट मर्यादा",
      smsMessagesPerMonth: "SMS मेसेज/महिना",
      whatsappMessagesPerMonth: "WhatsApp मेसेज/महिना",
      emailMessagesPerMonth: "Email मेसेज/महिना",
      totalMonthlyMessages: "एकूण मासिक मेसेज",
      totalMonthlyMessagesHint: "(SMS + WhatsApp + Email नुसार आपोआप मोजले जाते)",
      customerEmail: "ग्राहकाचा ईमेल (ऐच्छिक)",
      creatingLink: "लिंक तयार होत आहे…",
      createPaymentLink: "Razorpay पेमेंट लिंक तयार करा",
      activating: "एक्टिवेट होत आहे…",
      activateWithoutPayment: "पेमेंटशिवाय एक्टिवेट करा",
      activateWithoutPaymentNote: (durationDays) =>
        `"पेमेंटशिवाय एक्टिवेट करा" लगेच अ‍ॅक्सेस चालू करते आणि ${durationDays}-दिवसांचा कालावधी लगेच सुरू करते; रक्कम (वर ओव्हरराइड नसल्यास STARTER/PRO ची कॅटलॉग किंमत) तुम्ही पेमेंट रेकॉर्ड करेपर्यंत खाली थकबाकी म्हणून दिसेल. हे स्वतःहून अ‍ॅक्सेस वाढवत नाही किंवा पुन्हा सुरू करत नाही.`,
      link: "लिंक",
      amountPreview: "रकमेचे पूर्वावलोकन",
      failedToCreateLink: "पेमेंट लिंक तयार होऊ शकली नाही",
      failedToActivate: "डील एक्टिवेट होऊ शकली नाही",
      linkCreatedSuccess: (planLabel) =>
        `${planLabel} साठी पेमेंट लिंक तयार झाली. ती क्लायंटला पाठवा — Razorpay पेमेंटनंतरच प्लान अपडेट होईल.`,
      activatedSuccess: (planLabel) =>
        `${planLabel} लगेच एक्टिवेट झाला — अ‍ॅक्सेस आता लाइव्ह आहे. पेमेंट खाली लेजरमध्ये वेगळे ट्रॅक होईल.`,
      confirmRenewalTitle: "रिन्यूअलची पुष्टी करा",
      continueAnyway: "तरीही सुरू ठेवा",
      cancel: "रद्द करा",
      paymentLinkWarning: (activeLabel, paidUntil, changingPlan, dealLabel) =>
        `या क्लायंटचा आधीच ${activeLabel} प्लान ${paidUntil} पर्यंत एक्टिव्ह आहे. पेमेंट झाल्यावर, ही लिंक ${changingPlan ? `तो ${dealLabel} ने बदलेल` : `त्याचे नूतनीकरण करेल, अ‍ॅक्सेस ${paidUntil} पासून वाढेल`}.`,
      renewalWarning: (
        activeLabel,
        paidUntil,
        changingPlan,
        dealLabel,
        newPaidUntil,
        amountLabel,
      ) =>
        `या क्लायंटचा आधीच ${activeLabel} प्लान ${paidUntil} पर्यंत एक्टिव्ह आहे. ${dealLabel} एक्टिवेट केल्याने ${changingPlan ? "प्लान बदलून अ‍ॅक्सेस वाढेल" : "अ‍ॅक्सेस वाढेल"} ${newPaidUntil} पर्यंत, आणि थकबाकीत ${amountLabel} भर पडेल.`,
      itsCatalougePrice: "त्याची कॅटलॉग किंमत",
    },
    dealHistory: {
      noDeals: "अजून कोणतीही प्लान डील एक्टिवेट झालेली नाही.",
      activated: "एक्टिवेट केले",
      plan: "प्लान",
      source: "स्रोत",
      amount: "रक्कम",
      status: "स्टेटस",
      duration: "कालावधी",
      limits: "मर्यादा",
      expiryAfterDeal: "या डीलनंतरची एक्सपायरी",
      messagesPerMonth: "मेसेज/महिना",
    },
    channelTopUp: {
      hint: "फक्त चालू कालावधीसाठी एका चॅनेलची मर्यादा वाढवते — अ‍ॅक्सेस वाढवत नाही किंवा इतर चॅनेल रीसेट करत नाही.",
      channel: "चॅनेल",
      messagesToAdd: "जोडायचे मेसेज",
      amountInr: "रक्कम (INR)",
      currentLimit: (channel, used, limit) =>
        `सध्याची ${channel} मर्यादा: या महिन्यात ${used} / ${limit} वापरले`,
      currentLimitNoAllocation:
        "अजून वेगळे वाटप नाही — शेअर्ड एकूण मर्यादा वापरली जात आहे",
      adding: "जोडत आहे…",
      addCapacity: "पेमेंटशिवाय क्षमता जोडा",
      failedToAdd: "चॅनेल क्षमता जोडता आली नाही",
      addedSuccess: (count, channel) =>
        `${channel} मध्ये ${count} मेसेज जोडले. अ‍ॅक्सेस आणि एक्सपायरीत बदल नाही.`,
      history: "चॅनेल टॉप-अप हिस्ट्री",
      noTopUps: "अजून कोणताही चॅनेल टॉप-अप जोडलेला नाही.",
      date: "तारीख",
      messagesAdded: "जोडलेले मेसेज",
      total: "एकूण",
      status: "स्टेटस",
    },
    recordPayment: {
      amountInr: "रक्कम (INR)",
      note: "नोंद",
      optional: "(ऐच्छिक)",
      hint: "सर्वात जुन्या थकबाकी डील/टॉप-अपवर आपोआप प्रथम लागू होते.",
      recording: "रेकॉर्ड होत आहे…",
      recordPayment: "पेमेंट रेकॉर्ड करा",
      failedToRecord: "पेमेंट रेकॉर्ड होऊ शकले नाही",
      recordedSuccess: "पेमेंट रेकॉर्ड झाले. यामुळे अ‍ॅक्सेस किंवा एक्सपायरी डेट बदलत नाही.",
      history: "पेमेंट हिस्ट्री",
      by: (name) => `(${name} यांनी)`,
    },
    paymentLinks: {
      noLinks: "अजून कोणतीही पेमेंट लिंक तयार केलेली नाही.",
      created: "तयार केले",
      plan: "प्लान",
      amount: "रक्कम",
      status: "स्टेटस",
      duration: "कालावधी",
      cancelling: "रद्द होत आहे…",
      cancel: "रद्द करा",
      failedToCancel: "पेमेंट लिंक रद्द होऊ शकली नाही",
      cancelTitle: "पेमेंट लिंक रद्द करायची का?",
      cancelMessage: "आता यातून पेमेंट करता येणार नाही. इथून हे परत करता येणार नाही.",
      cancelLink: "लिंक रद्द करा",
      keepIt: "तशीच राहू द्या",
    },
    activity: {
      failedQueueDiagnostics: "फेल क्यू डायग्नोस्टिक्स",
      failedQueueDescription:
        "फक्त सुरक्षित ऑपरेशनल तपशील. संदिग्ध रीट्रायसाठी डुप्लिकेट रिस्कची पुष्टी आवश्यक आहे.",
      recentActivity: "अलीकडील Platform Admin अ‍ॅक्टिव्हिटी",
      recentActivityDescription: "या क्लायंटसाठी नोंदवलेले सुरक्षा-संबंधित बदल.",
      noActivity: "अजून कोणतीही Platform Admin अ‍ॅक्टिव्हिटी नोंदवलेली नाही.",
      deletedAdmin: "हटवलेला Platform Admin",
    },
    failedQueue: {
      refresh: "रीफ्रेश करा",
      refreshing: "रीफ्रेश होत आहे…",
      ambiguousConfirm:
        "पहिला मेसेज आधीच गेला असेल, तर यामुळे दुसरा मेसेजही जाऊ शकतो. तरीही रीट्राय करायचे?",
      failedToRetry: "रीट्राय शेड्यूल होऊ शकला नाही",
      queue: "क्यू",
      channel: "चॅनेल",
      failure: "फेल्युअर",
      attempts: "प्रयत्न",
      updated: "अपडेट केले",
      action: "अ‍ॅक्शन",
      noFailedItems: "कोणतेही फेल क्यू आयटम नाहीत.",
      scheduling: "शेड्यूल होत आहे…",
      retry: "रीट्राय करा",
    },
    usersTable: {
      name: "नाव",
      email: "ईमेल",
      role: "रोल",
      status: "स्टेटस",
      action: "अ‍ॅक्शन",
      noUsers: "या क्लायंटमध्ये कोणताही युजर नाही.",
      updating: "अपडेट होत आहे…",
      deactivate: "इनएक्टिव्ह करा",
      activate: "एक्टिव्ह करा",
      sending: "पाठवत आहे…",
      sendPasswordReset: "पासवर्ड रीसेट लिंक पाठवा",
      failedToUpdate: "युजर अपडेट होऊ शकला नाही",
      failedToSendReset: "पासवर्ड रीसेट ईमेल पाठवता आला नाही",
      resetEmailSentDefault: "पासवर्ड रीसेट ईमेल पाठवला गेला",
      active: "एक्टिव्ह",
      inactive: "इनएक्टिव्ह",
      deactivateTitle: "युजर इनएक्टिव्ह करायचा का?",
      deactivateMessage: (name, email) =>
        `${name} (${email}) यांची या क्लायंटमधील अ‍ॅक्सेस लगेच बंद होईल. नंतर पुन्हा एक्टिव्ह करता येईल.`,
      deactivateConfirm: "इनएक्टिव्ह करा",
      cancel: "रद्द करा",
      addUser: "+ युजर जोडा",
    },
    addUser: {
      name: "नाव",
      role: "रोल",
      staff: "स्टाफ",
      owner: "Owner",
      email: "ईमेल",
      mobile: "मोबाइल",
      optional: "(ऐच्छिक)",
      initialPassword: "सुरुवातीचा पासवर्ड",
      passwordHint:
        "किमान 10 अक्षरे, किंवा 8+ सह मोठी-लहान अक्षरे आणि एक अंक. हे क्लायंटसोबत सुरक्षितपणे शेअर करा.",
      adding: "जोडत आहे…",
      add: "युजर जोडा",
      cancel: "रद्द करा",
      failedToAdd: "युजर जोडता आला नाही",
    },
    contactsTab: {
      title: "कॉन्टॅक्ट",
      description:
        "या क्लायंटच्या खात्यात कॉन्टॅक्ट जोडा, किंवा त्यांच्या वतीने CSV/Excel फाइल इम्पोर्ट करा.",
      addContact: "कॉन्टॅक्ट जोडा",
      addContactDescription:
        "हे क्लायंटच्या खात्यात थेट कॉन्टॅक्ट जोडते, अगदी तसेच जसे त्यांनी स्वतः जोडले असते. क्लायंटने त्यांची कॉन्टॅक्ट लिस्ट दिली असल्यास ऑनबोर्डिंगसाठी उपयुक्त.",
      name: "नाव",
      mobile: "मोबाइल",
      birthday: "वाढदिवस",
      optional: "(ऐच्छिक)",
      email: "ईमेल",
      category: "कॅटेगरी",
      newCategory: "+ नवीन कॅटेगरी",
      cancel: "रद्द करा",
      additionalCategories: "अतिरिक्त कॅटेगरी (ऐच्छिक)",
      additionalCategoriesHint:
        "एक कॉन्टॅक्ट एकापेक्षा जास्त कॅटेगरीचा असू शकतो, अगदी क्लायंटच्या स्वतःच्या Contacts पेजप्रमाणे.",
      noCategory: "कॅटेगरी नाही",
      adding: "जोडत आहे…",
      add: "कॉन्टॅक्ट जोडा",
      failedToAdd: "कॉन्टॅक्ट जोडता आला नाही",
      addedSuccess: (name) => `${name} जोडले.`,
      importTitle: "कॉन्टॅक्ट इम्पोर्ट करा (CSV/Excel)",
      importDescription:
        "कॉलम: Name, Mobile, Email, Birthday, Category (या क्लायंटच्या सध्याच्या कस्टम फील्ड्स आणि occasions शी आपोआप जुळते). हजारो रो असलेल्या फाइल्ससाठी, क्लायंटचा स्वतःचा डॅशबोर्ड वापरा, जो मोठे इम्पोर्ट बॅकग्राउंडमध्ये प्रोसेस करतो.",
      importing: "इम्पोर्ट होत आहे…",
      importSummary: (created, updated, duplicate, limit, invalid) =>
        `${created} जोडले · ${updated} अपडेट केले · ${duplicate} डुप्लिकेट · ${limit} वगळले (मर्यादा) · ${invalid} अवैध`,
      failedToImport: "कॉन्टॅक्ट इम्पोर्ट होऊ शकले नाहीत",
    },
  },
};

export function getAdminClientDetailDict(locale: Locale): AdminClientDetailDict {
  return ADMIN_CLIENT_DETAIL_DICT[locale];
}
