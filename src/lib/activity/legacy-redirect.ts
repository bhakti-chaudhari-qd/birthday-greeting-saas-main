export type ActivityTab = "upcoming" | "sent" | "failed";

export function activityTabForQueueStatus(status?: string): ActivityTab {
  if (status === "FAILED" || status === "SKIPPED") return "failed";
  if (status === "SENT" || status === "DELIVERED") return "sent";
  return "upcoming";
}

export function activityTabForDeliveryStatus(status?: string): ActivityTab {
  if (status === "FAILED" || status === "UNDELIVERED") return "failed";
  if (status === "QUEUED") return "upcoming";
  return "sent";
}

export function buildActivityRedirect(
  tab: ActivityTab,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const next = new URLSearchParams({ tab });
  for (const key of ["search", "channel", "provider", "scheduledDate"]) {
    const value = searchParams[key];
    if (typeof value === "string" && value) next.set(key, value);
  }
  return `/dashboard/activity?${next.toString()}`;
}
