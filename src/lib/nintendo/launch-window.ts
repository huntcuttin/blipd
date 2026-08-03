/**
 * Predicts when a game will actually go live on the US eShop, so the burst
 * poller knows which handful of nsuids to watch minute-by-minute instead of
 * polling the whole catalog.
 *
 * The prediction only decides *when to look closely*. Ground truth for an
 * "out now" alert is always Nintendo's own sales_status flipping to onsale —
 * a wrong prediction means we watched at the wrong time, never that we sent a
 * wrong alert.
 */

const PACIFIC = "America/Los_Angeles";
const EASTERN = "America/New_York";

/** Publishers whose big titles historically unlock at midnight ET. */
const MIDNIGHT_ET_PUBLISHERS = ["nintendo", "sega", "capcom"];

export type LaunchRuleId = "midnight_et" | "physical_night_before" | "digital_9am_pt";

export interface LaunchPrediction {
  rule: LaunchRuleId;
  /** The instant the game is predicted to go live. */
  at: Date;
}

export interface LaunchPredictionInput {
  /** ISO date, "YYYY-MM-DD". */
  releaseDate: string;
  publisher?: string | null;
  /**
   * Whether the listing has a physical edition. Null/undefined means unknown —
   * treated as digital-only, which is the safe default (a digital-only guess
   * watches later than a physical one, and the poller widens its window rather
   * than relying on the guess being exact).
   */
  hasPhysicalRelease?: boolean | null;
}

/** Placeholder used by the catalog sync when IGDB has no real date. */
const PLACEHOLDER_DATE = "2099-12-31";

/**
 * Offset, in ms, between a zone's local wall time and UTC at a given instant.
 * Derived from Intl rather than hardcoded so DST is handled without a library.
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  // Intl renders midnight as hour 24 in some ICU versions; normalize it.
  const hour = get("hour") % 24;

  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  return asUtc - instant.getTime();
}

/**
 * Converts a wall-clock time in a named zone to the corresponding UTC instant.
 * Two-pass: the first offset lookup can be wrong within an hour of a DST
 * boundary, and re-reading the offset at the approximated instant settles it.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const firstPass = naive - zoneOffsetMs(new Date(naive), timeZone);
  const secondPass = naive - zoneOffsetMs(new Date(firstPass), timeZone);
  return new Date(secondPass);
}

function parseIsoDate(date: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/**
 * Applies the documented US eShop launch-time rules, in the same precedence
 * order the /games/[slug]/release-time page uses:
 *   1. Major first-party (Nintendo/Sega/Capcom) — midnight ET on release day
 *   2. Has a physical edition — 9:00 PM PT the night before
 *   3. Everything else — 9:00 AM PT on release day
 *
 * Returns null when there's no usable release date to anchor to.
 */
export function predictLaunchInstant(input: LaunchPredictionInput): LaunchPrediction | null {
  const { releaseDate, publisher, hasPhysicalRelease } = input;
  if (!releaseDate || releaseDate === PLACEHOLDER_DATE) return null;

  const parsed = parseIsoDate(releaseDate);
  if (!parsed) return null;
  const { year, month, day } = parsed;

  const pub = (publisher ?? "").toLowerCase();
  if (MIDNIGHT_ET_PUBLISHERS.some((p) => pub.includes(p))) {
    return { rule: "midnight_et", at: zonedTimeToUtc(year, month, day, 0, 0, EASTERN) };
  }

  if (hasPhysicalRelease) {
    // 9 PM PT the night *before* release day. Building the previous calendar
    // day via UTC arithmetic avoids month/year rollover bugs.
    const prev = new Date(Date.UTC(year, month - 1, day));
    prev.setUTCDate(prev.getUTCDate() - 1);
    return {
      rule: "physical_night_before",
      at: zonedTimeToUtc(
        prev.getUTCFullYear(),
        prev.getUTCMonth() + 1,
        prev.getUTCDate(),
        21,
        0,
        PACIFIC
      ),
    };
  }

  return { rule: "digital_9am_pt", at: zonedTimeToUtc(year, month, day, 9, 0, PACIFIC) };
}

/** How far either side of the prediction the burst poller stays hot. */
export const BURST_WINDOW_MS = 30 * 60 * 1000;

/**
 * Whether `now` falls inside the burst window around a predicted launch.
 * Inclusive at both edges so a poll landing exactly on the boundary counts.
 */
export function isWithinBurstWindow(
  predictedAt: Date,
  now: Date,
  windowMs: number = BURST_WINDOW_MS
): boolean {
  return Math.abs(predictedAt.getTime() - now.getTime()) <= windowMs;
}

/**
 * Ground truth for "this game is actually purchasable right now".
 *
 * Deliberately not "it has a price": Nintendo's price API returns a
 * regular_price for preorder listings while reporting sales_status
 * "unreleased", so treating price presence as a launch signal would fire a
 * false "out now" alert days before release. Verified against the live API.
 */
export function isLiveOnEshop(salesStatus: string | null | undefined): boolean {
  return salesStatus === "onsale";
}
