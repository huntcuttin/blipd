/**
 * Imports announced-but-not-yet-on-eShop games from IGDB into our catalog.
 * Targets Switch/Switch 2 games with hype > 0 or recently announced.
 *
 * Games added here will have:
 *   - nsuid = null (not in eShop yet)
 *   - release_date = 2099-12-31 if TBA
 *   - release_status = "upcoming"
 *   - release_date_source = "igdb"
 *
 * Run: node scripts/import-announced-games.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
  console.error("❌ Missing env vars.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── IGDB auth ───────────────────────────────────────────────────────────────
const tokenRes = await fetch(
  `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
  { method: "POST" }
);
const { access_token: IGDB_TOKEN } = await tokenRes.json();

async function igdbQuery(endpoint, body) {
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": TWITCH_CLIENT_ID,
      Authorization: `Bearer ${IGDB_TOKEN}`,
      "Content-Type": "text/plain",
    },
    body,
  });
  if (!res.ok) throw new Error(`IGDB ${endpoint} failed: ${res.status}`);
  return res.json();
}

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function tsToDate(ts) {
  if (!ts) return "2099-12-31";
  const d = new Date(ts * 1000);
  return d.toISOString().split("T")[0];
}

// ─── Fetch announced Switch games from IGDB ──────────────────────────────────
console.log("\n[1/4] Fetching announced Switch/Switch 2 games from IGDB...");

// IGDB platform IDs: 130 = Nintendo Switch, 409 = Nintendo Switch 2
// Status: 0=released, 2=alpha, 3=beta, 4=early_access, 6=TBA
const SWITCH_PLATFORMS = "(130, 409)";

// Get games with hype OR announced within the last 6 months, not yet released
const now = Math.floor(Date.now() / 1000);
const sixMonthsAgo = now - (6 * 30 * 24 * 3600);

const igdbGames = await igdbQuery("games",
  `fields name, id, hypes, first_release_date, platforms, involved_companies.company.name, involved_companies.developer, involved_companies.publisher, cover.url, status;
  where platforms = ${SWITCH_PLATFORMS} & (hypes > 0 | first_release_date > ${sixMonthsAgo}) & first_release_date > ${now};
  sort hypes desc;
  limit 100;`
);

console.log(`  Found ${igdbGames.length} upcoming games on IGDB`);

if (igdbGames.length === 0) {
  console.log("  No upcoming games found.");
  process.exit(0);
}

// ─── Load existing games from DB to avoid dupes ───────────────────────────────
console.log("\n[2/4] Loading existing game titles from DB...");

const { data: existingGames } = await supabase
  .from("games")
  .select("title, igdb_id, nsuid");

const existingTitles = new Set(
  (existingGames ?? []).map(g => g.title.toLowerCase().replace(/[™®©]/g, "").trim())
);
const existingIgdbIds = new Set(
  (existingGames ?? []).map(g => g.igdb_id).filter(Boolean)
);

console.log(`  ${existingTitles.size} games already in DB`);

// ─── Filter to new games only ─────────────────────────────────────────────────
console.log("\n[3/4] Filtering to new announced games...");

const toInsert = [];

for (const game of igdbGames) {
  if (existingIgdbIds.has(game.id)) continue;

  const cleanTitle = (game.name ?? "").replace(/[™®©]/g, "").trim().toLowerCase();
  if (existingTitles.has(cleanTitle)) continue;

  // Extract publisher/developer
  const companies = game.involved_companies ?? [];
  const publisher = companies.find(c => c.publisher)?.company?.name ?? "Nintendo";
  const developer = companies.find(c => c.developer)?.company?.name ?? null;

  // Cover art
  const coverUrl = game.cover?.url
    ? game.cover.url.replace("t_thumb", "t_cover_big").replace("//", "https://")
    : null;

  // Release date
  const releaseDate = game.first_release_date
    ? tsToDate(game.first_release_date)
    : "2099-12-31";

  // Platform
  const isSwitch2 = (game.platforms ?? []).includes(409);
  const platform = isSwitch2 ? "switch2" : "switch";

  toInsert.push({
    title: game.name,
    slug: generateSlug(game.name),
    publisher,
    developer,
    cover_art: coverUrl,
    nsuid: null,
    release_date: releaseDate,
    release_status: "upcoming",
    release_date_source: "igdb",
    igdb_id: game.id,
    igdb_hype: game.hypes ?? 0,
    platform,
    current_price: 0,
    original_price: 0,
    is_on_sale: false,
    catalog_tier: "full",
  });
}

console.log(`  ${toInsert.length} new games to insert`);
toInsert.forEach(g => console.log(`    • ${g.title} (hype: ${g.igdb_hype}, release: ${g.release_date})`));

if (toInsert.length === 0) {
  console.log("\n✅ Nothing new to add.");
  process.exit(0);
}

// ─── Insert into DB ───────────────────────────────────────────────────────────
console.log("\n[4/4] Inserting into games table...");

const inserted = [];
const skipped = [];

for (const game of toInsert) {
  const { data, error } = await supabase
    .from("games")
    .insert(game)
    .select("id, title")
    .single();

  if (error) {
    if (error.code === "23505") {
      // Unique constraint violation — slug or igdb_id conflict
      // Try with a suffixed slug
      const { data: data2, error: error2 } = await supabase
        .from("games")
        .insert({ ...game, slug: `${game.slug}-${game.igdb_id}` })
        .select("id, title")
        .single();
      if (error2) {
        skipped.push(game.title);
      } else {
        inserted.push(data2);
      }
    } else {
      console.error(`  ⚠️  ${game.title}: ${error.message}`);
      skipped.push(game.title);
    }
  } else {
    inserted.push(data);
  }
}

console.log(`\n✅ Added ${inserted.length} announced games:`);
inserted.forEach(g => console.log(`   • ${g.title}`));
if (skipped.length > 0) {
  console.log(`\n⚠️  Skipped ${skipped.length} (conflict):`);
  skipped.forEach(t => console.log(`   • ${t}`));
}
