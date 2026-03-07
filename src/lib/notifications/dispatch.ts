import { createAdminClient } from "@/lib/nintendo/admin-client";
import { sendAlertToUsers } from "./send";
import type { AlertPayload } from "./types";

/**
 * Dispatches notifications for all alerts created since the given timestamp.
 * Designed to run after the alert generation pipeline completes.
 * Queries recent alerts, finds users following the affected game, and sends notifications.
 */
export async function dispatchRecentAlerts(since: string): Promise<number> {
  const supabase = createAdminClient();
  let dispatched = 0;

  // Get alerts created since the given timestamp
  const { data: alerts, error } = await supabase
    .from("alerts")
    .select("id, game_id, type, headline, subtext, games!inner ( slug, title, cover_art, nsuid )")
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

    // Check if notifications were already sent for this alert
    const { data: existingLogs } = await supabase
      .from("notification_log")
      .select("id")
      .eq("alert_id", alert.id)
      .limit(1);

    if (existingLogs && existingLogs.length > 0) {
      console.log(`  Skipping alert ${alert.id} — already dispatched`);
      continue;
    }

    // Find users following this game via user_game_follows
    const { data: followers } = await supabase
      .from("user_game_follows")
      .select("user_id")
      .eq("game_id", alert.game_id);

    // Also find users following the game's franchise
    const { data: gameData } = await supabase
      .from("games")
      .select("franchise")
      .eq("id", alert.game_id)
      .single();

    let franchiseFollowerIds: string[] = [];
    if (gameData?.franchise) {
      // Get franchise id
      const { data: franchise } = await supabase
        .from("franchises")
        .select("id")
        .eq("name", gameData.franchise)
        .single();

      if (franchise) {
        const { data: franchiseFollowers } = await supabase
          .from("user_franchise_follows")
          .select("user_id")
          .eq("franchise_id", franchise.id);
        franchiseFollowerIds = (franchiseFollowers ?? []).map((f: { user_id: string }) => f.user_id);
      }
    }

    // Merge and deduplicate user IDs
    const gameFollowerIds = (followers ?? []).map((f: { user_id: string }) => f.user_id);
    const allUserIds = Array.from(new Set([...gameFollowerIds, ...franchiseFollowerIds]));

    if (allUserIds.length === 0) {
      console.log(`  No followers for game ${game.title} — skipping`);
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

    // Extract price data from the alert text for templates
    const priceMatch = alert.headline.match(/\$(\d+\.\d{2})/);
    if (priceMatch) payload.newPrice = parseFloat(priceMatch[1]);

    const oldPriceMatch = alert.subtext.match(/Was \$(\d+\.\d{2})/);
    if (oldPriceMatch) payload.oldPrice = parseFloat(oldPriceMatch[1]);

    const discountMatch = alert.headline.match(/(\d+)% off/);
    if (discountMatch) payload.discount = parseInt(discountMatch[1]);

    const endMatch = alert.subtext.match(/Ends (.+)/);
    if (endMatch) payload.saleEndDate = endMatch[1];

    await sendAlertToUsers(allUserIds, payload);
    dispatched += allUserIds.length;
  }

  console.log(`  Dispatch complete: ${dispatched} notifications sent`);
  return dispatched;
}
