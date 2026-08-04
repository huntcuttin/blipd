import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPrice, formatShortDate } from "@/lib/format";
import { withRetry } from "@/lib/retry";
import { getPrefColumn } from "@/lib/notifications/dispatch";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any>;

interface GameRef {
  id: string;
  title: string;
}

async function hasRecentAlert(
  supabase: AdminClient,
  gameId: string,
  type: string
): Promise<boolean> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  try {
    // A transient query error previously fell straight through to the
    // fail-safe "true" (suppress) default, permanently and silently losing
    // that alert — since the underlying price has already been persisted by
    // the time this runs, there's no later retry that would catch it. Retry
    // transient failures first; only fall back to suppressing on a
    // persistent error, where "don't risk a duplicate" is still the right
    // default.
    const data = await withRetry(
      async () => {
        const { data, error } = await supabase
          .from("alerts")
          .select("id")
          .eq("game_id", gameId)
          .eq("type", type)
          .gte("created_at", twentyFourHoursAgo)
          .limit(1);
        if (error) throw new Error(error.message);
        return data;
      },
      { retries: 2, baseDelay: 300, label: `hasRecentAlert ${gameId}/${type}` }
    );
    return (data?.length ?? 0) > 0;
  } catch (err) {
    console.error(`hasRecentAlert query failed after retries for ${gameId}/${type}:`, err instanceof Error ? err.message : err);
    return true;
  }
}

interface AlertData {
  headline: string;
  subtext: string;
  new_price?: number | null;
  old_price?: number | null;
  discount?: number | null;
  sale_end_date?: string | null;
}

async function insertAndDispatch(
  supabase: AdminClient,
  game: GameRef,
  type: string,
  alert: AlertData,
  followers?: string[]
): Promise<boolean> {
  if (await hasRecentAlert(supabase, game.id, type)) return false;

  const { data, error } = await supabase.from("alerts").insert({
    game_id: game.id, type,
    headline: alert.headline,
    subtext: alert.subtext,
    new_price: alert.new_price ?? null,
    old_price: alert.old_price ?? null,
    discount: alert.discount ?? null,
    sale_end_date: alert.sale_end_date ?? null,
  }).select("id").single();

  if (error || !data) {
    console.error(`Failed to insert ${type} alert for ${game.title}:`, error?.message);
    return false;
  }

  // The in-app feed must respect the same per-game notify_* toggles that
  // email/push already do — previously this wrote a status row for every
  // follower regardless of preference, so a user who turned off (say) sale
  // alerts for a game still saw them in their in-app feed. Callers that pass
  // an explicit followers list (e.g. retro game discovery, whose audience
  // comes from user_franchise_follows + user_retro_follows rather than any
  // prior per-game follow) are trusted as-is; everyone else is looked up
  // fresh, filtered to whoever has this alert type's preference enabled.
  let recipientIds: string[];
  if (followers) {
    recipientIds = followers;
  } else {
    const prefColumn = getPrefColumn(type);
    const { data: prefRows, error: prefError } = await supabase
      .from("user_game_follows")
      .select(`user_id, ${prefColumn}`)
      .eq("game_id", game.id)
      .eq(prefColumn, true);

    if (prefError) {
      console.error(`Failed to fetch notify prefs for alert ${data.id}:`, prefError.message);
      recipientIds = [];
    } else {
      recipientIds = (prefRows ?? []).map((r) => (r as { user_id: string }).user_id);
    }
  }

  if (recipientIds.length > 0) {
    const rows = recipientIds.map((uid) => ({ user_id: uid, alert_id: data.id, read: false }));
    const { error: statusError } = await supabase.from("user_alert_status").insert(rows);
    if (statusError) {
      console.error(`createAlertForUsers failed for alert ${data.id}:`, statusError.message);
    }
  }
  return true;
}

export async function generatePriceDropAlert(
  supabase: AdminClient,
  game: GameRef,
  oldPrice: number,
  newPrice: number,
  discount: number,
  saleEndDate?: string | null
): Promise<boolean> {
  const savings = formatPrice(oldPrice - newPrice, "");
  const endStr = saleEndDate ? ` · Ends ${formatShortDate(saleEndDate)}` : "";
  return insertAndDispatch(supabase, game, "price_drop", {
    headline: `${game.title} dropped to ${formatPrice(newPrice, "")}`,
    subtext: `Was ${formatPrice(oldPrice, "")} · Save ${savings}${endStr}`,
    new_price: newPrice,
    old_price: oldPrice,
    discount,
    sale_end_date: saleEndDate ?? null,
  });
}

export async function generateAllTimeLowAlert(
  supabase: AdminClient,
  game: GameRef,
  price: number
): Promise<boolean> {
  return insertAndDispatch(supabase, game, "all_time_low", {
    headline: `${game.title} — ALL TIME LOW`,
    subtext: `${formatPrice(price, "")} · Lowest price ever recorded`,
    new_price: price,
  });
}

/**
 * update-prices' isNewSale check (isOnSale && !game.is_on_sale) assumes
 * is_on_sale only flips false->true when a sale genuinely starts. Observed
 * live: "Monster Hunter Stories" re-fired sale_started every ~1-2 days for
 * two months straight, always at the identical 67% off / $9.99 — Nintendo's
 * own price API appears to occasionally report a brief false "not on sale"
 * reading for an otherwise-continuous promo, which round-trips is_on_sale
 * false then true again with no real change. hasRecentAlert's 24h window
 * doesn't catch this since the gaps between re-fires ran well past 24h.
 * Before firing a fresh sale_started, check whether the last sale-related
 * alert we sent for this game (over a much longer window) already carried
 * the exact same discount + price — if so, this isn't a new sale.
 */
