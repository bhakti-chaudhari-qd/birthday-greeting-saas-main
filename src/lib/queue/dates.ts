const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseTargetDate(input: string): {
  year: number;
  month: number;
  day: number;
  date: Date;
  isoDate: string;
} {
  const match = DATE_PATTERN.exec(input.trim());

  if (!match) {
    throw new Error("Target date must use YYYY-MM-DD format");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Invalid target date");
  }

  return {
    year,
    month,
    day,
    date,
    isoDate: input.trim(),
  };
}

export function formatIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getOrganizationLocalIsoDate(
  timezone: string,
  referenceDate: Date = new Date(),
): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(referenceDate);
}

/** Previous calendar day for an ISO date (YYYY-MM-DD), timezone-independent. */
export function getPreviousIsoDate(isoDate: string): string {
  const { year, month, day } = parseTargetDate(isoDate);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() - 1);
  return formatIsoDate(
    utc.getUTCFullYear(),
    utc.getUTCMonth() + 1,
    utc.getUTCDate(),
  );
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Occasion month/day pairs to match for a target calendar date, for any
 * occasion. Feb 29 contacts are also eligible on Feb 28 in non-leap years.
 */
export function getOccasionMatchPairs(
  month: number,
  day: number,
  year: number,
): Array<{ month: number; day: number }> {
  const pairs = [{ month, day }];

  if (month === 2 && day === 28 && !isLeapYear(year)) {
    pairs.push({ month: 2, day: 29 });
  }

  return pairs;
}
