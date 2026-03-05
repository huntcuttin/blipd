import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// ── Date helpers ──────────────────────────────────────────────
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

function daysFromNow(days: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ── Games data ────────────────────────────────────────────────
const games = [
  {
    slug: slugify("The Legend of Zelda Tears of the Kingdom"),
    title: "The Legend of Zelda: Tears of the Kingdom",
    publisher: "Nintendo",
    franchise: "The Legend of Zelda",
    cover_art: "/images/covers/zelda-totk.jpg",
    current_price: 49.99,
    original_price: 69.99,
    discount: 29,
    is_on_sale: true,
    is_all_time_low: false,
    release_date: daysFromNow(-300),
    release_status: "released",
    price_history: [
      { date: "2025-06", price: 69.99 },
      { date: "2025-09", price: 59.99 },
      { date: "2025-11", price: 54.99 },
      { date: "2026-01", price: 49.99 },
      { date: "2026-02", price: 49.99 },
    ],
  },
  {
    slug: slugify("Hollow Knight"),
    title: "Hollow Knight",
    publisher: "Team Cherry",
    franchise: null,
    cover_art: "/images/covers/hollow-knight.jpg",
    current_price: 7.49,
    original_price: 14.99,
    discount: 50,
    is_on_sale: true,
    is_all_time_low: true,
    release_date: daysFromNow(-900),
    release_status: "released",
    price_history: [
      { date: "2025-03", price: 14.99 },
      { date: "2025-07", price: 9.99 },
      { date: "2025-11", price: 9.99 },
      { date: "2026-01", price: 7.49 },
      { date: "2026-02", price: 7.49 },
    ],
  },
  {
    slug: slugify("Metroid Prime Remastered"),
    title: "Metroid Prime Remastered",
    publisher: "Nintendo",
    franchise: "Metroid",
    cover_art: "/images/covers/metroid-prime-remastered.jpg",
    current_price: 29.99,
    original_price: 39.99,
    discount: 25,
    is_on_sale: true,
    is_all_time_low: false,
    release_date: daysFromNow(-400),
    release_status: "released",
    price_history: [
      { date: "2025-05", price: 39.99 },
      { date: "2025-08", price: 34.99 },
      { date: "2025-12", price: 29.99 },
      { date: "2026-01", price: 34.99 },
      { date: "2026-02", price: 29.99 },
    ],
  },
  {
    slug: slugify("Super Mario Odyssey"),
    title: "Super Mario Odyssey",
    publisher: "Nintendo",
    franchise: "Mario",
    cover_art: "/images/covers/super-mario-odyssey.jpg",
    current_price: 39.99,
    original_price: 59.99,
    discount: 33,
    is_on_sale: true,
    is_all_time_low: false,
    release_date: daysFromNow(-1200),
    release_status: "released",
    price_history: [
      { date: "2025-04", price: 59.99 },
      { date: "2025-07", price: 49.99 },
      { date: "2025-10", price: 44.99 },
      { date: "2025-12", price: 39.99 },
      { date: "2026-02", price: 39.99 },
    ],
  },
  {
    slug: slugify("Celeste"),
    title: "Celeste",
    publisher: "Maddy Makes Games",
    franchise: null,
    cover_art: "/images/covers/celeste.jpg",
    current_price: 4.99,
    original_price: 19.99,
    discount: 75,
    is_on_sale: true,
    is_all_time_low: true,
    release_date: daysFromNow(-1400),
    release_status: "released",
    price_history: [
      { date: "2025-03", price: 19.99 },
      { date: "2025-06", price: 9.99 },
      { date: "2025-09", price: 7.99 },
      { date: "2025-12", price: 4.99 },
      { date: "2026-02", price: 4.99 },
    ],
  },
  {
    slug: slugify("Hades"),
    title: "Hades",
    publisher: "Supergiant Games",
    franchise: null,
    cover_art: "/images/covers/hades.jpg",
    current_price: 12.49,
    original_price: 24.99,
    discount: 50,
    is_on_sale: true,
    is_all_time_low: false,
    release_date: daysFromNow(-800),
    release_status: "released",
    price_history: [
      { date: "2025-05", price: 24.99 },
      { date: "2025-08", price: 17.49 },
      { date: "2025-11", price: 14.99 },
      { date: "2026-01", price: 12.49 },
      { date: "2026-02", price: 12.49 },
    ],
  },
  {
    slug: slugify("Stardew Valley"),
    title: "Stardew Valley",
    publisher: "ConcernedApe",
    franchise: null,
    cover_art: "/images/covers/stardew-valley.jpg",
    current_price: 14.99,
    original_price: 14.99,
    discount: 0,
    is_on_sale: false,
    is_all_time_low: false,
    release_date: daysFromNow(-1500),
    release_status: "released",
    price_history: [
      { date: "2025-03", price: 14.99 },
      { date: "2025-06", price: 14.99 },
      { date: "2025-09", price: 14.99 },
      { date: "2025-12", price: 14.99 },
      { date: "2026-02", price: 14.99 },
    ],
  },
  {
    slug: slugify("Disco Elysium"),
    title: "Disco Elysium",
    publisher: "ZA/UM",
    franchise: null,
    cover_art: "/images/covers/disco-elysium.jpg",
    current_price: 9.99,
    original_price: 39.99,
    discount: 75,
    is_on_sale: true,
    is_all_time_low: true,
    release_date: daysFromNow(-600),
    release_status: "released",
    price_history: [
      { date: "2025-04", price: 39.99 },
      { date: "2025-07", price: 19.99 },
      { date: "2025-10", price: 14.99 },
      { date: "2026-01", price: 9.99 },
      { date: "2026-02", price: 9.99 },
    ],
  },
  {
    slug: slugify("Pokemon Scarlet"),
    title: "Pokémon Scarlet",
    publisher: "Nintendo",
    franchise: "Pokémon",
    cover_art: "/images/covers/pokemon-scarlet.jpg",
    current_price: 49.99,
    original_price: 59.99,
    discount: 17,
    is_on_sale: true,
    is_all_time_low: false,
    release_date: daysFromNow(-500),
    release_status: "released",
    price_history: [
      { date: "2025-06", price: 59.99 },
      { date: "2025-09", price: 54.99 },
      { date: "2025-12", price: 49.99 },
      { date: "2026-01", price: 54.99 },
      { date: "2026-02", price: 49.99 },
    ],
  },
  {
    slug: slugify("Fire Emblem Engage"),
    title: "Fire Emblem Engage",
    publisher: "Nintendo",
    franchise: "Fire Emblem",
    cover_art: "/images/covers/fire-emblem-engage.jpg",
    current_price: 35.99,
    original_price: 59.99,
    discount: 40,
    is_on_sale: true,
    is_all_time_low: false,
    release_date: daysFromNow(-400),
    release_status: "released",
    price_history: [
      { date: "2025-05", price: 59.99 },
      { date: "2025-08", price: 44.99 },
      { date: "2025-11", price: 39.99 },
      { date: "2026-01", price: 35.99 },
      { date: "2026-02", price: 35.99 },
    ],
  },
  {
    slug: slugify("Xenoblade Chronicles 3"),
    title: "Xenoblade Chronicles 3",
    publisher: "Nintendo",
    franchise: null,
    cover_art: "/images/covers/xenoblade-chronicles-3.jpg",
    current_price: 41.99,
    original_price: 59.99,
    discount: 30,
    is_on_sale: true,
    is_all_time_low: false,
    release_date: daysFromNow(-450),
    release_status: "released",
    price_history: [
      { date: "2025-04", price: 59.99 },
      { date: "2025-07", price: 49.99 },
      { date: "2025-10", price: 44.99 },
      { date: "2026-01", price: 41.99 },
      { date: "2026-02", price: 41.99 },
    ],
  },
  {
    slug: slugify("Splatoon 3"),
    title: "Splatoon 3",
    publisher: "Nintendo",
    franchise: null,
    cover_art: "/images/covers/splatoon-3.jpg",
    current_price: 44.99,
    original_price: 59.99,
    discount: 25,
    is_on_sale: true,
    is_all_time_low: false,
    release_date: daysFromNow(-500),
    release_status: "released",
    price_history: [
      { date: "2025-05", price: 59.99 },
      { date: "2025-08", price: 49.99 },
      { date: "2025-11", price: 44.99 },
      { date: "2026-01", price: 44.99 },
      { date: "2026-02", price: 44.99 },
    ],
  },
  {
    slug: slugify("Animal Crossing New Horizons"),
    title: "Animal Crossing: New Horizons",
    publisher: "Nintendo",
    franchise: null,
    cover_art: "/images/covers/animal-crossing.jpg",
    current_price: 39.99,
    original_price: 59.99,
    discount: 33,
    is_on_sale: true,
    is_all_time_low: false,
    release_date: daysFromNow(-1800),
    release_status: "released",
    price_history: [
      { date: "2025-03", price: 59.99 },
      { date: "2025-06", price: 49.99 },
      { date: "2025-09", price: 44.99 },
      { date: "2025-12", price: 39.99 },
      { date: "2026-02", price: 39.99 },
    ],
  },
  {
    slug: slugify("Bayonetta 3"),
    title: "Bayonetta 3",
    publisher: "Nintendo",
    franchise: null,
    cover_art: "/images/covers/bayonetta-3.jpg",
    current_price: 39.99,
    original_price: 59.99,
    discount: 33,
    is_on_sale: true,
    is_all_time_low: false,
    release_date: daysFromNow(-500),
    release_status: "released",
    price_history: [
      { date: "2025-04", price: 59.99 },
      { date: "2025-07", price: 49.99 },
      { date: "2025-10", price: 44.99 },
      { date: "2026-01", price: 39.99 },
      { date: "2026-02", price: 39.99 },
    ],
  },
  {
    slug: slugify("Kirby and the Forgotten Land"),
    title: "Kirby and the Forgotten Land",
    publisher: "Nintendo",
    franchise: "Kirby",
    cover_art: "/images/covers/kirby-forgotten-land.jpg",
    current_price: 44.99,
    original_price: 59.99,
    discount: 25,
    is_on_sale: true,
    is_all_time_low: false,
    release_date: daysFromNow(-600),
    release_status: "released",
    price_history: [
      { date: "2025-03", price: 59.99 },
      { date: "2025-06", price: 54.99 },
      { date: "2025-09", price: 49.99 },
      { date: "2025-12", price: 44.99 },
      { date: "2026-02", price: 44.99 },
    ],
  },
  {
    slug: slugify("Metroid Prime 4 Beyond"),
    title: "Metroid Prime 4: Beyond",
    publisher: "Nintendo",
    franchise: "Metroid",
    cover_art: "/images/covers/metroid-prime-4.jpg",
    current_price: 69.99,
    original_price: 69.99,
    discount: 0,
    is_on_sale: false,
    is_all_time_low: false,
    release_date: daysFromNow(0),
    release_status: "out_today",
    price_history: [{ date: "2026-03", price: 69.99 }],
  },
  {
    slug: slugify("Professor Layton and the New World of Steam"),
    title: "Professor Layton and the New World of Steam",
    publisher: "Level-5",
    franchise: null,
    cover_art: "/images/covers/professor-layton.jpg",
    current_price: 49.99,
    original_price: 49.99,
    discount: 0,
    is_on_sale: false,
    is_all_time_low: false,
    release_date: daysFromNow(1),
    release_status: "upcoming",
    price_history: [{ date: "2026-03", price: 49.99 }],
  },
  {
    slug: slugify("Mario and Luigi Brothership"),
    title: "Mario & Luigi: Brothership",
    publisher: "Nintendo",
    franchise: "Mario",
    cover_art: "/images/covers/mario-luigi-brothership.jpg",
    current_price: 59.99,
    original_price: 59.99,
    discount: 0,
    is_on_sale: false,
    is_all_time_low: false,
    release_date: daysFromNow(3),
    release_status: "upcoming",
    price_history: [{ date: "2026-03", price: 59.99 }],
  },
  {
    slug: slugify("Donkey Kong Country Returns HD"),
    title: "Donkey Kong Country Returns HD",
    publisher: "Nintendo",
    franchise: null,
    cover_art: "/images/covers/dk-returns-hd.jpg",
    current_price: 49.99,
    original_price: 49.99,
    discount: 0,
    is_on_sale: false,
    is_all_time_low: false,
    release_date: daysFromNow(5),
    release_status: "upcoming",
    price_history: [{ date: "2026-03", price: 49.99 }],
  },
  {
    slug: slugify("Pokemon Legends Z-A"),
    title: "Pokémon Legends: Z-A",
    publisher: "Nintendo",
    franchise: "Pokémon",
    cover_art: "/images/covers/pokemon-legends-za.jpg",
    current_price: 59.99,
    original_price: 59.99,
    discount: 0,
    is_on_sale: false,
    is_all_time_low: false,
    release_date: daysFromNow(8),
    release_status: "upcoming",
    price_history: [{ date: "2026-03", price: 59.99 }],
  },
  {
    slug: slugify("Nintendo Switch Sports 2"),
    title: "Nintendo Switch Sports 2",
    publisher: "Nintendo",
    franchise: null,
    cover_art: "/images/covers/switch-sports-2.jpg",
    current_price: 49.99,
    original_price: 49.99,
    discount: 0,
    is_on_sale: false,
    is_all_time_low: false,
    release_date: daysFromNow(10),
    release_status: "upcoming",
    price_history: [{ date: "2026-03", price: 49.99 }],
  },
  {
    slug: slugify("Pikmin 5"),
    title: "Pikmin 5",
    publisher: "Nintendo",
    franchise: null,
    cover_art: "/images/covers/pikmin-5.jpg",
    current_price: 59.99,
    original_price: 59.99,
    discount: 0,
    is_on_sale: false,
    is_all_time_low: false,
    release_date: daysFromNow(30),
    release_status: "upcoming",
    price_history: [{ date: "2026-04", price: 59.99 }],
  },
  {
    slug: slugify("Zelda Wind Waker HD"),
    title: "The Legend of Zelda: Wind Waker HD",
    publisher: "Nintendo",
    franchise: "The Legend of Zelda",
    cover_art: "/images/covers/zelda-wind-waker-hd.jpg",
    current_price: 49.99,
    original_price: 49.99,
    discount: 0,
    is_on_sale: false,
    is_all_time_low: false,
    release_date: daysFromNow(45),
    release_status: "upcoming",
    price_history: [{ date: "2026-04", price: 49.99 }],
  },
  {
    slug: slugify("Kirby Star Allies DX"),
    title: "Kirby Star Allies DX",
    publisher: "Nintendo",
    franchise: "Kirby",
    cover_art: "/images/covers/kirby-star-allies-dx.jpg",
    current_price: 59.99,
    original_price: 59.99,
    discount: 0,
    is_on_sale: false,
    is_all_time_low: false,
    release_date: daysFromNow(-1),
    release_status: "released",
    price_history: [{ date: "2026-03", price: 59.99 }],
  },
  {
    slug: slugify("Fire Emblem Warriors Three Hopes Remaster"),
    title: "Fire Emblem Warriors: Three Hopes Remaster",
    publisher: "Nintendo",
    franchise: "Fire Emblem",
    cover_art: "/images/covers/fe-warriors-remaster.jpg",
    current_price: 39.99,
    original_price: 39.99,
    discount: 0,
    is_on_sale: false,
    is_all_time_low: false,
    release_date: daysFromNow(-3),
    release_status: "released",
    price_history: [{ date: "2026-02", price: 39.99 }],
  },
  {
    slug: slugify("Pikmin 4 Deluxe"),
    title: "Pikmin 4 Deluxe",
    publisher: "Nintendo",
    franchise: null,
    cover_art: "/images/covers/pikmin-4-deluxe.jpg",
    current_price: 49.99,
    original_price: 49.99,
    discount: 0,
    is_on_sale: false,
    is_all_time_low: false,
    release_date: daysFromNow(-5),
    release_status: "released",
    price_history: [{ date: "2026-02", price: 49.99 }],
  },
];

// ── Franchises data ───────────────────────────────────────────
const franchises = [
  { name: "The Legend of Zelda", game_count: 47, logo: "/images/franchises/zelda.jpg" },
  { name: "Mario", game_count: 68, logo: "/images/franchises/mario.jpg" },
  { name: "Metroid", game_count: 18, logo: "/images/franchises/metroid.jpg" },
  { name: "Pokémon", game_count: 42, logo: "/images/franchises/pokemon.jpg" },
  { name: "Fire Emblem", game_count: 23, logo: "/images/franchises/fire-emblem.jpg" },
  { name: "Kirby", game_count: 35, logo: "/images/franchises/kirby.jpg" },
];

// ── Alerts (reference games by slug → looked up after insert) ─
const alertsDef = [
  {
    gameSlug: "the-legend-of-zelda-tears-of-the-kingdom",
    type: "price_drop",
    headline: "Zelda: TotK dropped to $49.99",
    subtext: "Was $69.99 · Save $20.00",
    hoursAgo: 2,
  },
  {
    gameSlug: "hollow-knight",
    type: "all_time_low",
    headline: "Hollow Knight — ALL TIME LOW",
    subtext: "$7.49 · Lowest price ever recorded",
    hoursAgo: 3,
  },
  {
    gameSlug: "metroid-prime-4-beyond",
    type: "out_now",
    headline: "Metroid Prime 4: Beyond is available now",
    subtext: "$69.99 on Nintendo eShop",
    hoursAgo: 5,
  },
  {
    gameSlug: "celeste",
    type: "sale_started",
    headline: "Celeste sale — 75% off",
    subtext: "$4.99 · Ends Mar 10",
    hoursAgo: 8,
  },
  {
    gameSlug: "professor-layton-and-the-new-world-of-steam",
    type: "release_today",
    headline: "Professor Layton releases tomorrow at midnight PT",
    subtext: "Pre-order available · $49.99",
    hoursAgo: 26,
  },
  {
    gameSlug: "pikmin-5",
    type: "announced",
    headline: "Pikmin 5 just announced for Nintendo Switch",
    subtext: "Coming Spring 2026 · $59.99",
    hoursAgo: 30,
  },
  {
    gameSlug: "hades",
    type: "price_drop",
    headline: "Hades dropped to $12.49",
    subtext: "Was $24.99 · Save $12.50",
    hoursAgo: 48,
  },
  {
    gameSlug: "disco-elysium",
    type: "all_time_low",
    headline: "Disco Elysium — ALL TIME LOW",
    subtext: "$9.99 · 75% off · Lowest price ever",
    hoursAgo: 72,
  },
  {
    gameSlug: "fire-emblem-engage",
    type: "sale_started",
    headline: "Fire Emblem Engage sale — 40% off",
    subtext: "$35.99 · Ends Mar 15",
    hoursAgo: 120,
  },
  {
    gameSlug: "kirby-and-the-forgotten-land",
    type: "out_now",
    headline: "Kirby DLC Wave 2 is available now",
    subtext: "Free update for all owners",
    hoursAgo: 168,
  },
];

// ── Seed runner ───────────────────────────────────────────────
async function seed() {
  console.log("Seeding games...");
  const { data: insertedGames, error: gamesErr } = await supabase
    .from("games")
    .upsert(games, { onConflict: "slug" })
    .select("id, slug");

  if (gamesErr) {
    console.error("Error inserting games:", gamesErr);
    process.exit(1);
  }
  console.log(`  Inserted ${insertedGames!.length} games`);

  const slugToId = new Map<string, string>();
  for (const g of insertedGames!) {
    slugToId.set(g.slug, g.id);
  }

  console.log("Seeding franchises...");
  const { data: insertedFranchises, error: franchisesErr } = await supabase
    .from("franchises")
    .upsert(franchises, { onConflict: "name" })
    .select("id, name");

  if (franchisesErr) {
    console.error("Error inserting franchises:", franchisesErr);
    process.exit(1);
  }
  console.log(`  Inserted ${insertedFranchises!.length} franchises`);

  console.log("Seeding alerts...");
  const alertRows = alertsDef.map((a) => {
    const gameId = slugToId.get(a.gameSlug);
    if (!gameId) {
      console.error(`  Game not found for slug: ${a.gameSlug}`);
      process.exit(1);
    }
    const createdAt = new Date(Date.now() - a.hoursAgo * 60 * 60 * 1000).toISOString();
    return {
      game_id: gameId,
      type: a.type,
      headline: a.headline,
      subtext: a.subtext,
      created_at: createdAt,
    };
  });

  // Delete existing alerts and re-insert to avoid duplicates
  await supabase.from("alerts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  const { error: alertsErr } = await supabase.from("alerts").insert(alertRows);

  if (alertsErr) {
    console.error("Error inserting alerts:", alertsErr);
    process.exit(1);
  }
  console.log(`  Inserted ${alertRows.length} alerts`);

  console.log("Done!");
}

seed().catch(console.error);
