import { getUserNotificationChannels } from "./channels";
import { sendEmailAlert, logNotification } from "./email";
import { sendPushToUser } from "./push";
import type { AlertPayload } from "./types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.blippd.app";

function alertToPushPayload(payload: AlertPayload) {
  const url = `${APP_URL}/game/${payload.gameSlug}`;
  switch (payload.alertType) {
    case "price_drop":
    case "sale_started":
      return {
        title: `${payload.gameTitle} is on sale`,
        body: payload.headline,
        url,
        tag: `sale-${payload.gameId}`,
      };
    case "all_time_low":
      return {
        title: `🏆 All-time low: ${payload.gameTitle}`,
        body: payload.headline,
        url,
        tag: `atl-${payload.gameId}`,
      };
    case "out_now":
    case "release_today":
      return {
        title: `${payload.gameTitle} is out now`,
        body: payload.headline,
        url,
        tag: `release-${payload.gameId}`,
      };
    default:
      return {
        title: "blippd alert",
        body: payload.headline,
        url,
        tag: `alert-${payload.alertId}`,
      };
  }
}

/**
 * Sends an alert to a user across all their enabled notification channels.
 * Returns true if at least one channel succeeded.
 */
export async function sendAlert(
  userId: string,
  payload: AlertPayload
): Promise<boolean> {
  const channels = await getUserNotificationChannels(userId);
  if (channels.length === 0) return false;

  const results = await Promise.allSettled(
    channels.map((channel) => {
      switch (channel) {
        case "email":
          return sendEmailAlert(userId, payload);
        case "web_push":
          // sendPushToUser resolves the count of subscriptions successfully
          // pushed to, not a boolean — comparing it to `true` below would
          // never match, so a genuinely successful push was never counted
          // as a success. Also logs to notification_log, which push never
          // did before — without that, dispatch's dedup check (based on
          // notification_log rows) couldn't catch a repeat push if this
          // job runs again for the same alert.
          return sendPushToUser(userId, alertToPushPayload(payload)).then(async (count) => {
            const success = count > 0;
            await logNotification(userId, payload.alertId, "web_push", success ? "sent" : "failed");
            return success;
          });
        default:
          return Promise.resolve(false);
      }
    })
  );

  let anySuccess = false;
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Notification channel failed:", result.reason);
    } else if (result.value === true) {
      anySuccess = true;
    }
  }
  return anySuccess;
}

/**
 * Sends an alert to multiple users. Used by the alert generation pipeline
 * after creating an alert and resolving its affected users.
 * Returns the count of users who received at least one successful notification.
 */
export async function sendAlertToUsers(
  userIds: string[],
  payload: AlertPayload
): Promise<number> {
  const BATCH_SIZE = 10;
  let successCount = 0;

  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((userId) => sendAlert(userId, payload))
    );
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) successCount++;
    }
    // Pause between batches to stay within Resend rate limits
    if (i + BATCH_SIZE < userIds.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return successCount;
}
