import { createAdminClient } from "@/lib/nintendo/admin-client";
import { sendAlertToUsers } from "./send";
import { sendBatchedDigest } from "./send-batch";
import type { AlertPayload } from "./types";
import type { BatchAlertGame } from "./batch-template";

type PrefColumn = "notify_sales" | "notify_all_time_low" | "notify_releases" | "notify_announcements";

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
}

// Alert types that qualify for batching (price-related alerts only)
const BATCHABLE_TYPES = new Set(["price_drop", "all_time_low", "sale_started", "sale_ending"]);
const BATCH_THRESHOLD = 5;

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
      console.warn(`Unknown alert type "${alertType}" — defaulting to notify_sales`);
      return "notify_sales";
  }
}

interface PendingAlert {
  payload: AlertPayload;
  batchGame: BatchAlertGame;
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
    .select("id, game_id, type, headline, subtext, new_price, old_price, discount, sale_end_date, games!inner ( slug, title, cover_art, nsuid, nintendo_url, franchise )")
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
  // Map userId -> list of { payload, batchGame } for batchable alerts
  // Map userId -> list of payloads for non-batchable alerts
  const userBatchableAlerts = new Map<string, PendingAlert[]>();
  const userNonBatchableAlerts = new Map<string, AlertPayload[]>();

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

    const isBatchable = BATCHABLE_TYPES.has(alert.type);

    for (const userId of allUserIds) {
      if (isBatchable) {
        const list = userBatchableAlerts.get(userId) ?? [];
        list.push({
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
        });
        userBatchableAlerts.set(userId, list);
      } else {
        const list = userNonBatchableAlerts.get(userId) ?? [];
        list.push(payload);
        userNonBatchableAlerts.set(userId, list);
      }
    }
  }

  // ── Phase 2: Send non-batchable alerts individually (grouped by alert for efficiency) ──
  const nonBatchableByAlert = new Map<string, { payload: AlertPayload; userIds: string[] }>();
  for (const [userId, payloads] of Array.from(userNonBatchableAlerts.entries())) {
    for (const payload of payloads) {
      const existing = nonBatchableByAlert.get(payload.alertId);
      if (existing) {
        existing.userIds.push(userId);
      } else {
        nonBatchableByAlert.set(payload.alertId, { payload, userIds: [userId] });
      }
    }
  }

  dispatched = 0; // Reset — count actual sends
  for (const { payload, userIds } of Array.from(nonBatchableByAlert.values())) {
    console.log(`  Dispatching "${payload.alertType}" for "${payload.gameTitle}" to ${userIds.length} users`);
    const sent = await sendAlertToUsers(userIds, payload);
    dispatched += sent;
    if (sent < userIds.length) {
      console.warn(`  ${userIds.length - sent}/${userIds.length} failed for alert ${payload.alertId}`);
    }
  }

  // ── Phase 3: Handle batchable alerts — batch or individual ──
  for (const [userId, pendingAlerts] of Array.from(userBatchableAlerts.entries())) {
    if (pendingAlerts.length >= BATCH_THRESHOLD) {
      // Send one batched digest email
      console.log(`  Batching ${pendingAlerts.length} price alerts for user ${userId.slice(0, 8)}...`);
      const games = pendingAlerts.map((pa) => pa.batchGame);
      await sendBatchedDigest(userId, games, pendingAlerts.map((pa) => pa.payload.alertId));
      dispatched += 1; // One email, not N
    } else {
      // Send individually
      for (const pa of pendingAlerts) {
        await sendAlertToUsers([userId], pa.payload);
        dispatched += 1;
      }
    }
  }

  console.log(`  Dispatch complete: ${dispatched} notifications sent`);
  return dispatched;
}
