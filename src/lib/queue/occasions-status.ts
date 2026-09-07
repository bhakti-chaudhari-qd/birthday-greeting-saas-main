/**
 * Shared status helpers for Today's occasions so badges match Scheduled / Submitted.
 */

export type OccasionChannelStatus =
  | "not_scheduled"
  | "pending"
  | "sending"
  | "sent"
  | "failed"
  | "skipped";

export type OccasionHumanStatus =
  | "not_set_up"
  | "will_send"
  | "pending"
  | "sending"
  | "sent"
  | "failed"
  | "skipped";

export function channelHumanStatus(
  enabled: boolean,
  status: OccasionChannelStatus,
): OccasionHumanStatus {
  if (!enabled) return "not_set_up";
  if (status === "sent") return "sent";
  if (status === "failed") return "failed";
  if (status === "skipped") return "skipped";
  if (status === "sending") return "sending";
  if (status === "pending") return "pending";
  return "will_send";
}

/**
 * Roll up enabled channels into one badge.
 * Outstanding work (failed/sending/pending) wins; otherwise any Submitted channel
 * wins over "will send" so Submitted and Today's occasions stay aligned when
 * one channel already went out and another is still waiting to be queued.
 */
export function overallHumanStatus(
  smsEnabled: boolean,
  smsStatus: OccasionChannelStatus,
  waEnabled: boolean,
  waStatus: OccasionChannelStatus,
  emailEnabled = false,
  emailStatus: OccasionChannelStatus = "not_scheduled",
): OccasionHumanStatus {
  const channels: Array<[enabled: boolean, status: OccasionChannelStatus]> = [
    [smsEnabled, smsStatus],
    [waEnabled, waStatus],
    [emailEnabled, emailStatus],
  ];

  if (channels.length === 0 || channels.every(([enabled]) => !enabled)) {
    return "not_set_up";
  }

  const statuses = channels
    .map(([enabled, status]) =>
      enabled ? channelHumanStatus(true, status) : null,
    )
    .filter((value): value is OccasionHumanStatus => value !== null);

  if (statuses.some((status) => status === "failed")) return "failed";
  if (statuses.some((status) => status === "sending")) return "sending";
  if (statuses.some((status) => status === "pending")) return "pending";
  if (statuses.some((status) => status === "sent")) return "sent";
  if (statuses.some((status) => status === "will_send")) return "will_send";
  if (statuses.some((status) => status === "skipped")) return "skipped";
  return "will_send";
}
