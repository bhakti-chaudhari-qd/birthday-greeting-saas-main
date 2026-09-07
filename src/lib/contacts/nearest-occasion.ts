const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type NearestOccasionCandidate = {
  name: string;
  month: number;
  day: number;
};

/** Days from today's (month, day) to the next occurrence of (month, day), using a non-leap reference year. */
function daysUntilNext(
  todayMonth: number,
  todayDay: number,
  month: number,
  day: number,
): number {
  const referenceYear = 2001;
  const safeDay = month === 2 && day === 29 ? 28 : day;
  const today = Date.UTC(referenceYear, todayMonth - 1, todayDay);
  let target = Date.UTC(referenceYear, month - 1, safeDay);
  if (target < today) {
    target = Date.UTC(referenceYear + 1, month - 1, safeDay);
  }
  return Math.round((target - today) / 86_400_000);
}

/** Today's calendar month/day in India Standard Time. */
export function getTodayIstMonthDay(referenceDate: Date = new Date()): {
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(referenceDate);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return { month, day };
}

/**
 * Nearest upcoming occasion across every occasion the contact has a date
 * for, e.g. "Birthday • 14 Aug". Returns "No occasion" when the contact has
 * no occasion dates set.
 */
export function formatNearestOccasion(
  candidates: NearestOccasionCandidate[],
  today: { month: number; day: number } = getTodayIstMonthDay(),
): string {
  if (candidates.length === 0) {
    return "No occasion";
  }

  let best = candidates[0]!;
  let bestDelta = daysUntilNext(today.month, today.day, best.month, best.day);

  for (const candidate of candidates.slice(1)) {
    const delta = daysUntilNext(today.month, today.day, candidate.month, candidate.day);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = candidate;
    }
  }

  return `${best.name} • ${best.day} ${MONTH_ABBR[best.month - 1]}`;
}
