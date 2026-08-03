import { createAdminClient } from "@/lib/nintendo/admin-client";
import { sendAlertToUsers } from "./send";
import { sendBatchedDigest, sendLaunchDigest } from "./send-batch";
import { planUserDispatch } from "./batching";
import type { AlertPayload } from "./types";
import type { BatchAlertGame } from "./batch-template";
import type { LaunchDigestGame } from "./launch-digest-template";

export type PrefColumn = "notify_sales" | "notify_all_time_low" | "notify_releases" | "notify_announcements";

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
  nintendo_url: string | null;
  franchise: string | null;
  is_suppressed: boolean;
  product_type: string | null;
}

// A game is junk/suppressed for FRANCHISE-fanout purposes only -- direct
// game follows are exempt everywhere (Product Bible: "a followed game
// always alerts regardless of tier; the user opted in"). Every documented
// false-alert incident this project has had reached a real inbox via
// franchise fanout, never via a direct follow, so this is the one place a
// junk/DLC/bundle item must never reach a user who didn't specifically
// follow it.
function isJunkForFanout(game: AlertGame): boolean {
  if (game.is_suppressed) return true;
  return game.product_type === "ADD_ON_CONTENT" || game.product_type === "BUNDLE";
}

// Which alert types group together, and how many it takes to collapse into one
// email, now lives in ./batching — see planUserDispatch.

// Map alert types to the notification preference column that controls them
export function getPrefColumn(alertType: string): PrefColumn {
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
    case "retro_game_added":
      return "notify_announcements";
    default:
      console.warn(`Unknown alert type "${alertType}" — defaulting to notify_sales`);
      return "notify_sales";
  }
}

interface PendingAlert {
  payload: AlertPayload;
  /** Row data if this ends up in a price digest. */
  batchGame: BatchAlertGame;
  /** Row data if this ends up in a launch digest. */
  launchGame: LaunchDigestGame;
}

/**
 * Dispatches notifications for all alerts created since the given timestamp.
 * Implements batching: if a user would receive 5+ price-related alerts in one
 * dispatch window, they get a single digest email instead of individual ones.
 */
export async function dispatchRecentAlerts(since: string): Promise<number> {
  const supabase = createAdminClient();
  let dispatched = 0;

  // Get alerts created since the given timestamp
  const { data: alerts, error } = await supabase
    .from("alerts")
    .select("id, game_id, type, headline, subtext, new_price, old_price, discount, sale_end_date, games!inner ( slug, title, cover_art, nsuid, nintendo_url, franchise, is_suppressed, product_type )")
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

  // ── Phase 1: Collect per-user alert lists ──
  // Map userId -> every alert they're due, in creation order. Whether each one
  // collapses into a digest is decided per user in Phase 2.
  const userPendingAlerts = new Map<string, PendingAlert[]>();

  for (const alert of alerts) {
    const game = alert.games as unknown as AlertGame;
    const prefCol = getPrefColumn(alert.type);

    // Filter pre-fetched followers by the relevant notification preference
    const gameFollowerIds = (gameFollowsByGame.get(alert.game_id) ?? [])
      .filter((f) => f[prefCol])
      .map((f) => f.user_id);

    // Franchise fanout is where every junk-content false alert this project
    // has had actually reached a real inbox — a directly-followed game
    // always alerts regardless of this check (see isJunkForFanout).
    const franchiseId = game.franchise && !isJunkForFanout(game) ? franchiseIdMap.get(game.franchise) : undefined;
    const franchiseFollowerIds = franchiseId
      ? (franchiseFollowsByFranchise.get(franchiseId) ?? [])
          .filter((f) => f[prefCol])
          .map((f) => f.user_id)
      : [];

    // Deduplicate and exclude users already sent this alert
    const allUserIds = Array.from(new Set([...gameFollowerIds, ...franchiseFollowerIds]))
      .filter((uid) => !alreadySentPairs.has(`${alert.id}:${uid}`));

    if (allUserIds.length === 0) continue;

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
      nintendoUrl: game.nintendo_url ?? null,
    };

    if (alert.new_price != null) {
      const n = Number(alert.new_price);
      if (!isNaN(n) && n >= 0) payload.newPrice = n;
    }
    if (alert.old_price != null) {
      const n = Number(alert.old_price);
      if (!isNaN(n) && n >= 0) payload.oldPrice = n;
    }
    if (alert.discount != null) {
      const n = Number(alert.discount);
      if (!isNaN(n) && n >= 0 && n <= 100) payload.discount = n;
    }
    if (alert.sale_end_date) payload.saleEndDate = alert.sale_end_date;

    const pending: PendingAlert = {
      payload,
      batchGame: {
        title: game.title,
        slug: game.slug,
        newPrice: payload.newPrice ?? 0,
        oldPrice: payload.oldPrice ?? 0,
        discount: payload.discount ?? 0,
        alertType: alert.type,
        saleEndDate: alert.sale_end_date,
        nsuid: game.nsuid,
      },
      launchGame: {
        title: game.title,
        slug: game.slug,
        price: payload.newPrice ?? null,
        nsuid: game.nsuid,
      },
    };

    for (const userId of allUserIds) {
      const list = userPendingAlerts.get(userId) ?? [];
      list.push(pending);
      userPendingAlerts.set(userId, list);
    }
  }

  // ── Phase 2: Decide per user what batches and what doesn't ──
  // Digests are per user; individual sends are pooled back together by alert so
  // one alert going to N users stays a single sendAlertToUsers call.
  const digestJobs: { userId: string; group: "price" | "launch"; items: PendingAlert[] }[] = [];
  const individualByAlert = new Map<string, { payload: AlertPayload; userIds: string[] }>();

  for (const [userId, pendingAlerts] of Array.from(userPendingAlerts.entries())) {
    const plan = planUserDispatch(pendingAlerts, (pa) => pa.payload.alertType);

    for (const digest of plan.digests) {
      digestJobs.push({ userId, group: digest.group, items: digest.items });
    }

    for (const pa of plan.individual) {
      const existing = individualByAlert.get(pa.payload.alertId);
      if (existing) existing.userIds.push(userId);
      else individualByAlert.set(pa.payload.alertId, { payload: pa.payload, userIds: [userId] });
    }
  }

  dispatched = 0; // Reset — count actual sends

  // ── Phase 3: Individual sends ──
  for (const { payload, userIds } of Array.from(individualByAlert.values())) {
    console.log(`  Dispatching "${payload.alertType}" for "${payload.gameTitle}" to ${userIds.length} users`);
    const sent = await sendAlertToUsers(userIds, payload);
    dispatched += sent;
    if (sent < userIds.length) {
      console.warn(`  ${userIds.length - sent}/${userIds.length} failed for alert ${payload.alertId}`);
    }
  }

  // ── Phase 4: Grouped digests — one email per user per group ──
  for (const job of digestJobs) {
    const alertIds = job.items.map((pa) => pa.payload.alertId);
    const shortId = job.userId.slice(0, 8);
    console.log(`  Batching ${job.items.length} ${job.group} alerts for user ${shortId}...`);

    const ok =
      job.group === "launch"
        ? await sendLaunchDigest(job.userId, job.items.map((pa) => pa.launchGame), alertIds)
        : await sendBatchedDigest(job.userId, job.items.map((pa) => pa.batchGame), alertIds);

    if (ok) dispatched += 1; // One email, not N
    else console.warn(`  ${job.group} digest failed for user ${shortId}`);
  }

  console.log(`  Dispatch complete: ${dispatched} notifications sent`);
  return dispatched;
}
