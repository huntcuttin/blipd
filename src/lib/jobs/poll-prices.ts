/**
 * Price polling job — wraps the existing runPriceUpdate pipeline.
 *
 * The existing pipeline in lib/nintendo/ingest.ts already:
 * 1. Fetches 500 stalest games by last_price_check
 * 2. Calls Nintendo Price API for current prices
 * 3. Compares old vs new, detects: price drop, all-time low, sale start
 * 4. Updates games table + price_history jsonb
 * 5. Generates alerts with 24h dedup
 *
 * This wrapper adds:
 * - PriceSnapshot writes (if table exists)
 * - Structured logging summary
 * - Error resilience (wraps in try/catch)
 *
 * The cron endpoint at /api/cron/update-prices already calls runPriceUpdate directly.
 * This file exists for documentation and future PriceSnapshot integration.
 */

import { createAdminClient } from "@/lib/nintendo/admin-client";
import { runPriceUpdate, runReleaseStatusUpdate } from "@/lib/nintendo/ingest";

export interface PollResult {
  games_checked: number;
  games_updated: number;
  alerts_triggered: number;
  errors: string[];
  duration_ms: number;
  snapshots_written: number;
}

export async function pollPrices(options?: {
  generateAlerts?: boolean;
  writeSnapshots?: boolean;
}): Promise<PollResult> {
  const start = Date.now();
  const errors: string[] = [];
  let snapshots_written = 0;

  try {
    // Run the existing price update pipeline
    const result = await runPriceUpdate({
      generateAlerts: options?.generateAlerts ?? true,
    });

    // Run release status updates
    await runReleaseStatusUpdate();

    // Write PriceSnapshots if requested and table exists
    if (options?.writeSnapshots) {
      try {
        snapshots_written = await writePriceSnapshots();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`PriceSnapshot write failed: ${msg}`);
        // Non-fatal — don't crash the pipeline
      }
    }

    return {
      games_checked: result.checked,
      games_updated: result.priceChanges,
      alerts_triggered: result.alertsCreated,
      errors,
      duration_ms: Date.now() - start,
      snapshots_written,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`Price poll failed: ${msg}`);
    return {
      games_checked: 0,
      games_updated: 0,
      alerts_triggered: 0,
      errors,
      duration_ms: Date.now() - start,
      snapshots_written: 0,
    };
  }
}

/**
 * Writes PriceSnapshot rows for all games that were just price-checked.
 * Queries games updated in the last 15 minutes and inserts snapshots.
 *
 * Guard: checks if price_snapshots table exists before writing.
 * Guard: skips if price is identical to the most recent snapshot.
 */
async function writePriceSnapshots(): Promise<number> {
  const supabase = createAdminClient();

  // Check if table exists by trying a query
  const { error: tableCheck } = await supabase
    .from("price_snapshots")
    .select("id")
    .limit(0);

  if (tableCheck) {
    // Table doesn't exist — migration not yet applied
    console.log("price_snapshots table not found — skipping snapshot writes");
    return 0;
  }

  // Get recently price-checked games
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: games } = await supabase
    .from("games")
    .select("id, current_price, original_price, discount, is_on_sale")
    .gte("last_price_check", fifteenMinAgo);

  if (!games || games.length === 0) return 0;

  let written = 0;
  for (const game of games) {
    // Check if we already have a snapshot with the same price
    const { data: latest } = await supabase
      .from("price_snapshots")
      .select("price")
      .eq("game_id", game.id)
      .order("captured_at", { ascending: false })
      .limit(1);

    const lastPrice = latest?.[0]?.price;
    if (lastPrice != null && Math.abs(Number(lastPrice) - Number(game.current_price)) < 0.01) {
      continue; // Same price — skip duplicate snapshot
    }

    const { error } = await supabase.from("price_snapshots").insert({
      game_id: game.id,
      price: game.current_price,
      msrp: game.original_price,
      discount_pct: game.discount ?? 0,
      is_on_sale: game.is_on_sale ?? false,
    });

    if (!error) written++;
  }

  return written;
}
