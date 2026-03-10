import type { NotificationChannel } from "./types";

/**
 * Returns the notification channels enabled for a user.
 * Currently all users get email. Expand this to check user preferences
 * or a notification_settings table when adding push channels.
 */
export async function getUserNotificationChannels(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userId: string
): Promise<NotificationChannel[]> {
  // Future: query user notification preferences from DB
  // e.g. const { data } = await supabase.from('user_notification_settings').select('channels').eq('user_id', userId)
  return ["email", "web_push"];
}
