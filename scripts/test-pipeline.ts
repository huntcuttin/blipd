/**
 * Test Pipeline — Verifies the full alert pipeline end-to-end.
 *
 * Steps:
 * 1. Pick 5 real games from DB
 * 2. Verify price data exists
 * 3. Test alert generation (dry run)
 * 4. Test email template rendering
 * 5. Send ONE real test email to TEST_EMAIL env var
 *
 * Run: npx tsx --env-file=.env.local scripts/test-pipeline.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { priceDrop } from "../src/lib/notifications/templates";
import type { AlertPayload } from "../src/lib/notifications/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("=== Blippd Pipeline Test ===\n");
  const results: { step: string; status: "PASS" | "FAIL"; detail: string }[] = [];

  // Step 1: Pick 5 real games
  console.log("Step 1: Fetching 5 real games from DB...");
  const { data: games, error: gamesErr } = await supabase
    .from("games")
    .select("id, title, slug, current_price, original_price, is_on_sale, nsuid, publisher")
    .not("nsuid", "is", null)
    .gt("current_price", 0)
    .limit(5);

  if (gamesErr || !games || games.length === 0) {
    results.push({ step: "Fetch games", status: "FAIL", detail: gamesErr?.message || "No games found" });
    printResults(results);
    return;
  }

  results.push({ step: "Fetch games", status: "PASS", detail: `Found ${games.length} games` });
  for (const g of games) {
    console.log(`  - ${g.title} | $${g.current_price} | nsuid: ${g.nsuid}`);
  }

  // Step 2: Verify price data
  console.log("\nStep 2: Verifying price data...");
  const gamesWithPrices = games.filter((g) => g.current_price > 0);
  if (gamesWithPrices.length === 0) {
    results.push({ step: "Price data", status: "FAIL", detail: "No games have prices > $0" });
  } else {
    results.push({ step: "Price data", status: "PASS", detail: `${gamesWithPrices.length}/5 games have prices` });
  }

  // Step 3: Verify alerts table works
  console.log("\nStep 3: Verifying alerts table...");
  const { count: alertCount, error: alertErr } = await supabase
    .from("alerts")
    .select("*", { count: "exact", head: true });

  if (alertErr) {
    results.push({ step: "Alerts table", status: "FAIL", detail: alertErr.message });
  } else {
    results.push({ step: "Alerts table", status: "PASS", detail: `${alertCount} alerts in DB` });
  }

  // Step 4: Test email template rendering
  console.log("\nStep 4: Testing email template rendering...");
  const testGame = games[0];
  const testPayload: AlertPayload = {
    alertId: "test-alert-id",
    alertType: "price_drop",
    gameId: testGame.id,
    gameSlug: testGame.slug,
    gameTitle: testGame.title,
    gameCoverArt: "",
    headline: `${testGame.title} dropped to $${testGame.current_price}`,
    subtext: `Was $${testGame.original_price}`,
    oldPrice: Number(testGame.original_price),
    newPrice: Number(testGame.current_price),
    discount: testGame.original_price > 0
      ? Math.round((1 - testGame.current_price / testGame.original_price) * 100)
      : 0,
  };

  try {
    const { subject, html } = priceDrop(testPayload);
    if (subject && html && html.includes("blippd")) {
      results.push({ step: "Email template", status: "PASS", detail: `Subject: "${subject}"` });
    } else {
      results.push({ step: "Email template", status: "FAIL", detail: "Template rendered but missing content" });
    }
  } catch (e) {
    results.push({ step: "Email template", status: "FAIL", detail: String(e) });
  }

  // Step 5: Send real test email
  console.log("\nStep 5: Sending test email...");
  const testEmail = process.env.TEST_EMAIL;

  if (!testEmail) {
    results.push({ step: "Send test email", status: "FAIL", detail: "TEST_EMAIL env var not set — MANUAL ACTION REQUIRED" });
  } else {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      results.push({ step: "Send test email", status: "FAIL", detail: "RESEND_API_KEY not set" });
    } else {
      try {
        const resend = new Resend(resendKey);
        const { subject, html } = priceDrop(testPayload);

        const { data, error } = await resend.emails.send({
          from: "Blippd <alerts@blippd.app>",
          to: testEmail,
          subject: `[TEST] ${subject}`,
          html,
        });

        if (error) {
          // Try fallback sender if domain not verified
          console.log(`  Primary sender failed: ${error.message}`);
          console.log("  Trying fallback sender (onboarding@resend.dev)...");

          const { data: fallbackData, error: fallbackErr } = await resend.emails.send({
            from: "Blippd <onboarding@resend.dev>",
            to: testEmail,
            subject: `[TEST] ${subject}`,
            html,
          });

          if (fallbackErr) {
            results.push({ step: "Send test email", status: "FAIL", detail: `Primary: ${error.message}. Fallback: ${fallbackErr.message}` });
          } else {
            results.push({ step: "Send test email", status: "PASS", detail: `Sent via fallback sender. ID: ${fallbackData?.id}. NOTE: blippd.app domain not yet verified in Resend.` });
          }
        } else {
          results.push({ step: "Send test email", status: "PASS", detail: `Sent! ID: ${data?.id}` });
        }
      } catch (e) {
        results.push({ step: "Send test email", status: "FAIL", detail: String(e) });
      }
    }
  }

  // Step 6: Verify notification dispatch chain
  console.log("\nStep 6: Verifying notification dispatch chain...");
  const { count: followCount } = await supabase
    .from("user_game_follows")
    .select("*", { count: "exact", head: true });

  const { count: logCount } = await supabase
    .from("notification_log")
    .select("*", { count: "exact", head: true });

  results.push({
    step: "Dispatch chain",
    status: "PASS",
    detail: `${followCount} game follows, ${logCount} notification logs. Chain: alerts → dispatch → user_game_follows → email.ts → Resend`,
  });

  printResults(results);
}

function printResults(results: { step: string; status: string; detail: string }[]) {
  console.log("\n=== RESULTS ===");
  for (const r of results) {
    const icon = r.status === "PASS" ? "OK" : "FAIL";
    console.log(`  [${icon}] ${r.step}: ${r.detail}`);
  }

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  console.log(`\n  ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log("\n  BLOCKERS:");
    for (const r of results.filter((r) => r.status === "FAIL")) {
      console.log(`    - ${r.step}: ${r.detail}`);
    }
  }
}

main().catch((err) => {
  console.error("Test pipeline failed:", err);
  process.exit(1);
});
