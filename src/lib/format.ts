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

/**
 * Nintendo eShop US release timing is anchored to Pacific/Eastern time, not
 * UTC. Comparing a release date against a UTC calendar day can flip a game
 * to "out today" (or skip its launch-day alert) up to ~16 hours off from
 * the actual US launch, depending on time of day and DST. This is the single
 * source for "what calendar day is it, eShop-time" — every release-status
 * comparison must go through this, not `new Date().toISOString()`.
 */
export function getPacificDateStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
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

/**
 * Calendar-day difference between today (in US Pacific time, matching how
 * Nintendo eShop sale windows are anchored elsewhere in this codebase) and a
 * date-only string (YYYY-MM-DD). Computed as a pure Y-M-D diff rather than
 * an exact-timestamp difference, so the result is stable through the day —
 * not the case for `new Date(dateStr)`, which parses a bare date as UTC
 * midnight, so reading back local getFullYear/getMonth/getDate can shift the
 * effective date back by a day in any US timezone.
 */
export function getDaysUntil(dateStr: string): number {
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const [y, m, d] = dateStr.split("-").map(Number);
  const todayUTC = Date.UTC(ty, tm - 1, td);
  const targetUTC = Date.UTC(y, m - 1, d);
  return Math.round((targetUTC - todayUTC) / (1000 * 60 * 60 * 24));
}

export type SaleEndUrgency = "high" | "medium" | "low";

/** Sale-end countdown label ("Ends today" / "Ends tomorrow" / "Ends in N days"), or null past 14 days out. */
export function getSaleEndLabel(dateStr: string): { text: string; urgency: SaleEndUrgency } | null {
  const days = getDaysUntil(dateStr);
  if (days <= 0) return { text: "Ends today", urgency: "high" };
  if (days === 1) return { text: "Ends tomorrow", urgency: "high" };
  if (days <= 3) return { text: `Ends in ${days} days`, urgency: "high" };
  if (days <= 7) return { text: `Ends in ${days} days`, urgency: "medium" };
  if (days <= 14) return { text: `Ends in ${days} days`, urgency: "low" };
  return null;
}
