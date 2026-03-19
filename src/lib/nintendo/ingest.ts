import { createAdminClient } from "./admin-client";
import { fetchAllGames, fetchPrices } from "./client";
import {
  algoliaHitToGameRow,
  computeDiscount,
  isAllTimeLow,
  isEnglishGame,
  isStandaloneGame,
  normalizeTitle,
  isSwitch2Edition,
  isUpgradePack,
  isRegionalVariant,
} from "./transform";
import {
  getFollowers,
  generatePriceDropAlert,
  generateAllTimeLowAlert,
  generateSaleStartedAlert,
  generateReleaseAlert,
  generateSwitch2EditionAlert,
  generateSaleEndingAlert,
  generateRetroGameAlert,
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
  "The Pokémon Company",
  "The Pokemon Company",
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

  // Deduplicate by title — keep the highest-priced listing (most likely the real game, not a free stub)
  const titleMap = new Map<string, AlgoliaHit>();
  for (const hit of qualityHits) {
    const key = hit.title.toLowerCase().trim();
    const existing = titleMap.get(key);
    if (!existing || (hit.msrp > existing.msrp)) {
      titleMap.set(key, hit);
    }
  }
  const dedupedHits = Array.from(titleMap.values());
  console.log(`  After title dedup: ${dedupedHits.length} (removed ${qualityHits.length - dedupedHits.length} duplicate titles)`);

  // Transform and deduplicate slugs
  const rows = dedupedHits.map(algoliaHitToGameRow);
  const slugCounts = new Map<string, number>();
  for (const row of rows) {
    const count = slugCounts.get(row.slug) ?? 0;
    slugCounts.set(row.slug, count + 1);
    if (count > 0) {
      row.slug = row.nsuid ? `${row.slug}-${row.nsuid}` : `${row.slug}-${count + 1}`;
    }
  }

  // Save IGDB-sourced release dates before upsert (upsert will overwrite them)
  const { data: igdbDates } = await supabase
    .from("games")
    .select("id, release_date, release_status")
    .eq("release_date_source", "igdb");
  const igdbDateMap = new Map<string, { release_date: string; release_status: string }>();
  for (const g of igdbDates ?? []) {
    igdbDateMap.set(g.id, { release_date: g.release_date, release_status: g.release_status });
  }

  // Find which games already exist (by nsuid) so we don't overwrite their prices
  const existingNsuids = new Set<string>();
  const existingSlugs = new Set<string>();
  const { data: existingByNsuid } = await supabase
    .from("games")
    .select("nsuid")
    .not("nsuid", "is", null);
  for (const g of existingByNsuid ?? []) {
    if (g.nsuid) existingNsuids.add(g.nsuid);
  }
  const { data: existingBySlug } = await supabase
    .from("games")
    .select("slug");
  for (const g of existingBySlug ?? []) {
    existingSlugs.add(g.slug);
  }

  // Strip price fields from rows that already exist in DB
  // (price update cron handles prices — catalog sync should not overwrite them)
  const PRICE_FIELDS = ["current_price", "original_price", "discount", "is_on_sale", "is_all_time_low", "price_history"];

  function stripPriceFields(row: Record<string, unknown>) {
    const stripped = { ...row };
    for (const field of PRICE_FIELDS) {
      delete stripped[field];
    }
    return stripped;
  }

  // Upsert in batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    // Split into rows with and without NSUIDs
    const withNsuid = batch.filter((r) => r.nsuid);
    const withoutNsuid = batch.filter((r) => !r.nsuid);

    if (withNsuid.length > 0) {
      // For existing games, strip price fields; for new games, include them
      const upsertRows = withNsuid.map((r) =>
        existingNsuids.has(r.nsuid!) ? stripPriceFields(r) : r
      );
      const { error } = await supabase
        .from("games")
        .upsert(upsertRows, { onConflict: "nsuid", ignoreDuplicates: false });
      if (error) {
        console.error(`  Batch error (nsuid) at index ${i}:`, error.message);
        errors++;
      } else {
        upserted += withNsuid.length;
      }
    }

    if (withoutNsuid.length > 0) {
      const upsertRows = withoutNsuid.map((r) =>
        existingSlugs.has(r.slug) ? stripPriceFields(r) : r
      );
      const { error } = await supabase
        .from("games")
        .upsert(upsertRows, { onConflict: "slug", ignoreDuplicates: false });
      if (error) {
        console.error(`  Batch error (slug) at index ${i}:`, error.message);
        errors++;
      } else {
        upserted += withoutNsuid.length;
      }
    }
  }

  // Detect newly inserted retro games and fire alerts
  const newRetroGames = rows.filter((r) => {
    const isNew = r.nsuid ? !existingNsuids.has(r.nsuid) : !existingSlugs.has(r.slug);
    return isNew && r.retro_platform;
  });

  if (newRetroGames.length > 0) {
    console.log(`  Found ${newRetroGames.length} new retro games — generating alerts...`);
    for (const row of newRetroGames) {
      // Look up the game ID from DB (was just upserted)
      const { data: dbGame } = await supabase
        .from("games")
        .select("id, franchise")
        .eq("slug", row.slug)
        .maybeSingle();
      if (!dbGame) continue;

      // Collect followers: franchise followers + retro console followers, deduped
      const followerSet = new Set<string>();

      // Franchise followers
      if (dbGame.franchise) {
        const { data: franchiseRow } = await supabase
          .from("franchises")
          .select("id")
          .eq("name", dbGame.franchise)
          .maybeSingle();
        if (franchiseRow) {
          const { data: fFollows } = await supabase
            .from("user_franchise_follows")
            .select("user_id")
            .eq("franchise_id", franchiseRow.id)
            .eq("notify_announcements", true);
          for (const f of fFollows ?? []) followerSet.add(f.user_id);
        }
      }

      // Retro console followers
      const { data: retroFollows } = await supabase
        .from("user_retro_follows")
        .select("user_id")
        .eq("console", row.retro_platform!);
      for (const f of retroFollows ?? []) followerSet.add(f.user_id);

      if (followerSet.size > 0) {
        await generateRetroGameAlert(
          supabase,
          { id: dbGame.id, title: row.title },
          row.retro_platform!,
          Array.from(followerSet)
        );
      }
    }
  }

  // Restore IGDB-sourced release dates that were overwritten by upsert
  if (igdbDateMap.size > 0) {
    console.log(`  Restoring ${igdbDateMap.size} IGDB-sourced release dates...`);
    for (const [id, dates] of Array.from(igdbDateMap.entries())) {
      await supabase
        .from("games")
        .update({
          release_date: dates.release_date,
          release_status: dates.release_status,
          release_date_source: "igdb",
        })
        .eq("id", id);
    }
  }

  // Link Switch 2 editions + suppress duplicates
  console.log("Linking Switch 2 editions and suppressing duplicates...");
  const { data: allDbGames } = await supabase
    .from("games")
    .select("id, title, nsuid, current_price");

  if (allDbGames) {
    // Get existing switch2_nsuid values to detect new ones
    const { data: existingLinks } = await supabase
      .from("games")
      .select("id, switch2_nsuid")
      .not("switch2_nsuid", "is", null);
    const existingSw2Set = new Set((existingLinks ?? []).map((g) => g.id));

    // Group by normalized title
    const groups = new Map<string, typeof allDbGames>();
    for (const g of allDbGames) {
      const key = normalizeTitle(g.title).toLowerCase().trim();
      const group = groups.get(key) ?? [];
      group.push(g);
      groups.set(key, group);
    }

    for (const [, group] of Array.from(groups.entries())) {
      if (group.length <= 1) continue;

      // Find the base game (not Switch 2, not upgrade pack, not regional)
      const base = group.find(
        (g) => !isSwitch2Edition(g.title) && !isUpgradePack(g.title) && !isRegionalVariant(g.title)
      );
      const sw2 = group.find((g) => isSwitch2Edition(g.title));
      const upgrade = group.find((g) => isUpgradePack(g.title));

      if (!base) continue;

      // Update base game with Switch 2 / upgrade pack links
      const baseUpdate: Record<string, unknown> = {};
      if (sw2?.nsuid) baseUpdate.switch2_nsuid = sw2.nsuid;
      if (upgrade?.nsuid) {
        baseUpdate.upgrade_pack_nsuid = upgrade.nsuid;
        baseUpdate.upgrade_pack_price = Number(upgrade.current_price);
      }
      if (Object.keys(baseUpdate).length > 0) {
        await supabase.from("games").update(baseUpdate).eq("id", base.id);
        // Fire alert if Switch 2 edition is newly linked
        if (sw2?.nsuid && !existingSw2Set.has(base.id)) {
          await generateSwitch2EditionAlert(supabase, { id: base.id, title: base.title });
        }
      }

      // Suppress all non-base entries
      const suppressIds = group.filter((g) => g.id !== base.id).map((g) => g.id);
      if (suppressIds.length > 0) {
        await supabase.from("games").update({ is_suppressed: true }).in("id", suppressIds);
      }
      // Ensure base is not suppressed
      await supabase.from("games").update({ is_suppressed: false }).eq("id", base.id);
    }
    console.log(`  Processed ${groups.size} title groups`);
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

    // Get a representative cover art for each franchise
    const { data: repGames } = await supabase
      .from("games")
      .select("franchise, cover_art")
      .not("franchise", "is", null)
      .not("cover_art", "eq", "");

    const logoMap = new Map<string, string>();
    for (const g of repGames ?? []) {
      if (g.franchise && g.cover_art && !logoMap.has(g.franchise)) {
        logoMap.set(g.franchise, g.cover_art);
      }
    }

    // Count games on sale per franchise for popularity scoring
    const { data: saleData } = await supabase
      .from("games")
      .select("franchise")
      .not("franchise", "is", null)
      .eq("is_on_sale", true);
    const saleCounts = new Map<string, number>();
    for (const row of saleData ?? []) {
      const name = row.franchise as string;
      saleCounts.set(name, (saleCounts.get(name) ?? 0) + 1);
    }

    // Count followers per franchise for popularity scoring
    const { data: followData } = await supabase
      .from("user_franchise_follows")
      .select("franchise_id, franchises!inner ( name )");
    const followerCounts = new Map<string, number>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of (followData ?? []) as any[]) {
      const name = row.franchises?.name as string;
      if (name) followerCounts.set(name, (followerCounts.get(name) ?? 0) + 1);
    }

    const validFranchise = (name: string) => name && name !== "[]" && name.trim() !== "";
    const franchiseRows = Array.from(franchiseCounts.entries())
      .filter(([name]) => validFranchise(name))
      .map(([name, count]) => {
        // Popularity = game_count * 2 + on_sale_count * 5 + follower_count * 10
        const onSale = saleCounts.get(name) ?? 0;
        const followers = followerCounts.get(name) ?? 0;
        const popularity = count * 2 + onSale * 5 + followers * 10;
        return {
          name,
          game_count: count,
          logo: logoMap.get(name) || "",
          popularity_score: popularity,
        };
      });

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
    .select("id, title, nsuid, current_price, original_price, is_on_sale, price_history, publisher")
    .not("nsuid", "is", null)
    .order("last_price_check", { ascending: true, nullsFirst: true })
    .limit(100);

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

  // Mark ALL polled games so they don't clog the queue on next run
  // Batch in chunks of 200 to avoid PostgREST URL length limits with .in()
  const allPolledIds = games.map((g) => g.id);
  const QUEUE_BATCH = 200;
  const now = new Date().toISOString();
  const queueUpdates = [];
  for (let i = 0; i < allPolledIds.length; i += QUEUE_BATCH) {
    const batch = allPolledIds.slice(i, i + QUEUE_BATCH);
    queueUpdates.push(
      supabase.from("games").update({ last_price_check: now }).in("id", batch).then(({ error }) => {
        if (error) console.error(`Failed to update last_price_check for batch ${i / QUEUE_BATCH}:`, error.message);
      })
    );
  }
  await Promise.all(queueUpdates);

  // Process each game that got a price response — compute updates in memory first
  const currentMonth = new Date().toISOString().slice(0, 7);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingUpdates: { game: typeof games[0]; update: Record<string, any>; priceChanged: boolean; oldPrice: number; isOnSale: boolean; allTimeLow: boolean; endDate: string | null }[] = [];

  for (const game of games) {
    const priceInfo = priceMap.get(game.nsuid!);
    if (!priceInfo) continue;

    const isFirstPriceCheck = game.current_price == null;
    const oldPrice = Number(game.current_price);
    const newPrice = priceInfo.discount ?? priceInfo.regular;
    const originalPrice = priceInfo.regular;
    const isOnSale = priceInfo.discount != null && priceInfo.discount < priceInfo.regular;
    const discount = computeDiscount(newPrice, originalPrice);
    const history = (game.price_history as { date: string; price: number }[]) || [];
    const priceChanged = !isFirstPriceCheck && Math.abs(newPrice - oldPrice) >= 0.01;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {
      current_price: newPrice,
      original_price: originalPrice,
      discount,
      is_on_sale: isOnSale,
      sale_end_date: isOnSale && priceInfo.endDate ? priceInfo.endDate.split("T")[0] : null,
      ...(isOnSale ? {} : { sale_event_id: null }), // clear event link when sale ends
      updated_at: new Date().toISOString(),
    };

    const lastEntry = history[history.length - 1];
    if (priceChanged || !lastEntry || lastEntry.date !== currentMonth) {
      const shouldReplace = lastEntry?.date === currentMonth;
      const base = shouldReplace ? history.slice(0, -1) : history;
      let newHistory = [...base, { date: currentMonth, price: newPrice }];
      if (newHistory.length > 120) newHistory = newHistory.slice(-120);
      update.price_history = newHistory;
    }

    const allTimeLow = isAllTimeLow(newPrice, history);
    update.is_all_time_low = allTimeLow;

    pendingUpdates.push({ game, update, priceChanged, oldPrice, isOnSale, allTimeLow, endDate: priceInfo.endDate });
  }

  // Fire all DB updates in parallel
  const updateResults = await Promise.all(
    pendingUpdates.map(({ game, update }) =>
      supabase.from("games").update(update).eq("id", game.id).then(({ error }) => {
        if (error) console.error(`  Failed to update ${game.title}:`, error.message);
        return !error;
      })
    )
  );

  // Generate alerts for games that updated successfully and had price changes
  const newSaleGames: Array<{ id: string; title: string; publisher: string | null }> = [];
  const gameIds: string[] = [];
  for (let i = 0; i < pendingUpdates.length; i++) {
    if (!updateResults[i]) continue;
    const { game, priceChanged, oldPrice, isOnSale, allTimeLow, endDate } = pendingUpdates[i];
    const { update } = pendingUpdates[i];
    gameIds.push(game.id);

    if (priceChanged) {
      priceChanges++;

      if (shouldAlert) {
        const newPrice = update.current_price as number;
        const discount = update.discount as number;
        const isPriceDrop = newPrice < oldPrice;
        const isNewSale = isOnSale && !game.is_on_sale;
        if (isPriceDrop || allTimeLow || isNewSale) {
          const ref = { id: game.id, title: game.title };
          const followers = await getFollowers(supabase, game.id);

          if (isPriceDrop) {
            if (await generatePriceDropAlert(supabase, ref, oldPrice, newPrice, discount, followers, isOnSale ? endDate : null)) alertsCreated++;
          } else if (isNewSale) {
            if (await generateSaleStartedAlert(supabase, ref, discount, newPrice, endDate, followers)) alertsCreated++;
            newSaleGames.push({ id: game.id, title: game.title, publisher: (game as typeof game & { publisher?: string }).publisher ?? null });
          }
          if (allTimeLow) {
            if (await generateAllTimeLowAlert(supabase, ref, newPrice, followers)) alertsCreated++;
          }
        }
      }
    }
  }

  // Check for sales ending soon (within 48 hours) — fire sale_ending alerts
  if (shouldAlert) {
    const { data: endingSoon } = await supabase
      .from("games")
      .select("id, title, current_price, original_price, discount, sale_end_date")
      .eq("is_on_sale", true)
      .eq("is_suppressed", false)
      .not("sale_end_date", "is", null);

    if (endingSoon) {
      const now = Date.now();
      const fortyEightHours = 48 * 60 * 60 * 1000;

      for (const game of endingSoon) {
        if (!game.sale_end_date) continue;
        const endTime = new Date(game.sale_end_date).getTime();
        const timeLeft = endTime - now;

        // Fire alert if sale ends within 48 hours and hasn't ended yet
        if (timeLeft > 0 && timeLeft <= fortyEightHours) {
          const ref = { id: game.id, title: game.title };
          if (await generateSaleEndingAlert(
            supabase, ref,
            Number(game.current_price),
            Number(game.original_price),
            game.discount ?? 0,
            game.sale_end_date
          )) {
            alertsCreated++;
          }
        }
      }
    }
  }

  // Named sale event detection — if 5+ games just went on sale, fire a Tier 1 blast
  if (shouldAlert && newSaleGames.length >= 5) {
    await detectAndFireNamedSaleEvent(supabase, newSaleGames).catch((e) =>
      console.error("Named sale event detection failed:", e)
    );
  }

  console.log(`Price update complete: ${games.length} checked, ${priceChanges} changes, ${alertsCreated} alerts`);
  return { checked: games.length, priceChanges, alertsCreated };
}

