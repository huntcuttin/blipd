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
  const { data } = await supabase
    .from("alerts")
    .select("id")
    .eq("game_id", gameId)
    .eq("type", type)
    .gte("created_at", twentyFourHoursAgo)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export async function generatePriceDropAlert(
  supabase: AdminClient,
  game: GameRef,
  oldPrice: number,
  newPrice: number
): Promise<boolean> {
  if (await hasRecentAlert(supabase, game.id, "price_drop")) return false;

  const savings = (oldPrice - newPrice).toFixed(2);
  await supabase.from("alerts").insert({
    game_id: game.id,
    type: "price_drop",
    headline: `${game.title} dropped to $${newPrice.toFixed(2)}`,
    subtext: `Was $${oldPrice.toFixed(2)} · Save $${savings}`,
  });
  return true;
}

export async function generateAllTimeLowAlert(
  supabase: AdminClient,
  game: GameRef,
  price: number
): Promise<boolean> {
  if (await hasRecentAlert(supabase, game.id, "all_time_low")) return false;

  await supabase.from("alerts").insert({
    game_id: game.id,
    type: "all_time_low",
    headline: `${game.title} — ALL TIME LOW`,
    subtext: `$${price.toFixed(2)} · Lowest price ever recorded`,
  });
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
    ? ` · Ends ${new Date(saleEndDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : "";
  await supabase.from("alerts").insert({
    game_id: game.id,
    type: "sale_started",
    headline: `${game.title} sale — ${discount}% off`,
    subtext: `$${salePrice.toFixed(2)}${endStr}`,
  });
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
  await supabase.from("alerts").insert({
    game_id: game.id,
    type,
    headline,
    subtext: `$${price.toFixed(2)} on Nintendo eShop`,
  });
  return true;
}
