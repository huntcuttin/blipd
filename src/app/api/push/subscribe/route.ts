import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/nintendo/admin-client";

export const maxDuration = 30;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const supabase = createAdminClient();

  // Verify the JWT and get the user
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let subscription: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    subscription = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  // An endpoint already registered to a DIFFERENT user usually means the
  // same browser switched accounts (endpoints are per browser profile +
  // origin) — but the old blind onConflict upsert reassigned ownership
  // with zero trace, which is also exactly what an endpoint hijack would
  // look like (audit #10, never actually fixed until 2026-08-05). Make the
  // handoff explicit: delete the old owner's row, insert the new one, log
  // the transfer so a hijack pattern would at least be visible in logs.
  const { data: existing } = await supabase
    .from("push_subscriptions")
    .select("user_id")
    .eq("endpoint", subscription.endpoint)
    .maybeSingle();
  if (existing && existing.user_id !== user.id) {
    console.warn(`Push endpoint ownership transfer: ${existing.user_id} -> ${user.id} (same-device account switch, or investigate if frequent)`);
    await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
  }

  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  }, { onConflict: "endpoint" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const supabase = createAdminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let endpoint: string | undefined;
  try {
    ({ endpoint } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
