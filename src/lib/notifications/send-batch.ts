import { Resend } from "resend";
import { createAdminClient } from "@/lib/nintendo/admin-client";
import { batchedAlerts } from "./batch-template";
import { namedSaleEvent } from "./templates";
import type { BatchAlertGame } from "./batch-template";

const FROM_ADDRESS = "Blippd <alerts@blippd.app>";

let resendClient: Resend | null = null;
function getResend(): Resend {
  if (resendClient) return resendClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Missing RESEND_API_KEY");
  resendClient = new Resend(key);
  return resendClient;
}

/**
 * Sends a single batched digest email for multiple price-related alerts.
 * Used when 5+ alerts hit the same user in one dispatch window.
 * Logs notification for each alert ID so dedup still works.
 */
export async function sendBatchedDigest(
  userId: string,
  games: BatchAlertGame[],
  alertIds: string[]
): Promise<boolean> {
  const supabase = createAdminClient();

  // Get user email
  const { data: userData } = await supabase.auth.admin.getUserById(userId);
  const email = userData?.user?.email;
  if (!email) {
    console.warn(`No email found for user ${userId}`);
    return false;
  }

  const { subject, html } = batchedAlerts(games);

  try {
    const resend = getResend();
    await resend.emails.send({ from: FROM_ADDRESS, to: email, subject, html });

    // Log notification for each alert so dedup prevents re-sends
    const logRows = alertIds.map((alertId) => ({
      user_id: userId,
      alert_id: alertId,
      channel: "email",
      status: "sent",
      error: null,
    }));
    await supabase.from("notification_log").insert(logRows);

    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error(`Failed to send batched digest to ${email}:`, msg);

    // Log failure for each alert
    const logRows = alertIds.map((alertId) => ({
      user_id: userId,
      alert_id: alertId,
      channel: "email",
      status: "failed",
      error: msg,
    }));
    await supabase.from("notification_log").insert(logRows);

    return false;
  }
}

/**
 * Sends a named sale event Tier 1 blast — one email per user about the sale event.
 * Does not require an alert_id. Dedup is handled by named_sale_events.detected_at.
 */
export async function sendNamedSaleEventEmail(
  userIds: string[],
  eventName: string,
  totalGames: number,
  saleEndDate: string | null
): Promise<number> {
  const supabase = createAdminClient();
  const { subject, html } = namedSaleEvent(eventName, totalGames, saleEndDate);
  let sent = 0;

  for (let i = 0; i < userIds.length; i += 3) {
    const batch = userIds.slice(i, i + 3);
    await Promise.all(
      batch.map(async (userId) => {
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        const email = userData?.user?.email;
        if (!email) return;
        try {
          const resend = getResend();
          await resend.emails.send({ from: FROM_ADDRESS, to: email, subject, html });
          sent++;
        } catch (e) {
          console.error(`Failed to send named sale email to ${email}:`, e instanceof Error ? e.message : e);
        }
      })
    );
    if (i + 3 < userIds.length) await new Promise((r) => setTimeout(r, 1100));
  }

  console.log(`  Named sale event email: ${sent}/${userIds.length} sent`);
  return sent;
}
