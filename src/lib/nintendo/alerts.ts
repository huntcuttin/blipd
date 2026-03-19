import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPrice, formatShortDate } from "@/lib/format";

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
  const { data, error } = await supabase
    .from("alerts")
    .select("id")
    .eq("game_id", gameId)
    .eq("type", type)
    .gte("created_at", twentyFourHoursAgo)
    .limit(1);
  if (error) {
    console.error(`hasRecentAlert query failed for ${gameId}/${type}:`, error.message);
    return true;
  }
  return (data?.length ?? 0) > 0;
}

export async function getFollowers(
  supabase: AdminClient,
  gameId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_game_follows")
    .select("user_id")
    .eq("game_id", gameId);
  if (error) {
    console.error(`getFollowers query failed for ${gameId}:`, error.message);
    return [];
  }
  return (data ?? []).map((r: { user_id: string }) => r.user_id);
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

  const users = followers ?? await getFollowers(supabase, game.id);
  if (users.length > 0) {
    const rows = users.map((uid) => ({ user_id: uid, alert_id: data.id, read: false }));
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
  followers?: string[],
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
  }, followers);
}

export async function generateAllTimeLowAlert(
  supabase: AdminClient,
  game: GameRef,
  price: number,
  followers?: string[]
): Promise<boolean> {
  return insertAndDispatch(supabase, game, "all_time_low", {
    headline: `${game.title} — ALL TIME LOW`,
    subtext: `${formatPrice(price, "")} · Lowest price ever recorded`,
    new_price: price,
  }, followers);
}

export async function generateSaleStartedAlert(
  supabase: AdminClient,
  game: GameRef,
  discount: number,
  salePrice: number,
  saleEndDate: string | null,
  followers?: string[]
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
  }, followers);
}

export async function generateSwitch2EditionAlert(
  supabase: AdminClient,
  game: GameRef,
  followers?: string[]
): Promise<boolean> {
  return insertAndDispatch(supabase, game, "switch2_edition_announced", {
    headline: `${game.title} — Switch 2 Edition announced`,
    subtext: "A Nintendo Switch 2 version is now available",
  }, followers);
}

export async function generateSaleEndingAlert(
  supabase: AdminClient,
  game: GameRef,
  currentPrice: number,
  originalPrice: number,
  discount: number,
  saleEndDate: string,
  followers?: string[]
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
  }, followers);
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
  price: number,
  followers?: string[]
): Promise<boolean> {
  const headline = type === "out_now"
    ? `${game.title} is available now`
    : `${game.title} releases today`;
  return insertAndDispatch(supabase, game, type, {
    headline,
    subtext: `${formatPrice(price, "")} on Nintendo eShop`,
    new_price: price,
  }, followers);
}
