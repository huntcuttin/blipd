/**
 * End-to-end alert pipeline test.
 * 1. Finds your user account + a game you follow
 * 2. Inserts a fake price_drop alert for that game
 * 3. Hits the dispatch cron endpoint
 * 4. Confirms the email was logged as sent in notification_log
 *
 * Run: node scripts/test-alert-pipeline.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const APP_URL = "https://www.blippd.app";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !CRON_SECRET) {
  console.error("❌ Missing env vars. Check .env.local.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function log(msg) { console.log(msg); }
function ok(msg)  { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.log(`  ❌ ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); }

// ─── Step 1: Find a real user with follows ───────────────────────────────────
log("\n[1/5] Finding a user with followed games...");

const { data: followRows, error: followErr } = await supabase
  .from("user_game_follows")
  .select("user_id, game_id")
  .limit(1);

if (followErr || !followRows?.length) {
  fail("No follows found in user_game_follows. Follow a game first, then re-run.");
  process.exit(1);
}

const { user_id: userId, game_id: gameId } = followRows[0];
ok(`Found follow: user ${userId.slice(0, 8)}… → game ${gameId.slice(0, 8)}…`);

// ─── Step 2: Get the game details ────────────────────────────────────────────
log("\n[2/5] Fetching game details...");

const { data: game, error: gameErr } = await supabase
  .from("games")
  .select("id, title, slug, nsuid, current_price, original_price")
  .eq("id", gameId)
  .single();

if (gameErr || !game) {
  fail(`Game not found: ${gameErr?.message}`);
  process.exit(1);
}

ok(`Game: "${game.title}" — current price $${game.current_price ?? "?"}`);

// ─── Step 3: Get user email ───────────────────────────────────────────────────
log("\n[3/5] Verifying user email...");

const { data: userData } = await supabase.auth.admin.getUserById(userId);
const email = userData?.user?.email;
if (!email) {
  fail("No email found for this user. Cannot send alert.");
  process.exit(1);
}
ok(`Email: ${email}`);

// ─── Step 4: Insert a fake price_drop alert ──────────────────────────────────
log("\n[4/5] Inserting test price_drop alert...");

const fakeOldPrice = (game.current_price ?? 59.99) + 20;
const fakeNewPrice = game.current_price ?? 39.99;
const discount = Math.round(((fakeOldPrice - fakeNewPrice) / fakeOldPrice) * 100);

const { data: alert, error: alertErr } = await supabase
  .from("alerts")
  .insert({
    game_id: gameId,
    type: "price_drop",
    headline: `"${game.title}" dropped ${discount}% — TEST ALERT`,
    subtext: `Was $${fakeOldPrice.toFixed(2)}, now $${fakeNewPrice.toFixed(2)}`,
    new_price: fakeNewPrice,
    old_price: fakeOldPrice,
    discount,
  })
  .select("id")
  .single();

if (alertErr || !alert) {
  fail(`Failed to insert alert: ${alertErr?.message}`);
  process.exit(1);
}

ok(`Alert inserted: ${alert.id}`);

// ─── Step 5: Hit dispatch endpoint ───────────────────────────────────────────
log("\n[5/5] Calling dispatch-notifications cron...");

const dispatchRes = await fetch(`${APP_URL}/api/cron/dispatch-notifications`, {
  headers: { Authorization: `Bearer ${CRON_SECRET}` },
});
const dispatchBody = await dispatchRes.json();

if (!dispatchRes.ok || !dispatchBody.ok) {
  fail(`Dispatch returned ${dispatchRes.status}: ${JSON.stringify(dispatchBody)}`);
  process.exit(1);
}

ok(`Dispatch ran — sent: ${dispatchBody.dispatched ?? 0}`);

// ─── Verify: Check notification_log ──────────────────────────────────────────
log("\n[verify] Checking notification_log...");

await new Promise((r) => setTimeout(r, 2000)); // Give it a moment

const { data: logRow } = await supabase
  .from("notification_log")
  .select("status, error, created_at")
  .eq("alert_id", alert.id)
  .eq("user_id", userId)
  .single();

if (!logRow) {
  warn("No log entry found — dispatch may have skipped (dedup, no follower match, or batching).");
  warn("Check Resend dashboard and Vercel logs for more detail.");
} else if (logRow.status === "sent") {
  ok(`Email logged as SENT to ${email} at ${logRow.created_at}`);
  log("\n🎉 Pipeline confirmed working. Check your inbox.");
} else {
  fail(`Email logged as ${logRow.status.toUpperCase()} — error: ${logRow.error}`);
}

// ─── Cleanup: Remove the test alert ─────────────────────────────────────────
await supabase.from("alerts").delete().eq("id", alert.id);
await supabase.from("notification_log").delete().eq("alert_id", alert.id);
log("\n[cleanup] Test alert removed from DB.");
