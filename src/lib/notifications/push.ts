import webpush from "web-push";
import { createAdminClient } from "@/lib/nintendo/admin-client";

let vapidInitialized = false;
function ensureVapid() {
  if (vapidInitialized) return;
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  vapidInitialized = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

export interface PushResult {
  /** How many subscriptions existed to try. 0 means "nothing to attempt", not a failure. */
  attempted: number;
  succeeded: number;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushResult> {
  ensureVapid();
  const supabase = createAdminClient();
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs || subs.length === 0) return { attempted: 0, succeeded: 0 };

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

  return {
    attempted: subs.length,
    succeeded: results.filter((r) => r.status === "fulfilled").length,
  };
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  const results = await Promise.allSettled(
    userIds.map((id) => sendPushToUser(id, payload))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<PushResult> => r.status === "fulfilled")
    .reduce((sum, r) => sum + r.value.succeeded, 0);
}
