import { Resend } from "resend";
import { createAdminClient } from "@/lib/nintendo/admin-client";
import { batchedAlerts } from "./batch-template";
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