export async function isDuplicateSaleSignature(
  supabase: AdminClient,
  gameId: string,
  discount: number,
  newPrice: number,
  lookbackDays = 14
): Promise<boolean> {
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  try {
    const data = await withRetry(
      async () => {
        const { data, error } = await supabase
          .from("alerts")
          .select("discount, new_price")
          .eq("game_id", gameId)
          .in("type", ["sale_started", "price_drop"])
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(1);
        if (error) throw new Error(error.message);
        return data;
      },
      { retries: 2, baseDelay: 300, label: `isDuplicateSaleSignature ${gameId}` }
    );
    if (!data || data.length === 0) return false;
    const last = data[0] as { discount: number | null; new_price: string | number | null };
    return last.discount === discount && Number(last.new_price) === newPrice;
  } catch (err) {
    // Fail open — worst case a genuine duplicate slips through occasionally,
    // same as before this guard existed. hasRecentAlert's 24h gate is still
    // the primary dedup line of defense.
    console.error(`isDuplicateSaleSignature query failed for ${gameId}:`, err instanceof Error ? err.message : err);
    return false;
  }
}

export async function generateSaleStartedAlert(
  supabase: AdminClient,
  game: GameRef,
  discount: number,
  salePrice: number,
  saleEndDate: string | null
): Promise<boolean> {
  const endStr = saleEndDate
    ? ` · Ends ${formatShortDate(saleEndDate)}`
    : "";
  return insertAndDispatch(supabase, game, "sale_started", {
    headline: `${game.title} sale — ${discount}% off`,
    subtext: `${formatPrice(salePrice, "")}${endStr}`,
    new_price: salePrice,
    discount,
    sale_end_date: saleEndDate,
  });
}

export async function generateSwitch2EditionAlert(
  supabase: AdminClient,
  game: GameRef
): Promise<boolean> {
  return insertAndDispatch(supabase, game, "switch2_edition_announced", {
    headline: `${game.title} — Switch 2 Edition announced`,
    subtext: "A Nintendo Switch 2 version is now available",
  });
}

export async function generateSaleEndingAlert(
  supabase: AdminClient,
  game: GameRef,
  currentPrice: number,
  originalPrice: number,
  discount: number,
  saleEndDate: string
): Promise<boolean> {
  const daysLeft = Math.ceil(
    (new Date(saleEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const urgency = daysLeft <= 1 ? "ends today" : `ends in ${daysLeft} days`;
  return insertAndDispatch(supabase, game, "sale_ending", {
    headline: `${game.title} sale ${urgency}`,
    subtext: `${formatPrice(currentPrice, "")} (${discount}% off) — was ${formatPrice(originalPrice, "")}`,
    new_price: currentPrice,
    old_price: originalPrice,
    discount,
    sale_end_date: saleEndDate,
  });
}

const RETRO_CONSOLE_LABELS: Record<string, string> = {
  nes: "NES",
  snes: "SNES",
  n64: "N64",
  gb: "Game Boy",
  gba: "GBA",
  ds: "DS",
  gamecube: "GameCube",
  wii: "Wii",
};

export async function generateRetroGameAlert(
  supabase: AdminClient,
  game: GameRef,
  retroPlatform: string,
  followers: string[]
): Promise<boolean> {
  const label = RETRO_CONSOLE_LABELS[retroPlatform] ?? retroPlatform.toUpperCase();
  return insertAndDispatch(supabase, game, "retro_game_added", {
    headline: `${game.title} just hit the eShop`,
    subtext: `Classic ${label} game now available on Nintendo Switch`,
  }, followers);
}

export async function generateReleaseAlert(
  supabase: AdminClient,
  game: GameRef,
  type: "release_today" | "out_now",
  price: number
): Promise<boolean> {
  const headline = type === "out_now"
    ? `${game.title} is available now`
    : `${game.title} releases today`;
  return insertAndDispatch(supabase, game, type, {
    headline,
    subtext: `${formatPrice(price, "")} on Nintendo eShop`,
    new_price: price,
  });
}

/**
 * Fires once, the moment a followed game's release date resolves from a
 * placeholder to a real one (sync-release-dates' only write path for
 * release_date -- see its route for why this is the sole hook point).
 * Never fires on a real-date-to-real-date change (dates can flap as IGDB
 * corrects itself; that's a distinct, deliberately-deferred alert class).
 * insertAndDispatch's default follower resolution already scopes this to
 * users who follow this specific game with notify_releases on -- no
 * explicit followers list needed. No email template is registered for
 * this type yet (see getTemplate in templates.ts) -- in-app feed only,
 * pending founder sign-off on copy before any send path is wired in.
 */
export async function generateReleaseDateSetAlert(
  supabase: AdminClient,
  game: GameRef,
  releaseDate: string
): Promise<boolean> {
  return insertAndDispatch(supabase, game, "release_date_set", {
    headline: `${game.title} now has a release date`,
    subtext: `Releasing ${formatShortDate(releaseDate)}`,
  });
}
