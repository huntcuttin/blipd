import webpush from "web-push";
import { createAdminClient } from "@/lib/nintendo/admin-client";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  const supabase = createAdminClient();
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs || subs.length === 0) return 0;

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 24 } // 24h TTL
      ).catch(async (err) => {
        // 410 = subscription expired/unsubscribed — clean it up
        if (err.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
        throw err as Error;
      })
    ) as Promise<unknown>[]
  );

  return results.filter((r) => r.status === "fulfilled").length;
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  const results = await Promise.allSettled(
    userIds.map((id) => sendPushToUser(id, payload))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<number> => r.status === "fulfilled")
    .reduce((sum, r) => sum + r.value, 0);
}