function detectSaleName(publishers: (string | null)[]): string {
  const counts = new Map<string, number>();
  for (const raw of publishers) {
    if (!raw) continue;
    const lower = raw.toLowerCase();
    let key = raw;
    if (lower.includes("square enix")) key = "Square Enix";
    else if (lower.includes("nintendo")) key = "Nintendo";
    else if (lower.includes("capcom")) key = "Capcom";
    else if (lower.includes("sega")) key = "SEGA";
    else if (lower.includes("konami")) key = "Konami";
    else if (lower.includes("bandai")) key = "Bandai Namco";
    else if (lower.includes("ubisoft")) key = "Ubisoft";
    else if (lower === "ea" || lower.startsWith("ea ")) key = "EA";
    else if (lower.includes("devolver")) key = "Devolver Digital";
    else if (lower.includes("505")) key = "505 Games";
    else if (lower.includes("team17")) key = "Team17";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let dominant: string | null = null;
  let maxCount = 0;
  Array.from(counts.entries()).forEach(([pub, count]) => {
    if (count > maxCount) { maxCount = count; dominant = pub; }
  });
  if (dominant && maxCount >= publishers.filter(Boolean).length * 0.5) {
    return `${dominant} Sale`;
  }
  return "Nintendo eShop Sale";
}

async function detectAndFireNamedSaleEvent(
  supabase: ReturnType<typeof createAdminClient>,
  newSaleGames: Array<{ id: string; title: string; publisher: string | null }>
): Promise<void> {
  // Avoid duplicate events — check if one was created in the last 2 hours
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: recentEvents } = await supabase
    .from("named_sale_events")
    .select("id")
    .eq("active", true)
    .gte("detected_at", twoHoursAgo)
    .limit(1);

  if (recentEvents && recentEvents.length > 0) {
    console.log("  Named sale event: recent event exists, skipping");
    return;
  }

  // Get all currently on-sale games to determine full scope and publisher
  const { data: allSaleGames } = await supabase
    .from("games")
    .select("id, publisher, sale_end_date")
    .eq("is_on_sale", true)
    .eq("is_suppressed", false);

  const totalGames = allSaleGames?.length ?? newSaleGames.length;
  if (totalGames < 5) return;

  const publishers = (allSaleGames ?? newSaleGames).map((g) => g.publisher ?? null);
  const saleName = detectSaleName(publishers);

  // Pick the most common sale_end_date
  const endDateCounts = new Map<string, number>();
  for (const g of allSaleGames ?? []) {
    if (g.sale_end_date) endDateCounts.set(g.sale_end_date, (endDateCounts.get(g.sale_end_date) ?? 0) + 1);
  }
  const saleEndDate = endDateCounts.size > 0
    ? Array.from(endDateCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  // Generate a dedup key based on date + sale name to prevent race condition
  // Two concurrent calls will both try to insert with the same key; one will fail
  const dedupDate = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH (hourly bucket)
  const dedupKey = `${dedupDate}:${saleName}`;

  // Create the named sale event (use upsert with dedup_key to prevent race condition)
  const { data: event, error: eventError } = await supabase
    .from("named_sale_events")
    .upsert(
      { name: saleName, detected_at: new Date().toISOString(), active: true, games_count: totalGames, dedup_key: dedupKey },
      { onConflict: "dedup_key", ignoreDuplicates: true }
    )
    .select("id")
    .single();

  if (!event || eventError) {
    console.error("  Failed to create named_sale_event:", eventError?.message);
    return;
  }

  console.log(`  Named sale event: "${saleName}" (${totalGames} games on sale, event ${event.id})`);

  // Tag all current on-sale games with this event ID
  const gameIds = (allSaleGames ?? newSaleGames).map((g) => g.id);
  for (let i = 0; i < gameIds.length; i += 200) {
    const batch = gameIds.slice(i, i + 200);
    await supabase.from("games").update({ sale_event_id: event.id }).in("id", batch);
  }

  // Collect all unique followers of any on-sale game with notify_sales on
  const uniqueUserIds = new Set<string>();
  for (let i = 0; i < gameIds.length; i += 200) {
    const batch = gameIds.slice(i, i + 200);
    const { data: follows } = await supabase
      .from("user_game_follows")
      .select("user_id")
      .in("game_id", batch)
      .eq("notify_sales", true);
    for (const f of (follows ?? [])) uniqueUserIds.add(f.user_id);
  }

  if (uniqueUserIds.size === 0) {
    console.log("  Named sale event: no followers to notify");
    return;
  }

  console.log(`  Sending named sale Tier 1 blast to ${uniqueUserIds.size} users`);
  const { sendNamedSaleEventEmail } = await import("@/lib/notifications/send-batch");
  await sendNamedSaleEventEmail(Array.from(uniqueUserIds), saleName, totalGames, saleEndDate);
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

  // Games with a real price but stuck on placeholder date — definitely released
  const { data: pricedUpcoming } = await supabase
    .from("games")
    .select("id")
    .in("release_status", ["upcoming", "out_today"])
    .eq("release_date", "2099-12-31")
    .gt("current_price", 0);

  if (pricedUpcoming && pricedUpcoming.length > 0) {
    const ids = pricedUpcoming.map((g) => g.id);
    // Set release_date to today as best approximation — at minimum it makes them
    // visible in New Releases rather than staying stuck behind the 2099 exclusion filter
    await supabase
      .from("games")
      .update({ release_status: "released", release_date: todayStr, updated_at: new Date().toISOString() })
      .in("id", ids);
    updated += ids.length;
  }

  if (updated > 0) {
    console.log(`Release status update: ${updated} games updated`);
  }
  return updated;
}
