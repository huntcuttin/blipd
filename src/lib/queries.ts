import type { SupabaseClient } from "@supabase/supabase-js";
import type { Game, Franchise, GameAlert, ConsolePreference, NotifyPrefs, NamedSaleEvent } from "@/lib/types";
import { getGameTier, isNintendoFirstParty, getNintendoIpTier } from "@/lib/ranking";
import { PLACEHOLDER_DATES } from "@/lib/format";

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
    igdbHype: row.igdb_hype ?? null,
    platform: row.platform ?? null,
    saleEventId: row.sale_event_id ?? null,
    retroPlatform: row.retro_platform ?? null,
    hasDemo: row.has_demo ?? false,
    genres: Array.isArray(row.genres) ? row.genres : [],
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

export async function getGamesOnSale(supabase: Client): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("is_on_sale", true)
    .eq("is_suppressed", false)
    // Junk carries the deepest "discounts" (a $0.99 costume piece reading as
    // 90% off) -- same null-lenient OR as getRecentReleases, see its comment.
    .or("product_type.is.null,product_type.not.in.(ADD_ON_CONTENT,BUNDLE)")
    .order("discount", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map(mapGame);
}

export async function getActiveNamedSaleEvents(supabase: Client): Promise<NamedSaleEvent[]> {
  const { data, error } = await supabase
    .from("named_sale_events")
    .select("*")
    .eq("active", true)
    .order("detected_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  // Deduplicate by name — keep the most recent (already ordered by detected_at desc)
  const seen = new Set<string>();
  const deduped = (data ?? []).filter((row) => {
    // Defensive: never show a 0-tagged event even if `active` is stale
    if (row.games_count <= 0) return false;
    if (seen.has(row.name)) return false;
    seen.add(row.name);
    return true;
  });
  return deduped.map((row) => ({
    id: row.id,
    name: row.name,
    detectedAt: row.detected_at,
    active: row.active,
    gamesCount: row.games_count,
  }));
}

export async function getRecentReleases(supabase: Client): Promise<Game[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("release_status", "released")
    .eq("is_suppressed", false)
    // Excludes individual DLC ("Sharing Stone", a $2.99 Pokemon Quest item)
    // and edition/bundle re-listings ("PGA TOUR 2K25 Legend Edition Year 2",
    // dated two weeks after the base game) from reading as fresh new
    // releases -- confirmed live 2026-08-03 both were slipping through
    // because they already had a real release_date from ingest, so none of
    // this session's earlier placeholder-date-only suppression sweeps ever
    // touched them. product_type is null for rows not yet backfilled after
    // this column was added -- plain .not("product_type", "in", ...) would
    // silently exclude every one of those too (NOT IN treats NULL as
    // non-matching in standard SQL three-valued logic, confirmed live before
    // shipping this), so this explicitly keeps null alongside anything
    // that's actually not junk.
    .or("product_type.is.null,product_type.not.in.(ADD_ON_CONTENT,BUNDLE)")
    .gte("release_date", thirtyDaysAgo)
    .neq("release_date", "2099-12-31")
    .neq("release_date", "2020-01-01")
    .gt("original_price", 0)
    .order("release_date", { ascending: false })
    .limit(100);
  if (error) throw error;
  const games = (data ?? []).map(mapGame);
  // Tiered Nintendo IP boost (getNintendoIpTier), not the old binary
  // franchise-tag check -- title-based so it survives the franchise-tag
  // gaps that let real Nintendo releases slip past the boost entirely,
  // and tiered so Mario/Zelda/Pokemon-class IP outranks smaller Nintendo
  // titles instead of tying with them. Release date breaks ties within
  // each tier.
  return games.sort((a, b) => {
    const tierDiff = getNintendoIpTier(b) - getNintendoIpTier(a);
    if (tierDiff !== 0) return tierDiff;
    return b.releaseDate.localeCompare(a.releaseDate);
  });
}

/** Top ~30 well-known released games for the onboarding "games you own" picker. */
export async function getPopularGames(supabase: Client): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("release_status", "released")
    .eq("is_suppressed", false)
    .gt("original_price", 0)
    .not("metacritic_score", "is", null)
    .order("metacritic_score", { ascending: false })
    .limit(60);
  if (error) throw error;
  const games = (data ?? []).map(mapGame);
  // Nintendo's own titles lead regardless of score — getGameTier() alone
  // isn't enough here, since it buckets Nintendo in with any 85+ third-party
  // game, and a 95-rated indie would still outrank Mario within that tier on
  // raw score. Tier still breaks the remaining ties (Tier 2 above Tier 3).
  games.sort((a, b) => {
    const nintendoDiff = Number(isNintendoFirstParty(b)) - Number(isNintendoFirstParty(a));
    if (nintendoDiff !== 0) return nintendoDiff;
    const tierDiff = getGameTier(a) - getGameTier(b);
    if (tierDiff !== 0) return tierDiff;
    return (b.metacriticScore ?? 0) - (a.metacriticScore ?? 0);
  });
  return games.slice(0, 30);
}

