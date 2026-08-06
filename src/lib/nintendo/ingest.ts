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
  generatePriceDropAlert,
  generateAllTimeLowAlert,
  generateSaleStartedAlert,
  isDuplicateSaleSignature,
  generateReleaseAlert,
  generateSwitch2EditionAlert,
  generateSaleEndingAlert,
  generateRetroGameAlert,
} from "./alerts";
import type { AlgoliaHit } from "./types";
import { isYearOnlyDate, isMonthOnlyDate, getPacificDateStr, PLACEHOLDER_DATES } from "@/lib/format";
import { sendAdminAlert } from "@/lib/notifications/admin-alert";

// Shared PostgREST OR-clause fragment: "not junk", null-lenient.
// product_type.not.in excludes NULL under standard SQL three-valued logic
// (confirmed live 2026-08-03), so this must stay null-lenient even though
// the 2026-08-03 backfill cleared all existing NULLs -- a fresh ingest bug
// could otherwise silently drop a real, unclassified game from a query
// that uses this. Used by both runPriceUpdate's poll query and
// runReleaseStatusUpdate's pricedUpcoming fallback.
const NOT_JUNK_OR = "product_type.is.null,product_type.not.in.(ADD_ON_CONTENT,BUNDLE)";

// Event-creation breaker (audit §E, layers 2-3). Every historical junk-alert
// incident this project has had (the 92-game zero-price recovery, the DLC
// backlog, the 123-alert deploy-race batch) produced an unusually large
// out_now batch in a single run -- these thresholds catch the *shape* of an
// incident (a burst, not a trickle) as defense in depth on top of the
// per-row filters already applied to the query that builds this candidate
// list. No real day has ever come close to either number.
const OUT_NOW_BREAKER_THRESHOLD = 20; // re-verify inline against live Nintendo data above this
const OUT_NOW_CEILING = 100; // hold + alarm above this many *verified* candidates

/**
 * Re-checks a candidate against Nintendo's live price API rather than
 * trusting the DB snapshot -- this is the check that would have caught the
 * $0-price-recovery false alerts (a DB row said "real price, never
 * alerted" at the exact moment a corrupted reading was mid-recovery; the
 * live API is ground truth at the moment of alerting, the DB snapshot
 * isn't). Only called above OUT_NOW_BREAKER_THRESHOLD -- a live API round
 * trip per candidate isn't worth paying on every normal, small run.
 */
