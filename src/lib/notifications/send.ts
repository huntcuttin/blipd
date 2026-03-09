import { getUserNotificationChannels } from "./channels";
import { sendEmailAlert } from "./email";
import type { AlertPayload } from "./types";

/**
 * Sends an alert to a user across all their enabled notification channels.
 * Currently only email is implemented. Adding a new channel (web_push, expo_push)
 * requires only adding a handler here — no restructuring needed.
 */
export async function sendAlert(
  userId: string,
  payload: AlertPayload
): Promise<void> {
  const channels = await getUserNotificationChannels(userId);

  const results = await Promise.allSettled(
    channels.map((channel) => {
      switch (channel) {
        case "email":
          return sendEmailAlert(userId, payload);
        // Future channels:
        // case "web_push":
        //   return sendWebPushAlert(userId, payload);
        // case "expo_push":
        //   return sendExpoPushAlert(userId, payload);
        default:
          return Promise.resolve(false);
      }
    })
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Notification channel failed:", result.reason);
    }
  }
}

/**
 * Sends an alert to multiple users. Used by the alert generation pipeline
 * after creating an alert and resolving its affected users.
 * Processes in batches of 5 to respect Resend rate limits.
 */
export async function sendAlertToUsers(
  userIds: string[],
  payload: AlertPayload
): Promise<void> {
  const BATCH_SIZE = 5;
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map((userId) => sendAlert(userId, payload))
    );
  }
}