export async function getGameBySlug(supabase: Client, slug: string): Promise<Game | null> {
  const { data, error } = await supabase.from("games").select("*").eq("slug", slug).maybeSingle();
  if (error || !data) return null;
  return mapGame(data);
}

// Title fragments that indicate DLC / add-ons — not standalone games
const ADDON_PATTERNS = [
  "upgrade pack",
  "expansion pass",
  "season pass",
  " - dlc",
  "booster course",
  "additional content",
];

function isAddon(title: string): boolean {
  const lower = title.toLowerCase();
  return ADDON_PATTERNS.some((p) => lower.includes(p));
}

export async function searchGames(
  supabase: Client,
  query: string,
  consolePreference?: ConsolePreference | null
): Promise<Game[]> {
  // Try Algolia first for relevance-ranked results, fall back to ILIKE
  try {
    const { fetchGameCatalog } = await import("@/lib/nintendo/client");
    // Switch 2 users see Switch 2 titles; everyone else sees both platforms
    const platformFilter =
      consolePreference === "switch2"
        ? 'platform:"Nintendo Switch 2"'
        : '(platform:"Nintendo Switch" OR platform:"Nintendo Switch 2")';
    const result = await fetchGameCatalog({
      query,
      hitsPerPage: 40,
      filters: `topLevelCategoryCode:GAMES AND ${platformFilter}`,
    });

    // Only keep hits where the title actually contains the query (avoids fuzzy false positives).
    // eshopDetails.productType is Nintendo's own authoritative signal (see
    // isStandaloneGame's comment) -- isAddon's title regex alone missed real
    // junk like "PGA TOUR 2K25 Legend Edition Year 2" (a BUNDLE with no
    // addon-pattern keyword in its title), and search is the one place a
    // user can still follow junk directly, sidestepping every catalog-level
    // filter. Null-lenient: only exclude an exact ADD_ON_CONTENT/BUNDLE match.
    const queryLower = query.toLowerCase();
    const nsuids = result.hits
      .filter((h) => !isAddon(h.title ?? ""))
      .filter((h) => {
        const pt = h.eshopDetails?.productType;
        return pt !== "ADD_ON_CONTENT" && pt !== "BUNDLE";
      })
      .filter((h) => (h.title ?? "").toLowerCase().includes(queryLower))
      .map((h) => h.nsuid)
      .filter(Boolean) as string[];

    // Run Algolia DB lookup + announced-game DB search in parallel
    const escaped = query.replace(/[%_]/g, "\\$&");
    const [eshopResult, announcedResult] = await Promise.all([
      nsuids.length > 0
        ? supabase.from("games").select("*").in("nsuid", nsuids).eq("is_suppressed", false).limit(20)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("games")
        .select("*")
        .is("nsuid", null)
        .eq("release_status", "upcoming")
        .eq("is_suppressed", false)
        .ilike("title", `%${escaped}%`)
        .limit(10),
    ]);

    if (eshopResult.error) throw eshopResult.error;

    // eShop results in Algolia rank order, then announced games appended
    const byNsuid = new Map((eshopResult.data ?? []).map((g) => [g.nsuid, g]));
    const eshopGames = nsuids
      .map((nsuid) => byNsuid.get(nsuid))
      .filter((g): g is NonNullable<typeof g> => !!g)
      .slice(0, 20)
      .map(mapGame);

    const announcedGames = (announcedResult.data ?? []).map(mapGame);
    const seenIds = new Set(eshopGames.map((g) => g.id));
    const newAnnounced = announcedGames.filter((g) => !seenIds.has(g.id));

    return [...eshopGames, ...newAnnounced].slice(0, 20);
  } catch {
    // Algolia unavailable — fall back to DB ILIKE
    const escaped = query.replace(/[%_]/g, "\\$&");
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .eq("is_suppressed", false)
      .ilike("title", `%${escaped}%`)
      .order("title")
      .limit(20);
    if (error) throw error;
    return (data ?? []).map(mapGame);
  }
}

