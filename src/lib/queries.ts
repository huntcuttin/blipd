import type { SupabaseClient } from "@supabase/supabase-js";
import type { Game, Franchise, GameAlert, ConsolePreference, NotifyPrefs } from "@/lib/types";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { DEFAULT_NOTIFY_PREFS } from "@/lib/types";

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
    priceHistory: (row.price_history as { date: string; price: number }[] | null) ?? [],
    nsuid: row.nsuid ?? null,
    nintendoUrl: row.nintendo_url ?? null,
    switch2Nsuid: row.switch2_nsuid ?? null,
    upgradePackNsuid: row.upgrade_pack_nsuid ?? null,
    upgradePackPrice: row.upgrade_pack_price != null ? Number(row.upgrade_pack_price) : null,
    isSuppressed: row.is_suppressed ?? false,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFranchise(row: any): Franchise {
  return {
    id: row.id,
    name: row.name,
    gameCount: row.game_count,
    logo: row.logo,
    popularityScore: row.popularity_score ?? 0,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapNotifyPrefs(row: any): NotifyPrefs {
  return {
    announcements: row.notify_announcements ?? true,
    sales: row.notify_sales ?? true,
    allTimeLow: row.notify_all_time_low ?? true,
    releases: row.notify_releases ?? true,
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
  const { data, error } = await supabase.from("games").select("*").order("title").limit(2500);
  if (error) throw error;
  return (data ?? []).map(mapGame);
}

export async function getTrendingGames(supabase: Client): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("release_status", "released")
    .eq("is_suppressed", false)
    .gt("current_price", 0)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map(mapGame);
}

export async function getGamesOnSale(supabase: Client): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("is_on_sale", true)
    .eq("is_suppressed", false)
    .order("discount", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map(mapGame);
}

export async function getRecentReleases(supabase: Client): Promise<Game[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("release_status", "released")
    .eq("is_suppressed", false)
    .gte("release_date", thirtyDaysAgo)
    .neq("release_date", "2099-12-31")
    .neq("release_date", "2020-01-01")
    .order("release_date", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map(mapGame);
}

export async function getUpcomingGames(supabase: Client): Promise<Game[]> {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .in("release_status", ["upcoming", "out_today"])
    .eq("is_suppressed", false)
    .gte("release_date", today)
    .neq("release_date", "2099-12-31")
    .neq("release_date", "2020-01-01")
    .gt("original_price", 0)
    .order("release_date", { ascending: true })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map(mapGame);
}

export async function getGameBySlug(supabase: Client, slug: string): Promise<Game | null> {
  const { data, error } = await supabase.from("games").select("*").eq("slug", slug).single();
  if (error) return null;
  return mapGame(data);
}

export async function searchGames(supabase: Client, query: string): Promise<Game[]> {
  // Escape ILIKE special characters (% and _) so they're treated as literals
  const escaped = query.replace(/[%_]/g, "\\$&");
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .ilike("title", `%${escaped}%`)
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
  const { data, error } = await supabase.from("franchises").select("*").order("popularity_score", { ascending: false });
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
  // If user is logged in, only show alerts for games they follow
  let followedGameIds: Set<string> | null = null;
  if (userId) {
    const { data: follows } = await supabase
      .from("user_game_follows")
      .select("game_id")
      .eq("user_id", userId);
    followedGameIds = new Set((follows ?? []).map((f: { game_id: string }) => f.game_id));
  }

  let query = supabase
    .from("alerts")
    .select("id, game_id, type, headline, subtext, created_at, games!inner ( title, cover_art, slug )")
    .order("created_at", { ascending: false })
    .limit(50);

  // If user follows games, filter to those games only
  if (followedGameIds && followedGameIds.size > 0) {
    query = query.in("game_id", Array.from(followedGameIds));
  } else if (userId) {
    // User is logged in but follows nothing — return empty
    return [];
  }
  // If not logged in, show recent global alerts as a preview (limit already set)

  const { data, error } = await query;
  if (error) throw error;

  const readMap = new Map<string, boolean>();
  const dismissedSet = new Set<string>();
  const alertIds = (data ?? []).map((row: { id: string }) => row.id);
  if (userId && alertIds.length > 0) {
    const { data: statuses } = await supabase
      .from("user_alert_status")
      .select("alert_id, read, dismissed")
      .eq("user_id", userId)
      .in("alert_id", alertIds);

    if (statuses) {
      for (const s of statuses) {
        readMap.set(s.alert_id, s.read);
        if (s.dismissed) dismissedSet.add(s.alert_id);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? [])
    .filter((row: { id: string }) => !dismissedSet.has(row.id))
    .map((row: any) => ({
      id: row.id,
      gameId: row.game_id,
      gameTitle: row.games.title,
      gameCoverArt: row.games.cover_art,
      gameSlug: row.games.slug,
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
    .select("id, game_id, type, headline, subtext, created_at, games!inner ( title, cover_art, slug )")
    .eq("game_id", gameId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    gameId: row.game_id,
    gameTitle: row.games.title,
    gameCoverArt: row.games.cover_art,
    gameSlug: row.games.slug,
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
  const { error } = await supabase
    .from("user_alert_status")
    .upsert({ user_id: userId, alert_id: alertId, read: true });
  if (error) throw error;
}

export async function dismissAlert(supabase: Client, userId: string, alertId: string) {
  const { error } = await supabase
    .from("user_alert_status")
    .upsert({ user_id: userId, alert_id: alertId, read: true, dismissed: true });
  if (error) throw error;
}

export async function remindAlert(supabase: Client, userId: string, alertId: string) {
  const remindAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("user_alert_status")
    .upsert({ user_id: userId, alert_id: alertId, read: true, remind_at: remindAt });
  if (error) throw error;
}

// ── User profile queries ──────────────────────────────────────

export async function getUserProfile(supabase: Client, userId: string): Promise<{ consolePreference: ConsolePreference | null }> {
  const { data } = await supabase
    .from("user_profiles")
    .select("console_preference")
    .eq("user_id", userId)
    .single();
  return { consolePreference: data?.console_preference ?? null };
}

export async function setConsolePreference(supabase: Client, userId: string, preference: ConsolePreference) {
  await supabase
    .from("user_profiles")
    .upsert({ user_id: userId, console_preference: preference, updated_at: new Date().toISOString() });
}

// ── Follow queries ────────────────────────────────────────────

export interface GameFollowRecord {
  gameId: string;
  prefs: NotifyPrefs;
}

export async function getUserGameFollows(supabase: Client, userId: string): Promise<GameFollowRecord[]> {
  const { data, error } = await supabase
    .from("user_game_follows")
    .select("game_id, notify_announcements, notify_sales, notify_all_time_low, notify_releases")
    .eq("user_id", userId);
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    gameId: r.game_id,
    prefs: mapNotifyPrefs(r),
  }));
}

export interface FranchiseFollowRecord {
  franchiseId: string;
  prefs: NotifyPrefs;
}

export async function getUserFranchiseFollows(supabase: Client, userId: string): Promise<FranchiseFollowRecord[]> {
  const { data, error } = await supabase
    .from("user_franchise_follows")
    .select("franchise_id, notify_announcements, notify_sales, notify_all_time_low, notify_releases")
    .eq("user_id", userId);
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    franchiseId: r.franchise_id,
    prefs: mapNotifyPrefs(r),
  }));
}


export async function followGame(supabase: Client, userId: string, gameId: string) {
  const { error } = await supabase.from("user_game_follows").insert({ user_id: userId, game_id: gameId });
  if (error) throw error;
}

export async function unfollowGame(supabase: Client, userId: string, gameId: string) {
  const { error } = await supabase.from("user_game_follows").delete().eq("user_id", userId).eq("game_id", gameId);
  if (error) throw error;
}

export async function followFranchise(supabase: Client, userId: string, franchiseId: string) {
  const { error } = await supabase.from("user_franchise_follows").insert({ user_id: userId, franchise_id: franchiseId });
  if (error) throw error;
}

export async function unfollowFranchise(supabase: Client, userId: string, franchiseId: string) {
  const { error } = await supabase.from("user_franchise_follows").delete().eq("user_id", userId).eq("franchise_id", franchiseId);
  if (error) throw error;
}

export async function updateGameFollowPrefs(supabase: Client, userId: string, gameId: string, prefs: Partial<NotifyPrefs>) {
  const update: Record<string, boolean> = {};
  if (prefs.announcements !== undefined) update.notify_announcements = prefs.announcements;
  if (prefs.sales !== undefined) update.notify_sales = prefs.sales;
  if (prefs.allTimeLow !== undefined) update.notify_all_time_low = prefs.allTimeLow;
  if (prefs.releases !== undefined) update.notify_releases = prefs.releases;
  const { error } = await supabase.from("user_game_follows").update(update).eq("user_id", userId).eq("game_id", gameId);
  if (error) throw error;
}

export async function updateFranchiseFollowPrefs(supabase: Client, userId: string, franchiseId: string, prefs: Partial<NotifyPrefs>) {
  const update: Record<string, boolean> = {};
  if (prefs.announcements !== undefined) update.notify_announcements = prefs.announcements;
  if (prefs.sales !== undefined) update.notify_sales = prefs.sales;
  if (prefs.allTimeLow !== undefined) update.notify_all_time_low = prefs.allTimeLow;
  if (prefs.releases !== undefined) update.notify_releases = prefs.releases;
  const { error } = await supabase.from("user_franchise_follows").update(update).eq("user_id", userId).eq("franchise_id", franchiseId);
  if (error) throw error;
}

