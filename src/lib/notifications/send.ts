import { getUserNotificationChannels } from "./channels";
import { sendEmailAlert, logNotification } from "./email";
import { sendPushToUser } from "./push";
import { isRateLimited } from "./rate-limit";
import type { AlertPayload, SendOutcome } from "./types";

// .trim() guards against a trailing newline in the env var's stored value
// (observed live: emailed links rendered as "blippd.app\r\n/game/..." --
// most browsers silently strip the whitespace per the URL spec, but it's
// not guaranteed across every mail client, so don't rely on that leniency.
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.blippd.app").trim();

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
 * Returns "sent" if at least one channel delivered, "failed" if a send was
 * genuinely attempted and errored, "skipped" if there was nothing sendable
 * (see SendOutcome in types.ts for why the split matters).
 */
export async function sendAlert(
  userId: string,
  payload: AlertPayload
): Promise<SendOutcome> {
  const channels = await getUserNotificationChannels(userId);
  if (channels.length === 0) return "skipped";

  const results = await Promise.allSettled(
    channels.map((channel): Promise<SendOutcome> => {
      switch (channel) {
        case "email":
          return sendEmailAlert(userId, payload);
        case "web_push":
          // sendPushToUser distinguishes "no subscriptions to try" from
          // "had subscriptions, all failed" -- every user in production has
          // 0 push subscriptions (push has never fired once, per CLAUDE.md),
          // so treating attempted=0 the same as a real failure logged a
          // spurious "failed" web_push row to notification_log for every
          // single email-only user on every single alert this whole time.
          // Only log when there was actually something to attempt.
          return sendPushToUser(userId, alertToPushPayload(payload)).then(async ({ attempted, succeeded }): Promise<SendOutcome> => {
            if (attempted === 0) return "skipped";
            const success = succeeded > 0;
            await logNotification(userId, payload.alertId, "web_push", success ? "sent" : "failed");
            return success ? "sent" : "failed";
          });
        default:
          return Promise.resolve("skipped");
      }
    })
  );

  let anySent = false;
  let anyFailed = false;
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Notification channel failed:", result.reason);
      anyFailed = true;
    } else if (result.value === "sent") {
      anySent = true;
    } else if (result.value === "failed") {
      anyFailed = true;
    }
  }
  if (anySent) return "sent";
  return anyFailed ? "failed" : "skipped";
}

export interface SendToUsersResult {
  /** Users with at least one successful delivery. */
  sent: number;
  /** Users where a send was attempted and errored — retry-worthy. */
  failed: number;
  /** True if the run stopped early on the Resend rate-limit/quota breaker;
   *  users after the stop were never attempted at all. */
  aborted: boolean;
}

/**
 * Sends an alert to multiple users. Used by the notification dispatcher.
 * Checks the shared rate-limit breaker between batches so that once Resend
 * starts rejecting (burst limit or quota), the remaining users are left
 * untouched for the next tick instead of burning through guaranteed
 * failures (2026-08-05 audit C2).
 */
export async function sendAlertToUsers(
  userIds: string[],
  payload: AlertPayload
): Promise<SendToUsersResult> {
  const BATCH_SIZE = 10;
  const result: SendToUsersResult = { sent: 0, failed: 0, aborted: false };

  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    if (isRateLimited()) {
      result.aborted = true;
      break;
    }
    const batch = userIds.slice(i, i + BATCH_SIZE);
    const outcomes = await Promise.allSettled(
      batch.map((userId) => sendAlert(userId, payload))
    );
    for (const outcome of outcomes) {
      if (outcome.status === "rejected") result.failed++;
      else if (outcome.value === "sent") result.sent++;
      else if (outcome.value === "failed") result.failed++;
    }
    // Pause between batches to stay within Resend rate limits
    if (i + BATCH_SIZE < userIds.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return result;
}