async function verifyStillOnSale(nsuid: string | null): Promise<boolean> {
  if (!nsuid) return true; // nothing to re-check against -- trust the DB snapshot
  try {
    const prices = await fetchPrices([nsuid]);
    const info = prices.find((p) => String(p.title_id) === nsuid);
    return info?.sales_status === "onsale";
  } catch {
    return true; // API hiccup -- don't let a transient error suppress a real launch
  }
}

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

  // Save trusted release dates before upsert (upsert will overwrite them with
  // Algolia's own — Algolia can carry a null releaseDateDisplay for a game
  // that's definitely released, which parseReleaseDate falls back to the
  // 2099-12-31 placeholder for, silently demoting an already-"released" game
  // back to "upcoming" on every daily sync. Confirmed live 2026-08-02 for
  // "DRAGON QUEST - HD-2D Erdrick Trilogy Collection": Algolia's own record
  // has releaseDateDisplay=null and msrp=null despite the game being real
  // and out. release_date_source distinguishes three trusted origins here:
  // "igdb" (the existing sync-release-dates cron), "price-confirmed" (the
  // pricedUpcoming fallback in runReleaseStatusUpdate below), and "nintendo"
  // (dates taken from Nintendo's own storefront listings via
  // fixes/sync_nintendo_first_party_slate.py, 2026-08-05) — all get
  // restored the same way after the sync potentially clobbers them.
  const { data: trustedDates } = await supabase
    .from("games")
    .select("id, release_date, release_status, release_date_source")
    .in("release_date_source", ["igdb", "price-confirmed", "nintendo"]);
  const trustedDateMap = new Map<string, { release_date: string; release_status: string; release_date_source: string }>();
  for (const g of trustedDates ?? []) {
    trustedDateMap.set(g.id, { release_date: g.release_date, release_status: g.release_status, release_date_source: g.release_date_source });
  }

  // Find which games already exist (by nsuid) so we don't overwrite their
  // prices. MUST be paginated: PostgREST caps an unbounded select at 1,000
  // rows, and with ~2,800+ games these sets silently held only the first
  // 1,000 -- so every catalog sync misclassified the other ~1,800 games as
  // "new" and upserted them WITH Algolia-derived price fields, clobbering
  // real polled prices (msrp ?? 0 -- $0/$0 for titles whose Algolia record
  // has no msrp, e.g. Switch 2 listings) and resetting price_history to a
  // fresh single-bucket entry. Confirmed live 2026-08-04: this, not
  // Nintendo API flakiness, was the actual mechanism behind the recurring
  // "$0 price corruption" waves -- each wave started minutes after a
  // catalog sync run. Same PostgREST-cap bug class already fixed in the
  // sitemap and weekly-digest.
  const existingNsuids = new Set<string>();
  const existingSlugs = new Set<string>();
  const EXISTING_PAGE = 1000;
  for (let from = 0; ; from += EXISTING_PAGE) {
    const { data } = await supabase
      .from("games")
      .select("nsuid, slug")
      .range(from, from + EXISTING_PAGE - 1);
    if (!data || data.length === 0) break;
    for (const g of data) {
      if (g.nsuid) existingNsuids.add(g.nsuid);
      if (g.slug) existingSlugs.add(g.slug);
    }
    if (data.length < EXISTING_PAGE) break;
  }

  // Strip price fields from rows that already exist in DB
  // (price update cron handles prices — catalog sync should not overwrite them)
  const PRICE_FIELDS = ["current_price", "original_price", "discount", "is_on_sale", "is_all_time_low", "price_history"];

  // Fields to preserve from existing DB rows (catalog sync should not overwrite these)
  const PRESERVE_FIELDS = [...PRICE_FIELDS, "genres"];

  function stripPreservedFields(row: Record<string, unknown>) {
    const stripped = { ...row };
    for (const field of PRESERVE_FIELDS) {
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
      // Split into new vs existing to keep uniform column shapes per upsert call
      const newNsuid = withNsuid.filter((r) => !existingNsuids.has(r.nsuid!));
      const existNsuid = withNsuid.filter((r) => existingNsuids.has(r.nsuid!));

      if (newNsuid.length > 0) {
        const { error } = await supabase
          .from("games")
          .upsert(newNsuid, { onConflict: "nsuid", ignoreDuplicates: false });
        if (error) {
          console.error(`  Batch error (nsuid/new) at index ${i}:`, error.message);
          errors++;
        } else {
          upserted += newNsuid.length;
        }
      }

      if (existNsuid.length > 0) {
        const strippedRows = existNsuid.map(stripPreservedFields);
        const { error } = await supabase
          .from("games")
          .upsert(strippedRows, { onConflict: "nsuid", ignoreDuplicates: false });
        if (error) {
          console.error(`  Batch error (nsuid/existing) at index ${i}:`, error.message);
          errors++;
        } else {
          upserted += existNsuid.length;
        }
      }
    }

    if (withoutNsuid.length > 0) {
      const newSlug = withoutNsuid.filter((r) => !existingSlugs.has(r.slug));
      const existSlug = withoutNsuid.filter((r) => existingSlugs.has(r.slug));

      if (newSlug.length > 0) {
        const { error } = await supabase
          .from("games")
          .upsert(newSlug, { onConflict: "slug", ignoreDuplicates: false });
        if (error) {
          console.error(`  Batch error (slug/new) at index ${i}:`, error.message);
          errors++;
        } else {
          upserted += newSlug.length;
        }
      }

      if (existSlug.length > 0) {
        const strippedRows = existSlug.map(stripPreservedFields);
        const { error } = await supabase
          .from("games")
          .upsert(strippedRows, { onConflict: "slug", ignoreDuplicates: false });
        if (error) {
          console.error(`  Batch error (slug/existing) at index ${i}:`, error.message);
          errors++;
        } else {
          upserted += existSlug.length;
        }
      }
    }
  }

  // Update genres for existing games (separate from main upsert to avoid column shape issues)
  const genreUpdates = rows.filter(
    (r) => r.nsuid && Array.isArray(r.genres) && r.genres.length > 0 && existingNsuids.has(r.nsuid)
  );
  if (genreUpdates.length > 0) {
    console.log(`  Updating genres for ${genreUpdates.length} existing games...`);
    for (const row of genreUpdates) {
      await supabase
        .from("games")
        .update({ genres: row.genres })
        .eq("nsuid", row.nsuid);
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

  // Restore trusted (IGDB or price-confirmed) release dates that were
  // overwritten by upsert
  if (trustedDateMap.size > 0) {
    console.log(`  Restoring ${trustedDateMap.size} trusted release dates...`);
    for (const [id, dates] of Array.from(trustedDateMap.entries())) {
      await supabase
        .from("games")
        .update({
          release_date: dates.release_date,
          release_status: dates.release_status,
          release_date_source: dates.release_date_source,
        })
        .eq("id", id);
    }
  }

  // Link Switch 2 editions + suppress duplicates
  console.log("Linking Switch 2 editions and suppressing duplicates...");
  const { data: allDbGames } = await supabase
    .from("games")
    .select("id, title, nsuid, current_price, product_type");

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
      // Un-suppress the base ONLY if it isn't independently junk-classified.
      // is_suppressed has no reason column (schema change blocked -- see
      // CLAUDE.md's audit Phase 1 #11 note on DB access), so it means
      // "duplicate listing" AND "junk" AND "delisted" all at once. This
      // pass's whole job is fixing duplicate-listing suppression -- blindly
      // clearing it here would silently resurrect a genuinely-junk row
      // every single daily sync, the moment it happens to share a
      // normalized title with a Switch 2/upgrade/regional sibling.
      if (base.product_type !== "ADD_ON_CONTENT" && base.product_type !== "BUNDLE") {
        await supabase.from("games").update({ is_suppressed: false }).eq("id", base.id);
      }
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

  // Suppressed/junk (DLC, bundle re-listings) games stay in the polling
  // rotation unless we exempt them -- confirmed live 2026-08-03: with no
  // filter here, ~950+ suppressed rows burned poll slots and could still
  // fire price_drop/sale_started/all_time_low alerts that fan out to
  // FRANCHISE followers (dispatch had no game-level re-check either, fixed
  // separately). A directly-followed game must still poll regardless of
  // suppression (Product Bible: a followed game always alerts), so fetch
  // that exemption set first -- cheap, follows are a small bounded set.
  const { data: followedRows } = await supabase.from("user_game_follows").select("game_id");
  const followedGameIds = Array.from(new Set((followedRows ?? []).map((f) => f.game_id as string)));
  const followedIdList = followedGameIds.length > 0 ? followedGameIds.map((id) => `"${id}"`).join(",") : "";

  // Get games that need price checking, ordered by stalest first
  let pollQuery = supabase
    .from("games")
    .select("id, title, nsuid, current_price, original_price, is_on_sale, price_history, publisher")
    .not("nsuid", "is", null);
  pollQuery = followedIdList
    ? pollQuery.or(`and(is_suppressed.eq.false,or(${NOT_JUNK_OR})),id.in.(${followedIdList})`)
    : pollQuery.or(`and(is_suppressed.eq.false,or(${NOT_JUNK_OR}))`);
  const { data: games, error } = await pollQuery
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
    const regularRaw = p.regular_price ? parseFloat(p.regular_price.raw_value) : null;
    const discountRaw = p.discount_price ? parseFloat(p.discount_price.raw_value) : null;
    const endDate = p.discount_price?.end_datetime ?? null;
    // A malformed raw_value from the API parses to NaN, not null — left
    // unguarded, NaN would pass the null check below and later silently
    // become `null` in the DB via JSON.stringify (JSON has no NaN
    // representation), wiping out a game's price for no visible reason.
    const regular = regularRaw != null && !isNaN(regularRaw) ? regularRaw : null;
    const discount = discountRaw != null && !isNaN(discountRaw) ? discountRaw : null;
    if (regular != null) {
      priceMap.set(nsuid, { regular, discount, endDate });
    }
  }

  if (priceMap.size === 0) {
    console.error(
      `Price API returned no usable data for any of the ${nsuids.length} nsuids this run — skipping last_price_check stamping so these games retry next cycle instead of waiting a full queue rotation`
    );
    return { checked: 0, priceChanges: 0, alertsCreated: 0 };
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

    // Confirmed live 2026-08-02: Nintendo's price API can return a
    // well-formed but implausible regular_price of "0.00" for a game that
    // was priced normally moments before and after (verified by re-querying
    // the same nsuid minutes later — real price, no code change involved).
    // This passes the NaN guard above (0 isn't NaN) and would otherwise
    // write through as a real price, which is worse than the NaN case: it
    // wouldn't just null out the price, it would read as a genuine
    // 100%-off drop AND a false all-time-low ("$0.00 — ALL TIME LOW!") for
    // any game with real price history. Skip a suspicious 0 for a game
    // that already has a real, positive price on record; let it retry
    // next cycle the same way a totally-missing price already does above.
    if (priceInfo.regular <= 0 && !isFirstPriceCheck && oldPrice > 0) {
      console.warn(`  Suspicious $0 regular price for "${game.title}" (nsuid ${game.nsuid}) — skipping this cycle, keeping last known price`);
      continue;
    }

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

    // Exclude the current month's own bucket — it already holds this same
    // price once recorded earlier this month, and a strict `<` comparison
    // against itself is always false, flapping is_all_time_low off on the
    // next unchanged-price poll.
    const priorMonthsHistory = history.filter((entry) => entry.date !== currentMonth);
    const allTimeLow = isAllTimeLow(newPrice, priorMonthsHistory);
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
        let isNewSale = isOnSale && !game.is_on_sale;
        if (isNewSale && await isDuplicateSaleSignature(supabase, game.id, discount, newPrice)) {
          isNewSale = false;
        }
        if (isPriceDrop || allTimeLow || isNewSale) {
          const ref = { id: game.id, title: game.title };

          if (isPriceDrop) {
            if (await generatePriceDropAlert(supabase, ref, oldPrice, newPrice, discount, isOnSale ? endDate : null)) alertsCreated++;
          } else if (isNewSale) {
            if (await generateSaleStartedAlert(supabase, ref, discount, newPrice, endDate)) alertsCreated++;
          }
          // Track sale onset independently of which branch above fired an alert —
          // a sale-start that also reads as a price drop must still count toward
          // the named-sale-event threshold below.
          if (isNewSale) {
            newSaleGames.push({ id: game.id, title: game.title, publisher: (game as typeof game & { publisher?: string }).publisher ?? null });
          }
          if (allTimeLow) {
            if (await generateAllTimeLowAlert(supabase, ref, newPrice)) alertsCreated++;
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

      const due = endingSoon.filter((game) => {
        if (!game.sale_end_date) return false;
        const endTime = new Date(game.sale_end_date).getTime();
        const timeLeft = endTime - now;
        return timeLeft > 0 && timeLeft <= fortyEightHours;
      });

      // Fire alerts concurrently (batched) rather than one at a time — a
      // named sale event can put ~100+ games in this window simultaneously,
      // and each alert does 2-3 sequential DB round-trips (dedup check,
      // insert, pref-filtered follower lookup), which added up serially
      // risked eating into update-prices' 60s function budget.
      const CONCURRENCY = 20;
      for (let i = 0; i < due.length; i += CONCURRENCY) {
        const batch = due.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          batch.map((game) =>
            generateSaleEndingAlert(
              supabase,
              { id: game.id, title: game.title },
              Number(game.current_price),
              Number(game.original_price),
              game.discount ?? 0,
              game.sale_end_date!
            )
          )
        );
        alertsCreated += results.filter(Boolean).length;
      }
    }
  }

  // Named sale event detection — if 5+ games just went on sale, fire a Tier 1 blast
  if (shouldAlert && newSaleGames.length >= 5) {
    await detectAndFireNamedSaleEvent(supabase, newSaleGames).catch((e) =>
      console.error("Named sale event detection failed:", e)
    );
  }

  // Recompute tagged-game counts for every active event on every run (not just
  // when a new detection happens to fire), and deactivate any that have
  // dropped to 0 tagged games — otherwise events go stale once their sale ends.
  await refreshActiveSaleEventCounts(supabase).catch((e) =>
    console.error("Named sale event count refresh failed:", e)
  );

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

  // Check if there's already an active event with this name — just update games_count
  const { data: existingEvent } = await supabase
    .from("named_sale_events")
    .select("id")
    .eq("name", saleName)
    .eq("active", true)
    .order("detected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingEvent) {
    // Update the game count on the existing event
    await supabase
      .from("named_sale_events")
      .update({ games_count: totalGames })
      .eq("id", existingEvent.id);
    console.log(`  Named sale event: updated "${saleName}" (${totalGames} games)`);

    // Update game tags and skip notification (already sent)
    const gameIds = (allSaleGames ?? newSaleGames).map((g) => g.id);
    for (let i = 0; i < gameIds.length; i += 200) {
      const batch = gameIds.slice(i, i + 200);
      await supabase.from("games").update({ sale_event_id: existingEvent.id }).in("id", batch);
    }
    return;
  }

  // Create new event with daily dedup key
  const dedupDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (daily bucket)
  const dedupKey = `${dedupDate}:${saleName}`;

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

// Recompute games_count from actual tagged games for every active event, and
// deactivate any event whose tagged count has fallen to 0 (sale ended and
// nothing renewed it). Runs every price-update cycle so events don't require
// a fresh ≥5-game detection to get cleaned up.
async function refreshActiveSaleEventCounts(
  supabase: ReturnType<typeof createAdminClient>
): Promise<void> {
  const { data: activeEvents } = await supabase
    .from("named_sale_events")
    .select("id, name, games_count")
    .eq("active", true);

  if (!activeEvents || activeEvents.length === 0) return;

  for (const event of activeEvents) {
    const { count } = await supabase
      .from("games")
      .select("id", { count: "exact", head: true })
      .eq("sale_event_id", event.id);

    const actualCount = count ?? 0;
    if (actualCount === 0) {
      await supabase
        .from("named_sale_events")
        .update({ games_count: 0, active: false })
        .eq("id", event.id);
      console.log(`  Named sale event "${event.name}" deactivated — 0 games remaining`);
    } else if (actualCount !== event.games_count) {
      await supabase
        .from("named_sale_events")
        .update({ games_count: actualCount })
        .eq("id", event.id);
    }
  }
}

export async function runReleaseStatusUpdate(): Promise<number> {
  const supabase = createAdminClient();
  const todayStr = getPacificDateStr();
  let updated = 0;

  // Games releasing today. Confirmed live 2026-08-03: this had NO
  // is_suppressed/product_type filter at all, and no protection against
  // sentinel-encoded imprecise dates -- IGDB year-only dates are stored as
  // Dec 31 (isYearOnlyDate) and month-only dates as the last day of the
  // month (isMonthOnlyDate), so on those specific calendar days EVERY
  // vaguely-dated upcoming game would numerically match todayStr and fire
  // a false "releases today" alert, fanning out to franchise followers.
  // Dec 31 specifically is a scheduled incident waiting to happen.
  const { data: releasingTodayRaw } = await supabase
    .from("games")
    .select("id, title, current_price, release_date, is_suppressed, product_type")
    .eq("release_status", "upcoming")
    .eq("release_date", todayStr);

  const followedIdsForRelease = new Set(
    ((await supabase.from("user_game_follows").select("game_id")).data ?? []).map(
      (f) => f.game_id as string
    )
  );
  const isJunkOrSuppressed = (g: { is_suppressed: boolean; product_type: string | null }) =>
    g.is_suppressed || g.product_type === "ADD_ON_CONTENT" || g.product_type === "BUNDLE";

  if (releasingTodayRaw) {
    for (const game of releasingTodayRaw) {
      const followed = followedIdsForRelease.has(game.id);
      const isImprecise = isYearOnlyDate(game.release_date) || isMonthOnlyDate(game.release_date);
      const suppress = (isJunkOrSuppressed(game) && !followed) || isImprecise;

      await supabase
        .from("games")
        // An imprecise date isn't genuinely "today" -- flip straight to
        // released (not out_today) rather than asserting a launch-day
        // status the data doesn't actually support.
        .update({
          release_status: isImprecise ? "released" : "out_today",
          updated_at: new Date().toISOString(),
        })
        .eq("id", game.id);

      if (!suppress) {
        await generateReleaseAlert(
          supabase,
          { id: game.id, title: game.title },
          "release_today",
          Number(game.current_price)
        );
      }
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

  // Games with a real price but stuck on placeholder date — definitely released.
  // This is the only signal here confirmed by Nintendo's own price API rather
  // than inferred from a date field, so it catches games the date-based checks
  // above miss entirely — but it previously flipped release_status silently
  // with no alert, meaning followers of those games never got an "out now"
  // notification at all.
  let pricedUpcomingQuery = supabase
    .from("games")
    .select("id, title, current_price, nsuid")
    .in("release_status", ["upcoming", "out_today"])
    // Both placeholder conventions -- PLACEHOLDER_DATES is the single
    // source (format.ts). Checking only "2099-12-31" left a real gap: a
    // game stuck at "2020-01-01" with a real price and no .gte(today)
    // filter here to catch it implicitly (unlike getUpcomingGamesSoon,
    // which excludes it for free via its own gte(today) clause) would
    // never be reached by this fallback at all. 0 rows match today, but
    // this closes the gap structurally rather than relying on that staying
    // true.
    .in("release_date", PLACEHOLDER_DATES)
    .gt("current_price", 0);
  // Confirmed live 2026-08-03: 405 individual DLC/costume/song items and
  // 8 upgrade/edition bundles were sitting in this exact trap (placeholder
  // date, real small price, no alert history yet) — isStandaloneGame()
  // only stops *new* DLC from entering the catalog, it doesn't retroactively
  // clean up rows inserted before that fix shipped. All 413 were suppressed
  // (is_suppressed=true) after confirming eshopDetails.productType via
  // Algolia. Filtering here makes that protection permanent — any future
  // is_suppressed/junk game never re-enters this alert path, rather than
  // relying on a one-time cleanup staying complete forever. product_type
  // added alongside is_suppressed (2026-08-03 audit): is_suppressed alone
  // missed rows classified junk by the backfill but never manually
  // suppressed. A directly-followed game is exempt from both (Product
  // Bible: a followed game always alerts) — reuses the same follow-id set
  // computed above for releasingToday.
  const pricedUpcomingFollowedIds =
    followedIdsForRelease.size > 0
      ? Array.from(followedIdsForRelease).map((id) => `"${id}"`).join(",")
      : "";
  pricedUpcomingQuery = pricedUpcomingFollowedIds
    ? pricedUpcomingQuery.or(
        `and(is_suppressed.eq.false,or(${NOT_JUNK_OR})),id.in.(${pricedUpcomingFollowedIds})`
      )
    : pricedUpcomingQuery.or(`and(is_suppressed.eq.false,or(${NOT_JUNK_OR}))`);
  const { data: pricedUpcoming } = await pricedUpcomingQuery;

  if (pricedUpcoming && pricedUpcoming.length > 0) {
    const ids = pricedUpcoming.map((g) => g.id);

    // A game stuck on the placeholder date usually really is a brand-new
    // release this fallback should announce — but confirmed live 2026-08-02
    // that a game whose current_price briefly corrupted to $0 (see the
    // health-check zero-price monitoring added earlier tonight) and then
    // recovers looks *identical* to this query: real price now, upcoming
    // status, placeholder date. Monster Hunter Stories (alerting since
    // April) got a false "out now" this way the moment its price
    // corruption resolved. Any game with existing alert history of any
    // kind has obviously already been out for a while — only fire the
    // announcement for ones with none.
    // Paginated: PostgREST caps an unbounded select at 1,000 rows, and the
    // incident this guard exists for (a wave of $0-corrupted games all
    // recovering at once) is exactly when candidates collectively carry
    // thousands of alert rows — a truncated result made history-having
    // games read as "genuinely new" again (2026-08-05 audit C3).
    const hasHistory = new Set<string>();
    const HISTORY_PAGE = 1000;
    for (let from = 0; ; from += HISTORY_PAGE) {
      const { data: priorAlerts, error: historyError } = await supabase
        .from("alerts")
        .select("game_id")
        .in("game_id", ids)
        .range(from, from + HISTORY_PAGE - 1);
      if (historyError) {
        // Fail safe: without complete history we cannot tell new from
        // recovering — treat every candidate as history-having (correct
        // status silently, announce nothing) rather than risk false
        // out_now emails. The next cycle retries with full data.
        console.error(`Release-status fallback: alert-history query failed (${historyError.message}) — suppressing announcements this cycle`);
        for (const g of pricedUpcoming) hasHistory.add(g.id);
        break;
      }
      for (const a of priorAlerts ?? []) hasHistory.add(a.game_id as string);
      if (!priorAlerts || priorAlerts.length < HISTORY_PAGE) break;
    }
    const genuinelyNew = pricedUpcoming.filter((g) => !hasHistory.has(g.id));
    const falseFlagged = pricedUpcoming.filter((g) => hasHistory.has(g.id));

    if (falseFlagged.length > 0) {
      console.warn(
        `Release-status fallback: ${falseFlagged.length} game(s) had a real price + placeholder date but already have alert history — correcting status silently, not announcing as new: ${falseFlagged.map((g) => g.title).join(", ")}`
      );
    }

    // Event-creation breaker (audit §E layers 2-3). Above the threshold,
    // re-verify each candidate against Nintendo's live price API rather
    // than trusting this query's DB snapshot -- see verifyStillOnSale's
    // comment. Below the threshold, a normal small batch skips the extra
    // API round trips entirely.
    let verified = genuinelyNew;
    let rejectedByVerification: typeof genuinelyNew = [];
    if (genuinelyNew.length > OUT_NOW_BREAKER_THRESHOLD) {
      const checks = await Promise.all(
        genuinelyNew.map((g) => verifyStillOnSale(g.nsuid as string | null))
      );
      verified = genuinelyNew.filter((_, i) => checks[i]);
      rejectedByVerification = genuinelyNew.filter((_, i) => !checks[i]);
      if (rejectedByVerification.length > 0) {
        const msg = `Event-creation breaker: ${genuinelyNew.length} out_now candidates in one run (>${OUT_NOW_BREAKER_THRESHOLD}) -- ${rejectedByVerification.length} failed live re-verification and were held (not alerted, not flipped to released -- they'll be re-checked next run): ${rejectedByVerification.map((g) => g.title).join(", ")}`;
        console.warn(msg);
        await sendAdminAlert("Blippd: out_now event-creation breaker tripped", msg);
      }
    }

    // Absolute ceiling: no real day has ever produced this many genuine
    // launches in one run. Hold the ENTIRE verified batch rather than
    // trusting a burst this size -- release_status is deliberately left
    // untouched for held games so they remain in this same query's
    // candidate pool and get re-verified fresh on the next run (~10 min
    // later) instead of being silently dropped forever.
    let toRelease = verified;
    if (verified.length > OUT_NOW_CEILING) {
      const msg = `Event-creation breaker: ${verified.length} verified out_now candidates in one run exceeds the absolute ceiling of ${OUT_NOW_CEILING} -- holding the entire batch this run, will re-verify next poll. Examples: ${verified.slice(0, 10).map((g) => g.title).join(", ")}`;
      console.warn(msg);
      await sendAdminAlert("Blippd: out_now absolute ceiling tripped", msg);
      toRelease = [];
    }

    // Confirmed live 2026-08-03: guessing release_date=today here was actively
    // harmful, not just imprecise — it stamped "released today" on dozens of
    // Nintendo's most iconic, years-old titles (Breath of the Wild, Tears of
    // the Kingdom, Smash Ultimate, and more), all of which had simply never
    // been reached by sync-release-dates (broken for ~5 months, fixed earlier
    // tonight). Worse, tagging the guess "price-confirmed" made it a *trusted*
    // source that Catalog Sync protects from being overwritten, and since the
    // row no longer matches sync-release-dates' own placeholder-date query
    // once it's "today" instead of 2099-12-31, the wrong guess could never be
    // corrected by anything afterward. Now that sync-release-dates actually
    // works, the right fix is to leave release_date alone — it stays on the
    // placeholder (games/game-detail pages already render that as "TBA" via
    // isPlaceholderDate) until sync-release-dates resolves it for real via
    // IGDB. Only release_status flips here, and only for rows actually being
    // released this run -- held/rejected candidates keep their current
    // status so they stay queryable next run instead of being silently lost.
    const releaseIds = [...falseFlagged.map((g) => g.id), ...toRelease.map((g) => g.id)];
    if (releaseIds.length > 0) {
      await supabase
        .from("games")
        .update({ release_status: "released", updated_at: new Date().toISOString() })
        .in("id", releaseIds);
      updated += releaseIds.length;
    }

    for (const game of toRelease) {
      await generateReleaseAlert(
        supabase,
        { id: game.id, title: game.title },
        "out_now",
        Number(game.current_price)
      );
    }
  }

  if (updated > 0) {
    console.log(`Release status update: ${updated} games updated`);
  }
  return updated;
}
