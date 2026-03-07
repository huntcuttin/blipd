import { Resend } from "resend";
import { createAdminClient } from "@/lib/nintendo/admin-client";
import { getTemplate } from "./templates";
import type { AlertPayload } from "./types";

const FROM_ADDRESS = "Blipd <alerts@blipd.app>";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Missing RESEND_API_KEY");
  return new Resend(key);
}

async function getUserEmail(userId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

async function logNotification(
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

  const email = await getUserEmail(userId);
  if (!email) {
    console.warn(`No email found for user ${userId}`);
    await logNotification(userId, payload.alertId, "email", "failed", "No email address");
    return false;
  }

  const { subject, html } = template(payload);

  try {
    const resend = getResend();
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: email,
      subject,
      html,
    });
    await logNotification(userId, payload.alertId, "email", "sent");
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error(`Failed to send email to ${email}:`, msg);
    await logNotification(userId, payload.alertId, "email", "failed", msg);
    return false;
  }
}
