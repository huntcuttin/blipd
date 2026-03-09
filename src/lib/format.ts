/** Format a price as "$X.XX", returning "—" for null/undefined/NaN. */
export function formatPrice(price: number | null | undefined): string {
  return price != null && !isNaN(price) ? `$${price.toFixed(2)}` : "—";
}

/** Dates used as placeholders for unknown release dates. */
export const PLACEHOLDER_DATES = ["2099-12-31", "2020-01-01"] as const;

export function isPlaceholderDate(date: string): boolean {
  return (PLACEHOLDER_DATES as readonly string[]).includes(date);
}
