import { Resend } from "resend";

/**
 * One-off admin notification for pipeline-level events that need a human's
 * attention but aren't a per-user alert (e.g. the out_now event-creation
 * breaker tripping). Fire-and-forget: a failure here is logged, never
 * thrown -- this must never be the reason a cron job's actual work fails.
 */
export async function sendAdminAlert(subject: string, body: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!key || !adminEmail) {
    console.error(`Admin alert (RESEND_API_KEY/ADMIN_EMAIL not configured): ${subject}\n${body}`);
    return;
  }
  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: "Blippd <alerts@blippd.app>",
      to: adminEmail,
      subject,
      text: body,
    });
    if (error) console.error("Failed to send admin alert email:", error.message);
  } catch (e) {
    console.error("Failed to send admin alert email:", e instanceof Error ? e.message : e);
  }
}