export async function getGameFollowerCount(supabase: Client, gameId: string): Promise<number> {
  const { count, error } = await supabase
    .from("user_game_follows")
    .select("id", { count: "exact", head: true })
    .eq("game_id", gameId);
  if (error) return 0;
  return count ?? 0;
}

/**
 * Pipeline-global freshness signal for the "last checked X min ago" stamp
 * (Bible mandate: "users should never have to wonder if their alerts are
 * working"). Deliberately the freshest last_price_check across the WHOLE
 * catalog, not any single game's -- same query health-check's own
 * freshness check already uses to detect a stale pipeline.
 */
export async function getLastPriceCheckTimestamp(supabase: Client): Promise<string | null> {
  const { data, error } = await supabase
    .from("games")
    .select("last_price_check")
    .order("last_price_check", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.last_price_check) return null;
  return data.last_price_check as string;
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
  // Try exact match first, then case-insensitive
  const { data, error } = await supabase.from("franchises").select("*").ilike("name", name).maybeSingle();
  if (error || !data) return null;
  return mapFranchise(data);
}

// ── Alert queries ─────────────────────────────────────────────

export async function getAlerts(supabase: Client, userId?: string): Promise<GameAlert[]> {
  // If user is logged in, only show alerts for games they follow
  let followedGameIds: Set<string> | null = null;
  // Followed franchise names, lowercased — batched once here (not per alert)
  // so "why am I seeing this" can be answered for franchise-sourced alerts
  // below without an N+1 query per row.
  let followedFranchiseNames: Set<string> | null = null;
  if (userId) {
    const { data: follows } = await supabase
      .from("user_game_follows")
      .select("game_id")
      .eq("user_id", userId);
    followedGameIds = new Set((follows ?? []).map((f: { game_id: string }) => f.game_id));

    const { data: franchiseFollows } = await supabase
      .from("user_franchise_follows")
      .select("franchises ( name )")
      .eq("user_id", userId);
    followedFranchiseNames = new Set(
      (franchiseFollows ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((f: any) => f.franchises?.name as string | undefined)
        .filter((n: string | undefined): n is string => !!n)
        .map((n: string) => n.toLowerCase())
    );
  }

  let query = supabase
    .from("alerts")
    .select("id, game_id, type, headline, subtext, created_at, games!inner ( title, cover_art, slug, franchise )")
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

  return (data ?? [])
    .filter((row: { id: string }) => !dismissedSet.has(row.id))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((row: any) => {
      // Direct follow wins over franchise follow (a user can follow both the
      // game and its franchise) — "Watching" is the obvious default and the
      // UI renders nothing for it; only the franchise case is worth a chip.
      let sourceLabel: string | null = null;
      if (userId) {
        if (followedGameIds?.has(row.game_id)) {
          sourceLabel = "Watching";
        } else if (row.games.franchise && followedFranchiseNames?.has(String(row.games.franchise).toLowerCase())) {
          sourceLabel = row.games.franchise;
        }
      }
      return {
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
        sourceLabel,
      };
    });
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
    .upsert({ user_id: userId, alert_id: alertId, read: true }, { onConflict: "user_id,alert_id" });
  if (error) throw error;
}

export async function markAllAlertsRead(supabase: Client, userId: string, alertIds: string[]) {
  if (alertIds.length === 0) return;
  const rows = alertIds.map((alert_id) => ({ user_id: userId, alert_id, read: true }));
  const { error } = await supabase
    .from("user_alert_status")
    .upsert(rows, { onConflict: "user_id,alert_id" });
  if (error) throw error;
}

export async function remindAlert(supabase: Client, userId: string, alertId: string) {
  const remindAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("user_alert_status")
    .upsert({ user_id: userId, alert_id: alertId, read: true, remind_at: remindAt }, { onConflict: "user_id,alert_id" });
  if (error) throw error;
}

export async function dismissAlerts(supabase: Client, userId: string, alertIds: string[]) {
  if (alertIds.length === 0) return;
  const rows = alertIds.map((alert_id) => ({ user_id: userId, alert_id, dismissed: true, read: true }));
  const { error } = await supabase
    .from("user_alert_status")
    .upsert(rows, { onConflict: "user_id,alert_id" });
  if (error) throw error;
}

// ── User profile queries ──────────────────────────────────────

export async function getUserProfile(supabase: Client, userId: string): Promise<{ consolePreference: ConsolePreference | null; onboardingCompleted: boolean }> {
  const { data } = await supabase
    .from("user_profiles")
    .select("console_preference, onboarding_completed")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    consolePreference: data?.console_preference ?? null,
    onboardingCompleted: data?.onboarding_completed ?? false,
  };
}

