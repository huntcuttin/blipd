import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { createAdminClient } from "@/lib/nintendo/admin-client";

export const runtime = "nodejs";

const SOFT_BOUNCE_SUPPRESS_THRESHOLD = 3;

interface ResendBounceData {
  to: string[];
  bounce?: { type?: string; subType?: string; message?: string };
}

interface ResendComplaintData {
  to: string[];
}

interface ResendWebhookEvent {
  type: string;
  data: ResendBounceData | ResendComplaintData;
}

async function upsertSuppression(
  supabase: ReturnType<typeof createAdminClient>,
  email: string,
  reason: string,
  suppress: boolean
) {
  const { data: existing } = await supabase
    .from("email_suppressions")
    .select("bounce_count")
    .eq("email", email)
    .maybeSingle();

  const bounceCount = (existing?.bounce_count ?? 0) + 1;

  await supabase.from("email_suppressions").upsert({
    email,
    reason,
    bounce_count: bounceCount,
    suppressed: suppress || bounceCount >= SOFT_BOUNCE_SUPPRESS_THRESHOLD,
    last_event_at: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("RESEND_WEBHOOK_SECRET not configured — rejecting webhook");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  // Signature verification needs the raw body, not a parsed one.
  const payload = await request.text();
  const svixHeaders = {
    "svix-id": request.headers.get("svix-id") ?? "",
    "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
    "svix-signature": request.headers.get("svix-signature") ?? "",
  };

  let event: ResendWebhookEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(payload, svixHeaders) as ResendWebhookEvent;
  } catch (err) {
    console.error("Resend webhook signature verification failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    switch (event.type) {
      case "email.bounced": {
        const data = event.data as ResendBounceData;
        const bounceType = data.bounce?.type; // "Permanent" | "Transient" | "Undetermined"
        for (const email of data.to ?? []) {
          if (bounceType === "Permanent") {
            await upsertSuppression(supabase, email, "hard_bounce", true);
          } else {
            // Transient/Undetermined — count toward the 3-strike soft-bounce limit
            await upsertSuppression(supabase, email, "soft_bounce_limit", false);
          }
        }
        break;
      }
      case "email.complained": {
        const data = event.data as ResendComplaintData;
        for (const email of data.to ?? []) {
          await upsertSuppression(supabase, email, "complaint", true);
        }
        break;
      }
      // email.delivery_delayed: Resend auto-retries these — no action needed
      // unless it eventually escalates to email.bounced.
      default:
        break;
    }
  } catch (err) {
    console.error(`Failed to process Resend webhook event "${event.type}":`, err);
    // Still return 200 — Resend will retry on non-2xx, and a DB hiccup here
    // shouldn't cause repeated redelivery storms for the same event.
  }

  return NextResponse.json({ ok: true });
}
