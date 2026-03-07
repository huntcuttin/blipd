import { config } from "dotenv";
config({ path: ".env.local" });
import { runFullCatalogSync, runPriceUpdate } from "../src/lib/nintendo/ingest";

async function main() {
  console.log("=== Blippd Initial Sync ===\n");

  console.log("Step 1: Catalog sync from Nintendo Algolia...");
  const catalogResult = await runFullCatalogSync();
  console.log(`  Result: ${catalogResult.totalFetched} fetched, ${catalogResult.upserted} upserted, ${catalogResult.errors} errors\n`);

  console.log("Step 2: Price update from Nintendo Price API...");
  const priceResult = await runPriceUpdate({ generateAlerts: false });
  console.log(`  Result: ${priceResult.checked} checked, ${priceResult.priceChanges} price changes\n`);

  console.log("=== Initial sync complete ===");
}

main().catch((err) => {
  console.error("Initial sync failed:", err);
  process.exit(1);
});
