/**
 * Seed the game catalog from Nintendo eShop data.
 *
 * Uses the existing Algolia-based pipeline (more robust than nintendo-switch-eshop npm)
 * to fetch the full catalog. The guard clause exits early if 400+ games already exist.
 *
 * Decision: We use Algolia because:
 * 1. It returns 4750+ games with rich metadata (publisher, franchise, cover art)
 * 2. The nintendo-switch-eshop npm package is community-maintained and often returns
 *    incomplete data or fails silently
 * 3. Our existing pipeline already handles deduplication, quality gating, and Switch 2 linking
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-catalog.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { runFullCatalogSync } from "../src/lib/nintendo/ingest";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Guard: if already seeded, exit
  const { count } = await supabase
    .from("games")
    .select("*", { count: "exact", head: true });

  if (count && count >= 400) {
    console.log(`Game table already has ${count} rows. Already seeded — exiting.`);
    return;
  }

  console.log("=== Blippd Catalog Seed ===\n");
  console.log("Fetching games from Nintendo Algolia API...");

  const result = await runFullCatalogSync();

  console.log(`\nSeed complete:`);
  console.log(`  Total fetched from API: ${result.totalFetched}`);
  console.log(`  Upserted to DB: ${result.upserted}`);
  console.log(`  Errors: ${result.errors}`);

  // Log final count
  const { count: finalCount } = await supabase
    .from("games")
    .select("*", { count: "exact", head: true });
  console.log(`  Games in DB: ${finalCount}`);

  // Log nsuid coverage
  const { count: nsuidCount } = await supabase
    .from("games")
    .select("*", { count: "exact", head: true })
    .not("nsuid", "is", null);
  console.log(`  Games with nsuid: ${nsuidCount}`);

  // Log games without nsuid (skipped for price polling)
  const skipped = (finalCount ?? 0) - (nsuidCount ?? 0);
  if (skipped > 0) {
    console.log(`  Games without nsuid (skipped for price polling): ${skipped}`);
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
