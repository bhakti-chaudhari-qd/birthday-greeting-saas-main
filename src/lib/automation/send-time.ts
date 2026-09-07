import { AUTOMATION_TIMEZONE } from "@/lib/automation/constants";

export type LocalHourMinute = {
  hour: number;
  minute: number;
};

/**
 * Returns the wall-clock hour and minute in the given IANA timezone.
 */
export function getLocalHourMinute(
  timezone: string,
  referenceDate: Date = new Date(),
): LocalHourMinute {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(referenceDate);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);

  if (
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23 ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error("Failed to resolve local hour/minute");
  }

  return { hour, minute };
}

/**
 * True when the reference instant is at or after the org's configured IST send time.
 * Cron should run frequently (e.g. hourly); early invocations skip until the window opens.
 */
export function isAtOrAfterAutomationSendTime(
  sendHour: number,
  sendMinute: number,
  referenceDate: Date = new Date(),
  timezone: string = AUTOMATION_TIMEZONE,
): boolean {
  const local = getLocalHourMinute(timezone, referenceDate);
  return local.hour * 60 + local.minute >= sendHour * 60 + sendMinute;
}

/**
 * UTC instant for the org's send clock on the automation calendar day of `referenceDate`.
 * Asia/Kolkata has no DST; wall time is always UTC+05:30.
 */
export function getAutomationSendInstant(
  sendHour: number,
  sendMinute: number,
  referenceDate: Date = new Date(),
  timezone: string = AUTOMATION_TIMEZONE,
): Date {
  if (timezone !== AUTOMATION_TIMEZONE) {
    throw new Error(
      `getAutomationSendInstant only supports ${AUTOMATION_TIMEZONE}`,
    );
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(referenceDate);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    throw new Error("Failed to resolve automation calendar date");
  }

  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  return new Date(
    Date.UTC(year, month - 1, day, sendHour, sendMinute, 0, 0) - istOffsetMs,
  );
}

export function isAutomationOriginatedIdempotencyKey(
  idempotencyKey: string,
): boolean {
  return idempotencyKey.startsWith("occasion:");
}

/**
 * Customer-facing clock time (12-hour AM/PM).
 * Examples: 6 → "6:00 AM", 13:05 → "1:05 PM", 0:00 → "12:00 AM".
 * Null hour/minute → "Not set".
 */
export function formatAutomationSendTimeLabel(
  sendHour: number | null | undefined,
  sendMinute: number | null | undefined,
): string {
  if (
    sendHour === null ||
    sendHour === undefined ||
    sendMinute === null ||
    sendMinute === undefined
  ) {
    return "Not set";
  }
  const period = sendHour >= 12 ? "PM" : "AM";
  const hour12 = sendHour % 12 === 0 ? 12 : sendHour % 12;
  return `${hour12}:${String(sendMinute).padStart(2, "0")} ${period}`;
}

export function hour24ToHour12(hour24: number): {
  hour12: number;
  period: "AM" | "PM";
} {
  return {
    hour12: hour24 % 12 === 0 ? 12 : hour24 % 12,
    period: hour24 >= 12 ? "PM" : "AM",
  };
}

export function hour12ToHour24(
  hour12: number,
  period: "AM" | "PM",
): number {
  if (period === "AM") {
    return hour12 === 12 ? 0 : hour12;
  }
  return hour12 === 12 ? 12 : hour12 + 12;
}

export function buildAutomationScheduleDescription(
  sendHour: number | null | undefined,
  sendMinute: number | null | undefined,
): string {
  if (
    sendHour === null ||
    sendHour === undefined ||
    sendMinute === null ||
    sendMinute === undefined
  ) {
    return "Set a send time in Automatic Greetings before messages will go out.";
  }
  return `Sends daily at or after ${formatAutomationSendTimeLabel(sendHour, sendMinute)} IST. Save before that time or messages may already go out.`;
}
