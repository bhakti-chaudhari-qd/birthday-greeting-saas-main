/**
 * Customer-facing date/time display.
 * Dates are always DD-MM-YYYY. Times use 12-hour AM/PM in Asia/Kolkata.
 */

import { AUTOMATION_TIMEZONE } from "@/lib/automation/constants";

const DISPLAY_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_DAY_ONLY_RE = /^----(\d{2})-(\d{2})$/;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Format calendar Y/M/D as DD-MM-YYYY. */
export function formatDisplayYmd(
  year: number,
  month: number,
  day: number,
): string {
  return `${pad2(day)}-${pad2(month)}-${String(year).padStart(4, "0")}`;
}

function readIstParts(date: Date): {
  year: number;
  month: number;
  day: number;
  timeLabel: string;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: AUTOMATION_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);

  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const dayPeriod = lookup("dayPeriod");
  const hour = lookup("hour");
  const minute = lookup("minute");

  return {
    year: Number(lookup("year")),
    month: Number(lookup("month")),
    day: Number(lookup("day")),
    timeLabel: `${hour}:${minute} ${dayPeriod}`.trim(),
  };
}

/**
 * Format a calendar day (YYYY-MM-DD) or Date/ISO instant as DD-MM-YYYY.
 * YYYY-MM-DD strings are treated as calendar dates (not timezone-shifted).
 * Month/day-only values (`----MM-DD`) render as DD-MM.
 * Instants are shown in Asia/Kolkata.
 */
export function formatDisplayDate(value: string | Date): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    const match = DISPLAY_DATE_RE.exec(trimmed);
    if (match) {
      return formatDisplayYmd(
        Number(match[1]),
        Number(match[2]),
        Number(match[3]),
      );
    }
    const monthDay = MONTH_DAY_ONLY_RE.exec(trimmed);
    if (monthDay) {
      return `${monthDay[2]}-${monthDay[1]}`;
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "";
  }

  const { year, month, day } = readIstParts(date);
  return formatDisplayYmd(year, month, day);
}

/**
 * Customer-facing date/time: "DD-MM-YYYY, h:mm am/pm" (IST).
 * Optional dateStyle/timeStyle kept for call-site compatibility but ignored
 * for the date portion (always DD-MM-YYYY).
 */
export function formatCustomerDateTime(
  value: string | Date,
  options?: {
    dateStyle?: "full" | "long" | "medium" | "short";
    timeStyle?: "full" | "long" | "medium" | "short";
  },
): string {
  void options;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "";
  }
  const { year, month, day, timeLabel } = readIstParts(date);
  return `${formatDisplayYmd(year, month, day)}, ${timeLabel}`;
}

/**
 * Split an instant into highlighted date and time chip labels (IST).
 */
export function formatCustomerDateTimeParts(value: string | Date): {
  dateLabel: string;
  timeLabel: string;
} {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return {
      dateLabel: typeof value === "string" ? value : "",
      timeLabel: "",
    };
  }
  const { year, month, day, timeLabel } = readIstParts(date);
  return {
    dateLabel: formatDisplayYmd(year, month, day),
    timeLabel,
  };
}

/**
 * Greeting-day label for badges. Expects YYYY-MM-DD (IST calendar day).
 * Always DD-MM-YYYY.
 */
export function formatGreetingDayLabel(isoDate: string): string {
  return formatDisplayDate(isoDate);
}

/**
 * Compact schedule line for Scheduled badges, e.g. "On 13-02-2026 at 2:00 PM IST".
 */
export function formatScheduledSendDetail(
  isoDate: string,
  sendTimeLabel: string,
): string {
  const { dayLabel, timeLabel } = formatScheduledSendParts(
    isoDate,
    sendTimeLabel,
  );
  if (!timeLabel) {
    return `On ${dayLabel}`;
  }
  return `On ${dayLabel} at ${timeLabel}`;
}

/** Split schedule into date and time chips for highlighted Activity badges. */
export function formatScheduledSendParts(
  isoDate: string,
  sendTimeLabel: string,
): { dayLabel: string; timeLabel: string | null } {
  const dayLabel = formatGreetingDayLabel(isoDate);
  const time = sendTimeLabel.trim().replace(/\s+IST$/i, "");
  if (!time) {
    return { dayLabel, timeLabel: null };
  }
  return {
    dayLabel,
    timeLabel: /IST$/i.test(time) ? time : `${time} IST`,
  };
}
