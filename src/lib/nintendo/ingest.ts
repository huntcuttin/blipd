import { createAdminClient } from "./admin-client";
import { fetchAllGames, fetchPrices } from "./client";
import { algoliaHitToGameRow, computeDiscount, isAllTimeLow, isEnglishGame, isStandaloneGame } from "./transform";
import {
  generatePriceDropAlert,
  generateAllTimeLowAlert,
  generateSaleStartedAlert,
  generateReleaseAlert,
} from "./alerts";
import type { AlgoliaHit } from "./types";

const QUALITY_PUBLISHERS = new Set([
  "Nintendo",
  "CAPCOM",
  "Capcom",
  "SEGA",
  "Sega",
  "Square Enix",
  "SQUARE ENIX",
  "Bandai Namco Entertainment",
  "BANDAI NAMCO Entertainment",
  "BANDAI NAMCO Entertainment Inc.",
  "Ubisoft",
  "Konami",
  "KONAMI",
  "Konami Digital Entertainment",
  "Atlus",
  "ATLUS",
  "KOEI TECMO",
  "Koei Tecmo",
  "KOEI TECMO GAMES",
  "NIS America",
  "NIS America, Inc.",
  "XSEED Games",
  "Marvelous",
  "Marvelous (XSEED Games)",
  "505 Games",
  "Devolver Digital",
  "Team17",
  "Annapurna Interactive",
  "Warner Bros. Interactive Entertainment",
  "Warner Bros. Games",
  "Electronic Arts",
  "EA",
  "2K",
  "2K Games",
  "Take-Two Interactive",
  "Bethesda",
  "Bethesda Softworks",
  "Microsoft",
  "Xbox Game Studios",
  "Dotemu",
  "Limited Run Games",
  "Nacon",
  "THQ Nordic",
  "Deep Silver",
  "Koch Media",
  "Plaion",
  "Arc System Works",
  "Spike Chunsoft",
  "SPIKE CHUNSOFT",
  "Spike Chunsoft, Inc.",
  "Compile Heart",
  "Idea Factory",
  "Idea Factory International",
  "PlatinumGames",
  "Platinum Games Inc.",
  "ConcernedApe",
  "Supergiant Games",
  "Innersloth",
  "Mojang",
  "Mojang Studios",
  "Re-Logic",
  "Chucklefish",
  "Yacht Club Games",
  "Motion Twin",
  "Team Cherry",
  "Moon Studios",
  "Larian Studios",
  "Coffee Stain Studios",
  "Behaviour Interactive",
  "WayForward",
  "SNK",
  "SNK CORPORATION",
  "Hori",
  "LEVEL-5",
  "Level-5",
  "Level-5 Inc.",
  "Nippon Ichi Software",
  "Nihon Falcom",
  "Falcom",
  "Grasshopper Manufacture",
  "Aksys Games",
  "ININ Games",
  "Microids",
  "Merge Games",
  "Raw Fury",
  "Thunderful",
  "Finji",
  "Fellow Traveller",
  "Dangen Entertainment",
  "Playism",
  "PLAYISM",
  "Humble Games",
  "Chorus Worldwide",
  "PM Studios",
  "Graffiti Games",
  "Dear Villagers",
  "HandyGames",
  "Gameloft",
  "Activision",
  "Activision Blizzard",
  "Blizzard Entertainment",
  "Riot Games",
  "Panic",
  "Cygames",
  "miHoYo",
  "HoYoverse",
  "NetEase",
  "Tencent",
  "Focus Entertainment",
  "Focus Home Interactive",
  "Curve Games",
  "Curve Digital",
]);

function isQualityGame(hit: AlgoliaHit): boolean {
  // Must have a cover image
  if (!hit.productImage && !hit.productImageSquare) return false;

  // Check publisher allowlist (case-sensitive match against the set)
  const pub = hit.softwarePublisher || "";
  if (QUALITY_PUBLISHERS.has(pub)) return true;

  // Also allow any game priced $30+ (likely a real release, not shovelware)
  if (hit.msrp >= 30) return true;

  return false;
}

interface SyncResult {
  totalFetched: number;
  upserted: number;
  errors: number;
}

interface PriceUpdateResult {
  checked: number;
  priceChanges: number;
  alertsCreated: number;
}

