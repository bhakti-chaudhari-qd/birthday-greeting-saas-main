export {
  assertTemplateEligibleForProviderSend,
  getSmsProviderModeLabel,
  resolveSmsProviderMode,
  type SmsProviderMode,
} from "./provider-send-eligibility";

/** @deprecated Use SmsProviderMode from provider-send-eligibility */
export type ManualSendProviderMode = import("./provider-send-eligibility").SmsProviderMode;

export {
  assertTemplateEligibleForProviderSend as assertTemplateEligibleForManualSend,
  getSmsProviderModeLabel as getManualSendProviderModeLabel,
  resolveSmsProviderMode as resolveManualSendProviderMode,
} from "./provider-send-eligibility";
