import { Resend } from "resend";
import { createAdminClient } from "@/lib/nintendo/admin-client";
import { batchedAlerts } from "./batch-template";
import { launchDigest } from "./launch-digest-template";
import { namedSaleEvent } from "./templates";
import type { BatchAlertGame } from "./batch-template";
import type { LaunchDigestGame } from "./launch-digest-template";

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
 * Sends one rendered digest email and logs a notification_log row per covered
 * alert, so dedup on the next dispatch pass sees every alert as delivered.
 * Shared by the price and launch digests — they differ only in their template.
 */
async function sendDigest(
  userId: string,
  alertIds: string[],
  rendered: { subject: string; html: string },
  label: string
): Promise<boolean> {
  const supabase = createAdminClient();

  const { data: userData } = await supabase.auth.admin.getUserById(userId);
  const email = userData?.user?.email;
  if (!email) {
    console.warn(`No email found for user ${userId}`);
    return false;
  }

  const logRows = (status: "sent" | "failed", error: string | null) =>
    alertIds.map((alertId) => ({
      user_id: userId,
      alert_id: alertId,
      channel: "email",
      status,
      error,
    }));

  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: email,
      subject: rendered.subject,
      html: rendered.html,
    });
    if (error) throw new Error(error.message);

    await supabase.from("notification_log").insert(logRows("sent", null));
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error(`Failed to send ${label} digest to ${email}:`, msg);
    await supabase.from("notification_log").insert(logRows("failed", msg));
    return false;
  }
}

/**
 * Sends a single batched digest email for multiple price-related alerts.
 * Used when 5+ price alerts hit the same user in one dispatch window.
 */
export async function sendBatchedDigest(
  userId: string,
  games: BatchAlertGame[],
  alertIds: string[]
): Promise<boolean> {
  return sendDigest(userId, alertIds, batchedAlerts(games), "price");
}

/**
 * Sends a single grouped email for several games that went live in the same
 * dispatch window — the launch-side equivalent of sendBatchedDigest. Without
 * this, a multi-release day sent one email per game per follower.
 */
export async function sendLaunchDigest(
  userId: string,
  games: LaunchDigestGame[],
  alertIds: string[]
): Promise<boolean> {
  return sendDigest(userId, alertIds, launchDigest(games), "launch");
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
          const { error } = await resend.emails.send({ from: FROM_ADDRESS, to: email, subject, html });
          if (error) throw new Error(error.message);
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