export async function runFullCatalogSync(): Promise<SyncResult> {
  const supabase = createAdminClient();
  let errors = 0;
  let upserted = 0;

  console.log("Starting full catalog sync...");

  const hits = await fetchAllGames((page, total) => {
    console.log(`  Fetched page ${page}/${total}`);
  });

  console.log(`  Total games fetched: ${hits.length}`);

  // Filter to English, standalone, quality games before transforming
  const englishHits = hits.filter(isEnglishGame);
  console.log(`  English games: ${englishHits.length} (filtered out ${hits.length - englishHits.length} non-English)`);
  const standaloneHits = englishHits.filter(isStandaloneGame);
  console.log(`  Standalone games: ${standaloneHits.length} (filtered out ${englishHits.length - standaloneHits.length} DLC/bundles/tools)`);
  const qualityHits = standaloneHits.filter(isQualityGame);
  console.log(`  Quality games after filtering: ${qualityHits.length} (filtered out ${standaloneHits.length - qualityHits.length})`);

  // Transform and deduplicate slugs
  const rows = qualityHits.map(algoliaHitToGameRow);
  const slugCounts = new Map<string, number>();
  for (const row of rows) {
    const count = slugCounts.get(row.slug) ?? 0;
    slugCounts.set(row.slug, count + 1);
    if (count > 0) {
      row.slug = row.nsuid ? `${row.slug}-${row.nsuid}` : `${row.slug}-${count + 1}`;
    }
  }

  // Upsert in batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    // Split into rows with and without NSUIDs
    const withNsuid = batch.filter((r) => r.nsuid);
    const withoutNsuid = batch.filter((r) => !r.nsuid);

    if (withNsuid.length > 0) {
      const { error } = await supabase
        .from("games")
        .upsert(withNsuid, { onConflict: "nsuid", ignoreDuplicates: false });
      if (error) {
        console.error(`  Batch error (nsuid) at index ${i}:`, error.message);
        errors++;
      } else {
        upserted += withNsuid.length;
      }
    }

    if (withoutNsuid.length > 0) {
      const { error } = await supabase
        .from("games")
        .upsert(withoutNsuid, { onConflict: "slug", ignoreDuplicates: false });
      if (error) {
        console.error(`  Batch error (slug) at index ${i}:`, error.message);
        errors++;
      } else {
        upserted += withoutNsuid.length;
      }
    }
  }

  // Rebuild franchises
  console.log("Rebuilding franchises...");
  const { data: franchiseData } = await supabase
    .from("games")
    .select("franchise")
    .not("franchise", "is", null);

  if (franchiseData) {
    const franchiseCounts = new Map<string, number>();
    for (const row of franchiseData) {
      const name = row.franchise as string;
      franchiseCounts.set(name, (franchiseCounts.get(name) ?? 0) + 1);
    }

    const franchiseRows = Array.from(franchiseCounts.entries()).map(([name, count]) => ({
      name,
      game_count: count,
      logo: "",
    }));

    if (franchiseRows.length > 0) {
      const { error } = await supabase
        .from("franchises")
        .upsert(franchiseRows, { onConflict: "name", ignoreDuplicates: false });
      if (error) {
        console.error("  Franchise upsert error:", error.message);
      } else {
        console.log(`  Upserted ${franchiseRows.length} franchises`);
      }
    }
  }

  console.log(`Catalog sync complete: ${upserted} upserted, ${errors} errors`);
  return { totalFetched: hits.length, upserted, errors };
}

