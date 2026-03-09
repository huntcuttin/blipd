import { createAdminClient } from "@/lib/nintendo/admin-client";
import { sendAlertToUsers } from "./send";
import type { AlertPayload } from "./types";

// Map alert types to the notification preference column that controls them
function getPrefColumn(alertType: string): string {
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
      return "notify_sales"; // safe fallback
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

  // Batch dedup check: get all alert IDs that were already dispatched
  const alertIds = alerts.map((a) => a.id);
  const { data: sentLogs } = alertIds.length > 0
    ? await supabase
        .from("notification_log")
        .select("alert_id")
        .in("alert_id", alertIds)
        .eq("status", "sent")
    : { data: [] };
  const alreadySent = new Set((sentLogs ?? []).map((l: { alert_id: string }) => l.alert_id));

  // Pre-fetch franchise IDs for all unique franchise names in this batch
  const franchiseNames = Array.from(new Set(
    alerts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((a) => (a.games as any)?.franchise as string | null)
      .filter((f): f is string => !!f)
  ));
  const franchiseIdMap = new Map<string, string>();
  if (franchiseNames.length > 0) {
    const { data: franchiseRows } = await supabase
      .from("franchises")
      .select("id, name")
      .in("name", franchiseNames);
    for (const f of franchiseRows ?? []) {
      franchiseIdMap.set(f.name, f.id);
    }
  }

  for (const alert of alerts) {
    if (alreadySent.has(alert.id)) {
      console.log(`  Skipping alert ${alert.id} — already dispatched`);
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const game = alert.games as any;
    const prefCol = getPrefColumn(alert.type);

    // Fetch game followers and franchise followers in parallel
    const franchiseId = game.franchise ? franchiseIdMap.get(game.franchise) : undefined;
    const [{ data: followers }, franchiseResult] = await Promise.all([
      supabase
        .from("user_game_follows")
        .select("user_id")
        .eq("game_id", alert.game_id)
        .eq(prefCol, true),
      franchiseId
        ? supabase
            .from("user_franchise_follows")
            .select("user_id")
            .eq("franchise_id", franchiseId)
            .eq(prefCol, true)
        : Promise.resolve({ data: [] as { user_id: string }[] }),
    ]);

    const franchiseFollowerIds = (franchiseResult.data ?? []).map((f: { user_id: string }) => f.user_id);

    // Merge and deduplicate user IDs
    const gameFollowerIds = (followers ?? []).map((f: { user_id: string }) => f.user_id);
    const allUserIds = Array.from(new Set([...gameFollowerIds, ...franchiseFollowerIds]));

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
      gameCoverArt: game.cover_art,
      headline: alert.headline,
      subtext: alert.subtext,
      nsuid: game.nsuid ?? null,
    };

    // Use structured price fields from the alerts table
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
