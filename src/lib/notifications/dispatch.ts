import { createAdminClient } from "@/lib/nintendo/admin-client";
import { sendAlertToUsers } from "./send";
import type { AlertPayload } from "./types";

const PREF_COLUMNS = ["notify_sales", "notify_all_time_low", "notify_releases", "notify_announcements"] as const;
type PrefColumn = (typeof PREF_COLUMNS)[number];

interface FollowRow {
  user_id: string;
  notify_sales: boolean;
  notify_all_time_low: boolean;
  notify_releases: boolean;
  notify_announcements: boolean;
}

interface AlertGame {
  slug: string;
  title: string;
  cover_art: string | null;
  nsuid: string | null;
  franchise: string | null;
}

// Map alert types to the notification preference column that controls them
function getPrefColumn(alertType: string): PrefColumn {
  switch (alertType) {
    case "price_drop":
    case "sale_started":
    case "sale_ending":
      return "notify_sales";
    case "all_time_low":
      return "notify_all_time_low";
    case "release_today":
    case "out_now":
      return "notify_releases";
    case "announced":
    case "switch2_edition_announced":
      return "notify_announcements";
    default:
      return "notify_sales";
  }
}

/**
 * Dispatches notifications for all alerts created since the given timestamp.
 * Designed to run after the alert generation pipeline completes.
 * Queries recent alerts, finds users following the affected game, and sends notifications.
 * Respects per-follow notification preferences.
 */
export async function dispatchRecentAlerts(since: string): Promise<number> {
  const supabase = createAdminClient();
  let dispatched = 0;

  // Get alerts created since the given timestamp
  const { data: alerts, error } = await supabase
    .from("alerts")
    .select("id, game_id, type, headline, subtext, new_price, old_price, discount, sale_end_date, games!inner ( slug, title, cover_art, nsuid, franchise )")
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (error || !alerts) {
    console.error("Failed to fetch recent alerts for dispatch:", error?.message);
    return 0;
  }

  console.log(`  Found ${alerts.length} alerts to dispatch since ${since}`);

  // Collect unique IDs for batch queries
  const alertIds = alerts.map((a) => a.id);
  const gameIds = Array.from(new Set(alerts.map((a) => a.game_id)));
  const franchiseNames = Array.from(new Set(
    alerts
      .map((a) => (a.games as unknown as AlertGame)?.franchise)
      .filter((f): f is string => !!f)
  ));

  // Batch: dedup check (per user+alert), game followers, franchise IDs — all in parallel
  const FOLLOW_COLS = "user_id, game_id, notify_sales, notify_all_time_low, notify_releases, notify_announcements";
  const FRANCHISE_FOLLOW_COLS = "user_id, franchise_id, notify_sales, notify_all_time_low, notify_releases, notify_announcements";

  const [sentLogsResult, gameFollowsResult, franchiseIdsResult] = await Promise.all([
    alertIds.length > 0
      ? supabase.from("notification_log").select("alert_id, user_id").in("alert_id", alertIds).eq("status", "sent")
      : Promise.resolve({ data: [] as { alert_id: string; user_id: string }[], error: null }),
    gameIds.length > 0
      ? supabase.from("user_game_follows").select(FOLLOW_COLS).in("game_id", gameIds)
      : Promise.resolve({ data: [] as (FollowRow & { game_id: string })[], error: null }),
    franchiseNames.length > 0
      ? supabase.from("franchises").select("id, name").in("name", franchiseNames)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
  ]);

  if (sentLogsResult.error) console.error("Failed to fetch sent logs:", sentLogsResult.error.message);
  if (gameFollowsResult.error) console.error("Failed to fetch game follows:", gameFollowsResult.error.message);
  if (franchiseIdsResult.error) console.error("Failed to fetch franchise IDs:", franchiseIdsResult.error.message);

  // If game follows query failed, we can't determine who to notify — abort
  if (gameFollowsResult.error) {
    console.error("Aborting dispatch: game follows query failed");
    return 0;
  }

  // Track which (alert_id, user_id) pairs were already sent
  const alreadySentPairs = new Set(
    (sentLogsResult.data ?? []).map((l) => `${l.alert_id}:${l.user_id}`)
  );

  // Index game followers by game_id
  const gameFollowsByGame = new Map<string, FollowRow[]>();
  for (const f of (gameFollowsResult.data ?? []) as (FollowRow & { game_id: string })[]) {
    const list = gameFollowsByGame.get(f.game_id) ?? [];
    list.push(f);
    gameFollowsByGame.set(f.game_id, list);
  }

  // Map franchise names to IDs
  const franchiseIdMap = new Map<string, string>();
  for (const f of (franchiseIdsResult.data ?? []) as { id: string; name: string }[]) {
    franchiseIdMap.set(f.name, f.id);
  }

  // Batch: franchise followers (need franchise IDs first)
  const allFranchiseIds = Array.from(new Set(franchiseIdMap.values()));
  const franchiseFollowsByFranchise = new Map<string, FollowRow[]>();
  if (allFranchiseIds.length > 0) {
    const { data: franchiseFollows } = await supabase
      .from("user_franchise_follows")
      .select(FRANCHISE_FOLLOW_COLS)
      .in("franchise_id", allFranchiseIds);
    for (const f of (franchiseFollows ?? []) as (FollowRow & { franchise_id: string })[]) {
      const list = franchiseFollowsByFranchise.get(f.franchise_id) ?? [];
      list.push(f);
      franchiseFollowsByFranchise.set(f.franchise_id, list);
    }
  }

  for (const alert of alerts) {
    const game = alert.games as unknown as AlertGame;
    const prefCol = getPrefColumn(alert.type);

    // Filter pre-fetched followers by the relevant notification preference
    const gameFollowerIds = (gameFollowsByGame.get(alert.game_id) ?? [])
      .filter((f) => f[prefCol])
      .map((f) => f.user_id);

    const franchiseId = game.franchise ? franchiseIdMap.get(game.franchise) : undefined;
    const franchiseFollowerIds = franchiseId
      ? (franchiseFollowsByFranchise.get(franchiseId) ?? [])
          .filter((f) => f[prefCol])
          .map((f) => f.user_id)
      : [];

    // Deduplicate and exclude users already sent this alert
    const allUserIds = Array.from(new Set([...gameFollowerIds, ...franchiseFollowerIds]))
      .filter((uid) => !alreadySentPairs.has(`${alert.id}:${uid}`));

    if (allUserIds.length === 0) {
      console.log(`  No followers for game ${game.title} (pref: ${prefCol}) — skipping`);
      continue;
    }

    console.log(`  Dispatching "${alert.type}" for "${game.title}" to ${allUserIds.length} users`);

    const payload: AlertPayload = {
      alertId: alert.id,
      alertType: alert.type,
      gameId: alert.game_id,
      gameSlug: game.slug,
      gameTitle: game.title,
      gameCoverArt: game.cover_art ?? "",
      headline: alert.headline,
      subtext: alert.subtext,
      nsuid: game.nsuid ?? null,
    };

    if (alert.new_price != null) payload.newPrice = Number(alert.new_price);
    if (alert.old_price != null) payload.oldPrice = Number(alert.old_price);
    if (alert.discount != null) payload.discount = Number(alert.discount);
    if (alert.sale_end_date) payload.saleEndDate = alert.sale_end_date;

    await sendAlertToUsers(allUserIds, payload);
    dispatched += allUserIds.length;
  }

  console.log(`  Dispatch complete: ${dispatched} notifications sent`);
  return dispatched;
}