export async function runPriceUpdate(options?: {
  generateAlerts?: boolean;
}): Promise<PriceUpdateResult> {
  const supabase = createAdminClient();
  const shouldAlert = options?.generateAlerts ?? true;
  let priceChanges = 0;
  let alertsCreated = 0;

  console.log("Starting price update...");

  // Get games that need price checking, ordered by stalest first
  const { data: games, error } = await supabase
    .from("games")
    .select("id, title, nsuid, current_price, original_price, is_on_sale, price_history")
    .not("nsuid", "is", null)
    .order("last_price_check", { ascending: true, nullsFirst: true })
    .limit(500);

  if (error || !games) {
    console.error("Failed to fetch games for price check:", error?.message);
    return { checked: 0, priceChanges: 0, alertsCreated: 0 };
  }

  const nsuids = games.map((g) => g.nsuid as string);
  if (nsuids.length === 0) {
    console.log("No games with NSUIDs to check");
    return { checked: 0, priceChanges: 0, alertsCreated: 0 };
  }

  console.log(`  Checking prices for ${nsuids.length} games...`);
  const prices = await fetchPrices(nsuids);

  // Build a map of nsuid -> price info
  const priceMap = new Map<string, { regular: number; discount: number | null; endDate: string | null }>();
  for (const p of prices) {
    const nsuid = String(p.title_id);
    const regular = p.regular_price ? parseFloat(p.regular_price.raw_value) : null;
    const discount = p.discount_price ? parseFloat(p.discount_price.raw_value) : null;
    const endDate = p.discount_price?.end_datetime ?? null;
    if (regular != null) {
      priceMap.set(nsuid, { regular, discount, endDate });
    }
  }

  // Process each game
  const gameIds: string[] = [];
  for (const game of games) {
    const priceInfo = priceMap.get(game.nsuid!);
    if (!priceInfo) continue;

    const oldPrice = Number(game.current_price);
    const newPrice = priceInfo.discount ?? priceInfo.regular;
    const originalPrice = priceInfo.regular;
    const isOnSale = priceInfo.discount != null && priceInfo.discount < priceInfo.regular;
    const discount = computeDiscount(newPrice, originalPrice);
    const history = (game.price_history as { date: string; price: number }[]) || [];
    const currentMonth = new Date().toISOString().slice(0, 7);
    const priceChanged = Math.abs(newPrice - oldPrice) >= 0.01;

    // Build update object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {
      current_price: newPrice,
      original_price: originalPrice,
      discount,
      is_on_sale: isOnSale,
      updated_at: new Date().toISOString(),
    };

    // Append to price history if price changed or new month
    const lastEntry = history[history.length - 1];
    if (priceChanged || !lastEntry || lastEntry.date !== currentMonth) {
      update.price_history = [...history, { date: currentMonth, price: newPrice }];
    }

    // Check all-time low
    const allTimeLow = isAllTimeLow(newPrice, history);
    update.is_all_time_low = allTimeLow;

    const { error: updateError } = await supabase
      .from("games")
      .update(update)
      .eq("id", game.id);

    if (updateError) {
      console.error(`  Failed to update ${game.title}:`, updateError.message);
      continue;
    }

    gameIds.push(game.id);

    if (priceChanged) {
      priceChanges++;

      if (shouldAlert) {
        const ref = { id: game.id, title: game.title };

        if (newPrice < oldPrice) {
          if (await generatePriceDropAlert(supabase, ref, oldPrice, newPrice)) alertsCreated++;
        }
        if (allTimeLow) {
          if (await generateAllTimeLowAlert(supabase, ref, newPrice)) alertsCreated++;
        }
        if (isOnSale && !game.is_on_sale) {
          if (await generateSaleStartedAlert(supabase, ref, discount, newPrice, priceInfo.endDate))
            alertsCreated++;
        }
      }
    }
  }

  // Bulk update last_price_check
  if (gameIds.length > 0) {
    await supabase
      .from("games")
      .update({ last_price_check: new Date().toISOString() })
      .in("id", gameIds);
  }

  console.log(`Price update complete: ${games.length} checked, ${priceChanges} changes, ${alertsCreated} alerts`);
  return { checked: games.length, priceChanges, alertsCreated };
}

export async function runReleaseStatusUpdate(): Promise<number> {
  const supabase = createAdminClient();
  const todayStr = new Date().toISOString().split("T")[0];
  let updated = 0;

  // Games releasing today
  const { data: releasingToday } = await supabase
    .from("games")
    .select("id, title, current_price")
    .eq("release_status", "upcoming")
    .eq("release_date", todayStr);

  if (releasingToday) {
    for (const game of releasingToday) {
      await supabase
        .from("games")
        .update({ release_status: "out_today", updated_at: new Date().toISOString() })
        .eq("id", game.id);
      await generateReleaseAlert(
        supabase,
        { id: game.id, title: game.title },
        "release_today",
        Number(game.current_price)
      );
      updated++;
    }
  }

  // Games past their release date still marked upcoming
  const { data: pastRelease } = await supabase
    .from("games")
    .select("id")
    .in("release_status", ["upcoming", "out_today"])
    .lt("release_date", todayStr);

  if (pastRelease) {
    for (const game of pastRelease) {
      await supabase
        .from("games")
        .update({ release_status: "released", updated_at: new Date().toISOString() })
        .eq("id", game.id);
      updated++;
    }
  }

  if (updated > 0) {
    console.log(`Release status update: ${updated} games updated`);
  }
  return updated;
}
