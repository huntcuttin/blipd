import { Resend } from "resend";
import { createAdminClient } from "@/lib/nintendo/admin-client";
import { getTemplate } from "./templates";
import type { AlertPayload } from "./types";

const FROM_ADDRESS = "Blippd <alerts@blippd.app>";

let resendClient: Resend | null = null;
function getResend(): Resend {
  if (resendClient) return resendClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Missing RESEND_API_KEY");
  resendClient = new Resend(key);
  return resendClient;
}

async function getUserEmail(userId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

/**
 * Shared across every Resend send site (email.ts, send-batch.ts,
 * weekly-digest) so a hard-bounced/complained address can never keep
 * receiving mail regardless of which code path is sending — see
 * CLAUDE.md's Slickdeals silent-bounce cautionary tale. A lookup error
 * fails OPEN (treated as not-suppressed): a transient DB hiccup must
 * never be the reason a real alert doesn't go out, the same "fail open
 * toward users" principle used throughout the alert pipeline. Genuine
 * suppression only ever comes from a real Resend bounce/complaint event.
 */
export async function isEmailSuppressed(email: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("email_suppressions")
      .select("email")
      .eq("email", email)
      .eq("suppressed", true)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

export async function logNotification(
  userId: string,
  alertId: string,
  channel: string,
  status: "sent" | "failed",
  error?: string
) {
  try {
    const supabase = createAdminClient();
    await supabase.from("notification_log").insert({
      user_id: userId,
      alert_id: alertId,
      channel,
      status,
      error: error ?? null,
    });
  } catch (e) {
    // Don't let logging failures break the pipeline
    console.error("Failed to log notification:", e);
  }
}

export async function sendEmailAlert(
  userId: string,
  payload: AlertPayload
): Promise<boolean> {
  const template = getTemplate(payload.alertType);
  if (!template) {
    console.warn(`No email template for alert type: ${payload.alertType}`);
    return false;
  }

  // 24h dedup: check if we already sent this alert type for this game to this user
  try {
    const supabase = createAdminClient();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentLogs } = await supabase
      .from("notification_log")
      .select("id")
      .eq("user_id", userId)
      .eq("alert_id", payload.alertId)
      .eq("status", "sent")
      .gte("created_at", twentyFourHoursAgo)
      .limit(1);

    if (recentLogs && recentLogs.length > 0) {
      console.log(`  Skipping duplicate email for alert ${payload.alertId} to user ${userId}`);
      return false;
    }
  } catch {
    // Non-fatal — proceed with sending
  }

  const email = await getUserEmail(userId);
  if (!email) {
    console.warn(`No email found for user ${userId}`);
    await logNotification(userId, payload.alertId, "email", "failed", "No email address");
    return false;
  }

  if (await isEmailSuppressed(email)) {
    console.log(`  Skipping suppressed email ${email}`);
    await logNotification(userId, payload.alertId, "email", "failed", "Suppressed (bounce/complaint)");
    return false;
  }

  const { subject, html } = template(payload);

  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: email,
      subject,
      html,
    });
    if (error) {
      console.error(`Failed to send email to ${email}:`, error.message);
      await logNotification(userId, payload.alertId, "email", "failed", error.message);
      return false;
    }
    await logNotification(userId, payload.alertId, "email", "sent");
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error(`Failed to send email to ${email}:`, msg);
    await logNotification(userId, payload.alertId, "email", "failed", msg);
    return false;
  }
}
