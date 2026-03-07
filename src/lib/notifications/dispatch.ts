import { createAdminClient } from "@/lib/nintendo/admin-client";
import { sendAlertToUsers } from "./send";
import type { AlertPayload } from "./types";

/**
 * Dispatches notifications for all alerts created since the given timestamp.
 * Designed to run after the alert generation pipeline completes.
 * Queries recent alerts, finds affected users, and sends notifications.
 */
export async function dispatchRecentAlerts(since: string): Promise<number> {
  const supabase = createAdminClient();
  let dispatched = 0;

  // Get alerts created since the given timestamp
  const { data: alerts, error } = await supabase
    .from("alerts")
    .select("id, game_id, type, headline, subtext, games!inner ( slug, title, cover_art )")
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (error || !alerts) {
    console.error("Failed to fetch recent alerts for dispatch:", error?.message);
    return 0;
  }

  for (const alert of alerts) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const game = alert.games as any;

    // Get users who have this alert (via user_alert_status)
    const { data: statuses } = await supabase
      .from("user_alert_status")
      .select("user_id")
      .eq("alert_id", alert.id);

    const userIds = (statuses ?? []).map((s: { user_id: string }) => s.user_id);
    if (userIds.length === 0) continue;

    // Check if notifications were already sent for this alert
    const { data: existingLogs } = await supabase
      .from("notification_log")
      .select("id")
      .eq("alert_id", alert.id)
      .limit(1);

    if (existingLogs && existingLogs.length > 0) continue;

    const payload: AlertPayload = {
      alertId: alert.id,
      alertType: alert.type,
      gameId: alert.game_id,
      gameSlug: game.slug,
      gameTitle: game.title,
      gameCoverArt: game.cover_art,
      headline: alert.headline,
      subtext: alert.subtext,
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

    await sendAlertToUsers(userIds, payload);
    dispatched += userIds.length;
  }

  return dispatched;
}
