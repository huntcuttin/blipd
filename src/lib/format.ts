/** Format a price as "$X.XX". Returns fallback for null/undefined/NaN. */
export function formatPrice(price: number | null | undefined, fallback = "—"): string {
  return price != null && !isNaN(price) ? `$${price.toFixed(2)}` : fallback;
}

function formatDate(date: string | null | undefined, month: "short" | "long"): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month, day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Format a date as "Mar 7, 2026". Returns empty string for invalid input. */
export function formatShortDate(date: string | null | undefined): string {
  return formatDate(date, "short");
}

/** Format a date as "March 7, 2026". Returns empty string for invalid input. */
export function formatLongDate(date: string | null | undefined): string {
  return formatDate(date, "long");
}

/** Dates used as placeholders for unknown release dates. */
export const PLACEHOLDER_DATES = ["2099-12-31", "2020-01-01"] as const;

export function isPlaceholderDate(date: string): boolean {
  return (PLACEHOLDER_DATES as readonly string[]).includes(date);
}

/** Returns true if a date is a year-only placeholder (IGDB convention: Dec 31 = "sometime this year"). */
export function isYearOnlyDate(date: string): boolean {
  return date.endsWith("-12-31") && !isPlaceholderDate(date);
}

/** Returns true if a date is month-only precision (last day of month, in the future, not Dec 31). */
export function isMonthOnlyDate(date: string): boolean {
  if (!date || isPlaceholderDate(date) || isYearOnlyDate(date)) return false;
  const d = new Date(date + "T12:00:00");
  if (isNaN(d.getTime())) return false;
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return d.getDate() === lastDay && d > new Date();
}

/** Format month-only date as "April 2026". */
export function formatMonthYear(date: string): string {
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Smart release date display: "TBA" for unknown, "2027" for year-only, "April 2026" for month-only, "Mar 7, 2026" otherwise. */
export function formatReleaseDate(date: string | null | undefined): string {
  if (!date) return "";
  if (isPlaceholderDate(date)) return "TBA";
  if (isYearOnlyDate(date)) return new Date(date + "T12:00:00").getFullYear().toString();
  if (isMonthOnlyDate(date)) return formatMonthYear(date);
  return formatShortDate(date);
}