export async function setConsolePreference(supabase: Client, userId: string, preference: ConsolePreference) {
  const { error } = await supabase
    .from("user_profiles")
    .upsert({ user_id: userId, console_preference: preference, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ── Follow queries ────────────────────────────────────────────

export interface GameFollowRecord {
  gameId: string;
  prefs: NotifyPrefs;
  targetPrice: number | null;
}

export async function getUserGameFollows(supabase: Client, userId: string): Promise<GameFollowRecord[]> {
  const { data, error } = await supabase
    .from("user_game_follows")
    .select("game_id, notify_announcements, notify_sales, notify_all_time_low, notify_releases, target_price")
    .eq("user_id", userId);
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    gameId: r.game_id,
    prefs: mapNotifyPrefs(r),
    targetPrice: r.target_price != null ? Number(r.target_price) : null,
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

export async function setTargetPrice(supabase: Client, userId: string, gameId: string, targetPrice: number | null) {
  const { error } = await supabase
    .from("user_game_follows")
    .update({ target_price: targetPrice })
    .eq("user_id", userId)
    .eq("game_id", gameId);
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

// ── Games I Own queries ───────────────────────────────────────

export async function getUnreadAlertCount(supabase: Client, userId: string): Promise<number> {
  // Get game IDs the user follows
  const { data: follows } = await supabase
    .from("user_game_follows")
    .select("game_id")
    .eq("user_id", userId);
  const gameIds = (follows ?? []).map((f: { game_id: string }) => f.game_id);
  if (gameIds.length === 0) return 0;

  // Get recent alert IDs for followed games + read statuses in parallel
  const [alertsRes, statusesRes] = await Promise.all([
    supabase
      .from("alerts")
      .select("id")
      .in("game_id", gameIds)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("user_alert_status")
      .select("alert_id")
      .eq("user_id", userId)
      .eq("read", true),
  ]);

  const alertIds = (alertsRes.data ?? []).map((a: { id: string }) => a.id);
  if (alertIds.length === 0) return 0;

  const readIds = new Set((statusesRes.data ?? []).map((s: { alert_id: string }) => s.alert_id));
  return alertIds.filter((id: string) => !readIds.has(id)).length;
}

export async function getUserGameOwns(supabase: Client, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_game_owns")
    .select("game_id")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r: { game_id: string }) => r.game_id);
}

export async function markGameOwned(supabase: Client, userId: string, gameId: string) {
  const { error } = await supabase.from("user_game_owns").insert({ user_id: userId, game_id: gameId });
  if (error) throw error;
}

export async function unmarkGameOwned(supabase: Client, userId: string, gameId: string) {
  const { error } = await supabase.from("user_game_owns").delete().eq("user_id", userId).eq("game_id", gameId);
  if (error) throw error;
}

// ── Retro console follow queries ─────────────────────────────

export async function getUserRetroFollows(supabase: Client, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_retro_follows")
    .select("console")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r: { console: string }) => r.console);
}

export async function toggleRetroFollow(supabase: Client, userId: string, console: string): Promise<boolean> {
  // Check if already following
  const { data } = await supabase
    .from("user_retro_follows")
    .select("console")
    .eq("user_id", userId)
    .eq("console", console)
    .maybeSingle();

  if (data) {
    const { error } = await supabase
      .from("user_retro_follows")
      .delete()
      .eq("user_id", userId)
      .eq("console", console);
    if (error) throw error;
    return false; // unfollowed
  } else {
    const { error } = await supabase
      .from("user_retro_follows")
      .insert({ user_id: userId, console });
    if (error) throw error;
    return true; // followed
  }
}

export async function setRetroFollows(supabase: Client, userId: string, consoles: string[]): Promise<void> {
  // Delete all existing, then insert new ones
  await supabase.from("user_retro_follows").delete().eq("user_id", userId);
  if (consoles.length > 0) {
    const rows = consoles.map((c) => ({ user_id: userId, console: c }));
    const { error } = await supabase.from("user_retro_follows").insert(rows);
    if (error) throw error;
  }
}

// ── Feed queries ──────────────────────────────────────────────

export async function getUpcomingGamesSoon(supabase: Client): Promise<Game[]> {
  const today = new Date().toISOString().split("T")[0];
  const sixtyDaysOut = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  // No upper date bound at the query level -- Nintendo announces some of its
  // biggest titles many months out with a firm date attached (unlike most
  // third-party listings), and a flat 60-day cutoff silently hid every one
  // of those, so "Coming Soon" could show a single Nintendo game (whichever
  // happened to land inside the window) even when others were confirmed for
  // later this year. The real-dated upcoming pool is small (~60 games
  // catalog-wide as of writing), so fetching all of it and applying the
  // window in JS only for non-Nintendo titles is cheap.
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .in("release_status", ["upcoming", "out_today"])
    .eq("is_suppressed", false)
    // Same DLC/bundle exclusion as getRecentReleases -- see its comment.
    .or("product_type.is.null,product_type.not.in.(ADD_ON_CONTENT,BUNDLE)")
    .gte("release_date", today)
    .neq("release_date", "2099-12-31")
    .order("release_date", { ascending: true })
    .limit(200);
  if (error) throw error;
  const games = (data ?? []).map(mapGame);
  // Unlike /sales, getGameTier()'s score-based filter doesn't apply here —
  // unreleased games essentially never have a metacritic_score yet, so
  // filtering on it would wipe out almost every non-Nintendo upcoming title,
  // review-less rather than low-quality. Nintendo's own upcoming titles
  // still lead (same reasoning as the games-you-own picker), release date
  // still governs the rest so the page stays "what's coming, soonest first."
  return games
    .filter((g) => getNintendoIpTier(g) > 0 || g.releaseDate <= sixtyDaysOut)
    .sort((a, b) => {
      const tierDiff = getNintendoIpTier(b) - getNintendoIpTier(a);
      if (tierDiff !== 0) return tierDiff;
      return a.releaseDate.localeCompare(b.releaseDate);
    })
    .slice(0, 30);
}

/**
 * Real, followable upcoming titles with no resolvable release date at all --
 * genuinely different from getUpcomingGamesSoon's pool, which requires a
 * real date to even be selected (`neq release_date 2099-12-31`). Without
 * this query these games are invisible everywhere in the app despite being
 * legitimate catalog entries, not junk -- surfaced separately as "On the
 * Horizon" inside the Coming Soon page's TBA bucket.
 */
export async function getUnannouncedUpcomingGames(supabase: Client): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("release_status", "upcoming")
    .eq("is_suppressed", false)
    // Same DLC/bundle exclusion as getUpcomingGamesSoon -- see its comment.
    .or("product_type.is.null,product_type.not.in.(ADD_ON_CONTENT,BUNDLE)")
    .in("release_date", [...PLACEHOLDER_DATES])
    .order("igdb_hype", { ascending: false, nullsFirst: false })
    .limit(60);
  if (error) throw error;
  const games = (data ?? []).map(mapGame);
  // Same tiered Nintendo-IP-first convention as getUpcomingGamesSoon;
  // hype score is the only remaining signal once there's no date to sort by.
  return games
    .sort((a, b) => {
      const tierDiff = getNintendoIpTier(b) - getNintendoIpTier(a);
      if (tierDiff !== 0) return tierDiff;
      return (b.igdbHype ?? 0) - (a.igdbHype ?? 0);
    })
    .slice(0, 20);
}



