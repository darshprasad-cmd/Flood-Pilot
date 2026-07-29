/**
 * Time helpers.
 *
 * Everything the engine computes is in "minutes from now", and everything shown
 * to a person is in the city's local wall clock. These are the two conversions
 * between them.
 */

/** Offset from UTC in minutes for an IANA time zone at a given instant. */
export function tzOffsetMinutes(timeZone: string, at: Date = new Date()): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const parts = dtf.formatToParts(at);
    const get = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value ?? "0");

    // `Date.UTC` on the wall-clock fields gives the same instant expressed as if
    // local time were UTC; the difference is the offset.
    const asUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour") % 24,
      get("minute"),
      get("second"),
    );

    return Math.round((asUtc - at.getTime()) / 60_000);
  } catch {
    return 0;
  }
}

/** Local wall-clock time in a city, as an epoch-shifted Date for formatting. */
export function localDate(at: Date, timeZone: string): Date {
  return new Date(at.getTime() + tzOffsetMinutes(timeZone, at) * 60_000);
}

/** "18:45" in the city's local time, `minutesFromNow` ahead of `at`. */
export function clockAt(
  at: Date,
  timeZone: string,
  minutesFromNow = 0,
): string {
  const d = localDate(new Date(at.getTime() + minutesFromNow * 60_000), timeZone);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Local month index, 0-based, for seasonal lookups. */
export function localMonthIndex(at: Date, timeZone: string): number {
  return localDate(at, timeZone).getUTCMonth();
}

/** "35 min", "2 hr 10 min", "now". */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m === 0) return "now";
  if (m < 60) return `${m} min`;
  const hrs = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${hrs} hr` : `${hrs} hr ${rem} min`;
}

/** "in 35 min", "in 2 hr 10 min", "imminent". */
export function formatLeadTime(minutes: number | null): string {
  if (minutes === null) return "not expected";
  if (minutes <= 3) return "imminent";
  return `in ${formatDuration(minutes)}`;
}

/** "4 min ago", "just now". */
export function formatAgo(iso: string, now: Date = new Date()): string {
  const min = (now.getTime() - Date.parse(iso)) / 60_000;
  if (!Number.isFinite(min)) return "unknown";
  if (min < 1) return "just now";
  if (min < 60) return `${Math.round(min)} min ago`;
  const hrs = min / 60;
  if (hrs < 24) return `${Math.round(hrs)} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
}
