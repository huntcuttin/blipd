import type { SupabaseClient } from "@supabase/supabase-js";

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
    // Fail safe: assume alert exists to prevent duplicates
    return true;
  }
  return (data?.length ?? 0) > 0;
}

async function getFollowers(
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

async function createAlertForUsers(
  supabase: AdminClient,
  alertId: string,
  userIds: string[]
) {
  if (userIds.length === 0) return;
  const rows = userIds.map((uid) => ({ user_id: uid, alert_id: alertId, read: false }));
  const { error } = await supabase.from("user_alert_status").insert(rows);
  if (error) {
    console.error(`createAlertForUsers failed for alert ${alertId}:`, error.message);
  }
}

export async function generatePriceDropAlert(
  supabase: AdminClient,
  game: GameRef,
  oldPrice: number,
  newPrice: number
): Promise<boolean> {
  if (await hasRecentAlert(supabase, game.id, "price_drop")) return false;

  const savings = (oldPrice - newPrice).toFixed(2);
  const { data, error } = await supabase.from("alerts").insert({
    game_id: game.id,
    type: "price_drop",
    headline: `${game.title} dropped to $${newPrice.toFixed(2)}`,
    subtext: `Was $${oldPrice.toFixed(2)} · Save $${savings}`,
  }).select("id").single();

  if (error || !data) {
    console.error(`Failed to insert price_drop alert for ${game.title}:`, error?.message);
    return false;
  }

  const users = await getFollowers(supabase, game.id);
  await createAlertForUsers(supabase, data.id, users);
  return true;
}

export async function generateAllTimeLowAlert(
  supabase: AdminClient,
  game: GameRef,
  price: number
): Promise<boolean> {
  if (await hasRecentAlert(supabase, game.id, "all_time_low")) return false;

  const { data, error } = await supabase.from("alerts").insert({
    game_id: game.id,
    type: "all_time_low",
    headline: `${game.title} — ALL TIME LOW`,
    subtext: `$${price.toFixed(2)} · Lowest price ever recorded`,
  }).select("id").single();

  if (error || !data) {
    console.error(`Failed to insert all_time_low alert for ${game.title}:`, error?.message);
    return false;
  }

  const users = await getFollowers(supabase, game.id);
  await createAlertForUsers(supabase, data.id, users);
  return true;
}

export async function generateSaleStartedAlert(
  supabase: AdminClient,
  game: GameRef,
  discount: number,
  salePrice: number,
  saleEndDate: string | null
): Promise<boolean> {
  if (await hasRecentAlert(supabase, game.id, "sale_started")) return false;

  const endStr = saleEndDate
    ? ` · Ends ${new Date(saleEndDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : "";
  const { data, error } = await supabase.from("alerts").insert({
    game_id: game.id,
    type: "sale_started",
    headline: `${game.title} sale — ${discount}% off`,
    subtext: `$${salePrice.toFixed(2)}${endStr}`,
  }).select("id").single();

  if (error || !data) {
    console.error(`Failed to insert sale_started alert for ${game.title}:`, error?.message);
    return false;
  }

  const users = await getFollowers(supabase, game.id);
  await createAlertForUsers(supabase, data.id, users);
  return true;
}

export async function generateSwitch2EditionAlert(
  supabase: AdminClient,
  game: GameRef
): Promise<boolean> {
  if (await hasRecentAlert(supabase, game.id, "switch2_edition_announced")) return false;

  const { data, error } = await supabase.from("alerts").insert({
    game_id: game.id,
    type: "switch2_edition_announced",
    headline: `${game.title} — Switch 2 Edition announced`,
    subtext: "A Nintendo Switch 2 version is now available",
  }).select("id").single();

  if (error || !data) {
    console.error(`Failed to insert switch2_edition_announced alert for ${game.title}:`, error?.message);
    return false;
  }

  const users = await getFollowers(supabase, game.id);
  await createAlertForUsers(supabase, data.id, users);
  return true;
}

export async function generateReleaseAlert(
  supabase: AdminClient,
  game: GameRef,
  type: "release_today" | "out_now",
  price: number
): Promise<boolean> {
  if (await hasRecentAlert(supabase, game.id, type)) return false;

  const headline =
    type === "out_now"
      ? `${game.title} is available now`
      : `${game.title} releases today`;
  const { data, error } = await supabase.from("alerts").insert({
    game_id: game.id,
    type,
    headline,
    subtext: `$${price.toFixed(2)} on Nintendo eShop`,
  }).select("id").single();

  if (error || !data) {
    console.error(`Failed to insert ${type} alert for ${game.title}:`, error?.message);
    return false;
  }

  const users = await getFollowers(supabase, game.id);
  await createAlertForUsers(supabase, data.id, users);
  return true;
}
