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
    .select("id, game_id, type, headline, subtext, new_price, old_price, discount, sale_end_date, games!inner ( slug, title, cover_art, nsuid )")
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (error || !alerts) {
    console.error("Failed to fetch recent alerts for dispatch:", error?.message);
    return 0;
  }

  console.log(`  Found ${alerts.length} alerts to dispatch since ${since}`);

  for (const alert of alerts) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const game = alert.games as any;
    const prefCol = getPrefColumn(alert.type);

    // Check if notifications were already successfully sent for this alert
    const { data: existingLogs } = await supabase
      .from("notification_log")
      .select("id")
      .eq("alert_id", alert.id)
      .eq("status", "sent")
      .limit(1);

    if (existingLogs && existingLogs.length > 0) {
      console.log(`  Skipping alert ${alert.id} — already dispatched`);
      continue;
    }

    // Find users following this game who have this pref enabled
    const { data: followers } = await supabase
      .from("user_game_follows")
      .select("user_id")
      .eq("game_id", alert.game_id)
      .eq(prefCol, true);

    // Also find users following the game's franchise with this pref enabled
    const { data: gameData } = await supabase
      .from("games")
      .select("franchise")
      .eq("id", alert.game_id)
      .single();

    let franchiseFollowerIds: string[] = [];
    if (gameData?.franchise) {
      const { data: franchise } = await supabase
        .from("franchises")
        .select("id")
        .eq("name", gameData.franchise)
        .single();

      if (franchise) {
        const { data: franchiseFollowers } = await supabase
          .from("user_franchise_follows")
          .select("user_id")
          .eq("franchise_id", franchise.id)
          .eq(prefCol, true);
        franchiseFollowerIds = (franchiseFollowers ?? []).map((f: { user_id: string }) => f.user_id);
      }
    }

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
