import type { SupabaseClient } from "@supabase/supabase-js";
import type { Game, Franchise, GameAlert } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>;

// ── Row-to-Model mappers ──────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapGame(row: any): Game {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    publisher: row.publisher,
    franchise: row.franchise,
    coverArt: row.cover_art,
    currentPrice: Number(row.current_price),
    originalPrice: Number(row.original_price),
    discount: row.discount,
    isOnSale: row.is_on_sale,
    isAllTimeLow: row.is_all_time_low,
    releaseDate: row.release_date,
    releaseStatus: row.release_status,
    metacriticScore: row.metacritic_score ?? null,
    saleEndDate: row.sale_end_date ?? null,
    priceHistory: row.price_history as { date: string; price: number }[],
    nsuid: row.nsuid ?? null,
    nintendoUrl: row.nintendo_url ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFranchise(row: any): Franchise {
  return {
    id: row.id,
    name: row.name,
    gameCount: row.game_count,
    logo: row.logo,
  };
}

function computeTimestampGroup(createdAt: string): GameAlert["timestampGroup"] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const alertDate = new Date(createdAt);
  const alertDay = new Date(alertDate.getFullYear(), alertDate.getMonth(), alertDate.getDate());
  const diffMs = today.getTime() - alertDay.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays <= 7) return "this_week";
  return "earlier";
}

function formatTimestamp(createdAt: string): string {
  const now = new Date();
  const date = new Date(createdAt);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? "s" : ""} ago`;
}

// ── Game queries ──────────────────────────────────────────────

export async function getAllGames(supabase: Client): Promise<Game[]> {
  const { data, error } = await supabase.from("games").select("*").order("title");
  if (error) throw error;
  return (data ?? []).map(mapGame);
}

export async function getGameBySlug(supabase: Client, slug: string): Promise<Game | null> {
  const { data, error } = await supabase.from("games").select("*").eq("slug", slug).single();
  if (error) return null;
  return mapGame(data);
}

export async function searchGames(supabase: Client, query: string): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .ilike("title", `%${query}%`)
    .order("title")
    .limit(20);
  if (error) throw error;
  return (data ?? []).map(mapGame);
}

export async function getGamesByFranchise(supabase: Client, franchiseName: string): Promise<Game[]> {
  const { data, error } = await supabase.from("games").select("*").eq("franchise", franchiseName);
  if (error) throw error;
  return (data ?? []).map(mapGame);
}

export async function getGamesByIds(supabase: Client, ids: string[]): Promise<Game[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("games").select("*").in("id", ids);
  if (error) throw error;
  return (data ?? []).map(mapGame);
}

// ── Franchise queries ─────────────────────────────────────────

export async function getAllFranchises(supabase: Client): Promise<Franchise[]> {
  const { data, error } = await supabase.from("franchises").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map(mapFranchise);
}

export async function getFranchiseByName(supabase: Client, name: string): Promise<Franchise | null> {
  const { data, error } = await supabase.from("franchises").select("*").eq("name", name).single();
  if (error) return null;
  return mapFranchise(data);
}

// ── Alert queries ─────────────────────────────────────────────

export async function getAlerts(supabase: Client, userId?: string): Promise<GameAlert[]> {
  const { data, error } = await supabase
    .from("alerts")
    .select("id, game_id, type, headline, subtext, created_at, games!inner ( title, cover_art )")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const readMap = new Map<string, boolean>();
  if (userId) {
    const { data: statuses } = await supabase
      .from("user_alert_status")
      .select("alert_id, read, dismissed")
      .eq("user_id", userId);

    if (statuses) {
      for (const s of statuses) {
        readMap.set(s.alert_id, s.read);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    gameId: row.game_id,
    gameTitle: row.games.title,
    gameCoverArt: row.games.cover_art,
    type: row.type,
    headline: row.headline,
    subtext: row.subtext,
    createdAt: row.created_at,
    timestampGroup: computeTimestampGroup(row.created_at),
    timestamp: formatTimestamp(row.created_at),
    read: readMap.get(row.id) ?? false,
  }));
}

export async function getAlertsForGame(supabase: Client, gameId: string): Promise<GameAlert[]> {
  const { data, error } = await supabase
    .from("alerts")
    .select("id, game_id, type, headline, subtext, created_at, games!inner ( title, cover_art )")
    .eq("game_id", gameId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    gameId: row.game_id,
    gameTitle: row.games.title,
    gameCoverArt: row.games.cover_art,
    type: row.type,
    headline: row.headline,
    subtext: row.subtext,
    createdAt: row.created_at,
    timestampGroup: computeTimestampGroup(row.created_at),
    timestamp: formatTimestamp(row.created_at),
    read: false,
  }));
}

export async function markAlertRead(supabase: Client, userId: string, alertId: string) {
  await supabase
    .from("user_alert_status")
    .upsert({ user_id: userId, alert_id: alertId, read: true });
}

export async function dismissAlert(supabase: Client, userId: string, alertId: string) {
  await supabase
    .from("user_alert_status")
    .upsert({ user_id: userId, alert_id: alertId, dismissed: true });
}

// ── Follow queries ────────────────────────────────────────────

export async function getUserGameFollows(supabase: Client, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_game_follows")
    .select("game_id")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r: { game_id: string }) => r.game_id);
}

export async function getUserFranchiseFollows(supabase: Client, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_franchise_follows")
    .select("franchise_id")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r: { franchise_id: string }) => r.franchise_id);
}

export async function followGame(supabase: Client, userId: string, gameId: string) {
  await supabase.from("user_game_follows").insert({ user_id: userId, game_id: gameId });
}

export async function unfollowGame(supabase: Client, userId: string, gameId: string) {
  await supabase.from("user_game_follows").delete().eq("user_id", userId).eq("game_id", gameId);
}

export async function followFranchise(supabase: Client, userId: string, franchiseId: string) {
  await supabase.from("user_franchise_follows").insert({ user_id: userId, franchise_id: franchiseId });
}

export async function unfollowFranchise(supabase: Client, userId: string, franchiseId: string) {
  await supabase.from("user_franchise_follows").delete().eq("user_id", userId).eq("franchise_id", franchiseId);
}
