export type OccasionDateParts = {
  date: Date;
  month: number;
  day: number;
};

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const CSV_OCCASION_DATE_FORMAT_MESSAGE =
  "Invalid date format (expected DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, YYYY-MM-DD, or DD Mon YYYY)";

/** Numeric day/month/year with a consistent -, /, or . separator. */
const NUMERIC_DAY_MONTH_YEAR_PATTERN =
  /^(\d{1,2})([-/.])(\d{1,2})\2(\d{4})$/;

/** ISO-style year-month-day. */
const ISO_YEAR_MONTH_DAY_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

/** "14 Aug 2026" / "14 August 2026". */
const DAY_MONTH_NAME_YEAR_PATTERN = /^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/;

/** "Aug 14 2026" / "August 14 2026". */
const MONTH_NAME_DAY_YEAR_PATTERN = /^([a-zA-Z]+)\s+(\d{1,2})\s+(\d{4})$/;

const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

export function normalizeCsvOccasionDateToIso(input: string): string {
  const trimmed = input.trim();

  let day: number;
  let month: number;
  let year: number;

  const numericMatch = NUMERIC_DAY_MONTH_YEAR_PATTERN.exec(trimmed);
  const isoMatch = numericMatch
    ? null
    : ISO_YEAR_MONTH_DAY_PATTERN.exec(trimmed);
  const dayMonthNameMatch =
    numericMatch || isoMatch
      ? null
      : DAY_MONTH_NAME_YEAR_PATTERN.exec(trimmed);
  const monthNameDayMatch =
    numericMatch || isoMatch || dayMonthNameMatch
      ? null
      : MONTH_NAME_DAY_YEAR_PATTERN.exec(trimmed);

  if (numericMatch) {
    day = Number(numericMatch[1]);
    month = Number(numericMatch[3]);
    year = Number(numericMatch[4]);
  } else if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else if (dayMonthNameMatch) {
    day = Number(dayMonthNameMatch[1]);
    month = MONTH_NAME_TO_NUMBER[dayMonthNameMatch[2]!.toLowerCase()] ?? 0;
    year = Number(dayMonthNameMatch[3]);
  } else if (monthNameDayMatch) {
    month = MONTH_NAME_TO_NUMBER[monthNameDayMatch[1]!.toLowerCase()] ?? 0;
    day = Number(monthNameDayMatch[2]);
    year = Number(monthNameDayMatch[3]);
  } else {
    throw new Error(CSV_OCCASION_DATE_FORMAT_MESSAGE);
  }

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    !isValidCalendarDate(year, month, day)
  ) {
    throw new Error("Invalid date");
  }

  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

/** Parses a required YYYY-MM-DD date string used for any contact-occasion date. */
export function parseOccasionDate(input: string): OccasionDateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);

  if (!match) {
    throw new Error("Date must use YYYY-MM-DD format");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error("Invalid date");
  }

  if (!isValidCalendarDate(year, month, day)) {
    throw new Error("Invalid date");
  }

  return {
    date: new Date(Date.UTC(year, month - 1, day)),
    month,
    day,
  };
}

export function formatOccasionDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Leap-day rule for future queue matching: Feb 29 is stored as-is when provided.
 * Invalid impossible dates are rejected at input time.
 */
export function isLeapDay(month: number, day: number): boolean {
  return month === 2 && day === 29;
}
