import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPrice } from "@/lib/format";

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

async function insertAndDispatch(
  supabase: AdminClient,
  game: GameRef,
  type: string,
  headline: string,
  subtext: string,
  followers: string[]
): Promise<boolean> {
  if (await hasRecentAlert(supabase, game.id, type)) return false;

  const { data, error } = await supabase.from("alerts").insert({
    game_id: game.id, type, headline, subtext,
  }).select("id").single();

  if (error || !data) {
    console.error(`Failed to insert ${type} alert for ${game.title}:`, error?.message);
    return false;
  }

  if (followers.length > 0) {
    const rows = followers.map((uid) => ({ user_id: uid, alert_id: data.id, read: false }));
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
  followers: string[]
): Promise<boolean> {
  const savings = formatPrice(oldPrice - newPrice, "");
  return insertAndDispatch(supabase, game, "price_drop",
    `${game.title} dropped to ${formatPrice(newPrice, "")}`,
    `Was ${formatPrice(oldPrice, "")} · Save ${savings}`,
    followers);
}

export async function generateAllTimeLowAlert(
  supabase: AdminClient,
  game: GameRef,
  price: number,
  followers: string[]
): Promise<boolean> {
  return insertAndDispatch(supabase, game, "all_time_low",
    `${game.title} — ALL TIME LOW`,
    `${formatPrice(price, "")} · Lowest price ever recorded`,
    followers);
}

export async function generateSaleStartedAlert(
  supabase: AdminClient,
  game: GameRef,
  discount: number,
  salePrice: number,
  saleEndDate: string | null,
  followers: string[]
): Promise<boolean> {
  const endStr = saleEndDate
    ? ` · Ends ${new Date(saleEndDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : "";
  return insertAndDispatch(supabase, game, "sale_started",
    `${game.title} sale — ${discount}% off`,
    `${formatPrice(salePrice, "")}${endStr}`,
    followers);
}

export async function generateSwitch2EditionAlert(
  supabase: AdminClient,
  game: GameRef,
  followers: string[]
): Promise<boolean> {
  return insertAndDispatch(supabase, game, "switch2_edition_announced",
    `${game.title} — Switch 2 Edition announced`,
    "A Nintendo Switch 2 version is now available",
    followers);
}

export async function generateReleaseAlert(
  supabase: AdminClient,
  game: GameRef,
  type: "release_today" | "out_now",
  price: number,
  followers: string[]
): Promise<boolean> {
  const headline = type === "out_now"
    ? `${game.title} is available now`
    : `${game.title} releases today`;
  return insertAndDispatch(supabase, game, type,
    headline,
    `${formatPrice(price, "")} on Nintendo eShop`,
    followers);
}
