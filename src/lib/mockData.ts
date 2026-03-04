// ── Types ──────────────────────────────────────────────────────

export interface Game {
  id: string;
  slug: string;
  title: string;
  publisher: string;
  franchise?: string;
  coverArt: string;
  currentPrice: number;
  originalPrice: number;
  discount: number;
  isOnSale: boolean;
  isAllTimeLow: boolean;
  releaseDate: string; // ISO date string
  releaseStatus: "released" | "upcoming" | "out_today";
  priceHistory: { date: string; price: number }[];
}

export interface Franchise {
  id: string;
  name: string;
  gameCount: number;
}

export type AlertType =
  | "price_drop"
  | "all_time_low"
  | "out_now"
  | "sale_started"
  | "release_today"
  | "announced";

export interface GameAlert {
  id: string;
  gameId: string;
  gameTitle: string;
  gameCoverArt: string;
  type: AlertType;
  headline: string;
  subtext: string;
  timestamp: string;
  timestampGroup: "today" | "yesterday" | "this_week" | "earlier";
  read: boolean;
}

// ── Date helpers ───────────────────────────────────────────────

const _now = new Date();
const _today = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate());

function daysFromNow(days: number): string {
  const d = new Date(_today);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function placeholder(name: string): string {
  const encoded = encodeURIComponent(name);
  return `https://placehold.co/200x200/1a1a1a/666666?text=${encoded}`;
}

// ── Games ──────────────────────────────────────────────────────

export const mockGames: Game[] = [
  {
    id: "1",
    slug: slugify("The Legend of Zelda Tears of the Kingdom"),
    title: "The Legend of Zelda: Tears of the Kingdom",
    publisher: "Nintendo",
    franchise: "The Legend of Zelda",
    coverArt: "/images/covers/zelda-totk.jpg",
    currentPrice: 49.99,
    originalPrice: 69.99,
    discount: 29,
    isOnSale: true,
    isAllTimeLow: false,
    releaseDate: daysFromNow(-300),
    releaseStatus: "released",
    priceHistory: [
      { date: "2025-06", price: 69.99 },
      { date: "2025-09", price: 59.99 },
      { date: "2025-11", price: 54.99 },
      { date: "2026-01", price: 49.99 },
      { date: "2026-02", price: 49.99 },
    ],
  },
  {
    id: "2",
    slug: slugify("Hollow Knight"),
    title: "Hollow Knight",
    publisher: "Team Cherry",
    coverArt: "/images/covers/hollow-knight.jpg",
    currentPrice: 7.49,
    originalPrice: 14.99,
    discount: 50,
    isOnSale: true,
    isAllTimeLow: true,
    releaseDate: daysFromNow(-900),
    releaseStatus: "released",
    priceHistory: [
      { date: "2025-03", price: 14.99 },
      { date: "2025-07", price: 9.99 },
      { date: "2025-11", price: 9.99 },
      { date: "2026-01", price: 7.49 },
      { date: "2026-02", price: 7.49 },
    ],
  },
  {
    id: "3",
    slug: slugify("Metroid Prime Remastered"),
    title: "Metroid Prime Remastered",
    publisher: "Nintendo",
    franchise: "Metroid",
    coverArt: "/images/covers/metroid-prime-remastered.jpg",
    currentPrice: 29.99,
    originalPrice: 39.99,
    discount: 25,
    isOnSale: true,
    isAllTimeLow: false,
    releaseDate: daysFromNow(-400),
    releaseStatus: "released",
    priceHistory: [
      { date: "2025-05", price: 39.99 },
      { date: "2025-08", price: 34.99 },
      { date: "2025-12", price: 29.99 },
      { date: "2026-01", price: 34.99 },
      { date: "2026-02", price: 29.99 },
    ],
  },
  {
    id: "4",
    slug: slugify("Super Mario Odyssey"),
    title: "Super Mario Odyssey",
    publisher: "Nintendo",
    franchise: "Mario",
    coverArt: "/images/covers/super-mario-odyssey.jpg",
    currentPrice: 39.99,
    originalPrice: 59.99,
    discount: 33,
    isOnSale: true,
    isAllTimeLow: false,
    releaseDate: daysFromNow(-1200),
    releaseStatus: "released",
    priceHistory: [
      { date: "2025-04", price: 59.99 },
      { date: "2025-07", price: 49.99 },
      { date: "2025-10", price: 44.99 },
      { date: "2025-12", price: 39.99 },
      { date: "2026-02", price: 39.99 },
    ],
  },
  {
    id: "5",
    slug: slugify("Celeste"),
    title: "Celeste",
    publisher: "Maddy Makes Games",
    coverArt: "/images/covers/celeste.jpg",
    currentPrice: 4.99,
    originalPrice: 19.99,
    discount: 75,
    isOnSale: true,
    isAllTimeLow: true,
    releaseDate: daysFromNow(-1400),
    releaseStatus: "released",
    priceHistory: [
      { date: "2025-03", price: 19.99 },
      { date: "2025-06", price: 9.99 },
      { date: "2025-09", price: 7.99 },
      { date: "2025-12", price: 4.99 },
      { date: "2026-02", price: 4.99 },
    ],
  },
  {
    id: "6",
    slug: slugify("Hades"),
    title: "Hades",
    publisher: "Supergiant Games",
    coverArt: "/images/covers/hades.jpg",
    currentPrice: 12.49,
    originalPrice: 24.99,
    discount: 50,
    isOnSale: true,
    isAllTimeLow: false,
    releaseDate: daysFromNow(-800),
    releaseStatus: "released",
    priceHistory: [
      { date: "2025-05", price: 24.99 },
      { date: "2025-08", price: 17.49 },
      { date: "2025-11", price: 14.99 },
      { date: "2026-01", price: 12.49 },
      { date: "2026-02", price: 12.49 },
    ],
  },
  {
    id: "7",
    slug: slugify("Stardew Valley"),
    title: "Stardew Valley",
    publisher: "ConcernedApe",
    coverArt: "/images/covers/stardew-valley.jpg",
    currentPrice: 14.99,
    originalPrice: 14.99,
    discount: 0,
    isOnSale: false,
    isAllTimeLow: false,
    releaseDate: daysFromNow(-1500),
    releaseStatus: "released",
    priceHistory: [
      { date: "2025-03", price: 14.99 },
      { date: "2025-06", price: 14.99 },
      { date: "2025-09", price: 14.99 },
      { date: "2025-12", price: 14.99 },
      { date: "2026-02", price: 14.99 },
    ],
  },
  {
    id: "8",
    slug: slugify("Disco Elysium"),
    title: "Disco Elysium",
    publisher: "ZA/UM",
    coverArt: "/images/covers/disco-elysium.jpg",
    currentPrice: 9.99,
    originalPrice: 39.99,
    discount: 75,
    isOnSale: true,
    isAllTimeLow: true,
    releaseDate: daysFromNow(-600),
    releaseStatus: "released",
    priceHistory: [
      { date: "2025-04", price: 39.99 },
      { date: "2025-07", price: 19.99 },
      { date: "2025-10", price: 14.99 },
      { date: "2026-01", price: 9.99 },
      { date: "2026-02", price: 9.99 },
    ],
  },
  {
    id: "9",
    slug: slugify("Pokemon Scarlet"),
    title: "Pokémon Scarlet",
    publisher: "Nintendo",
    franchise: "Pokémon",
    coverArt: "/images/covers/pokemon-scarlet.jpg",
    currentPrice: 49.99,
    originalPrice: 59.99,
    discount: 17,
    isOnSale: true,
    isAllTimeLow: false,
    releaseDate: daysFromNow(-500),
    releaseStatus: "released",
    priceHistory: [
      { date: "2025-06", price: 59.99 },
      { date: "2025-09", price: 54.99 },
      { date: "2025-12", price: 49.99 },
      { date: "2026-01", price: 54.99 },
      { date: "2026-02", price: 49.99 },
    ],
  },
  {
    id: "10",
    slug: slugify("Fire Emblem Engage"),
    title: "Fire Emblem Engage",
    publisher: "Nintendo",
    franchise: "Fire Emblem",
    coverArt: "/images/covers/fire-emblem-engage.jpg",
    currentPrice: 35.99,
    originalPrice: 59.99,
    discount: 40,
    isOnSale: true,
    isAllTimeLow: false,
    releaseDate: daysFromNow(-400),
    releaseStatus: "released",
    priceHistory: [
      { date: "2025-05", price: 59.99 },
      { date: "2025-08", price: 44.99 },
      { date: "2025-11", price: 39.99 },
      { date: "2026-01", price: 35.99 },
      { date: "2026-02", price: 35.99 },
    ],
  },
  {
    id: "11",
    slug: slugify("Xenoblade Chronicles 3"),
    title: "Xenoblade Chronicles 3",
    publisher: "Nintendo",
    coverArt: "/images/covers/xenoblade-chronicles-3.jpg",
    currentPrice: 41.99,
    originalPrice: 59.99,
    discount: 30,
    isOnSale: true,
    isAllTimeLow: false,
    releaseDate: daysFromNow(-450),
    releaseStatus: "released",
    priceHistory: [
      { date: "2025-04", price: 59.99 },
      { date: "2025-07", price: 49.99 },
      { date: "2025-10", price: 44.99 },
      { date: "2026-01", price: 41.99 },
      { date: "2026-02", price: 41.99 },
    ],
  },
  {
    id: "12",
    slug: slugify("Splatoon 3"),
    title: "Splatoon 3",
    publisher: "Nintendo",
    coverArt: "/images/covers/splatoon-3.jpg",
    currentPrice: 44.99,
    originalPrice: 59.99,
    discount: 25,
    isOnSale: true,
    isAllTimeLow: false,
    releaseDate: daysFromNow(-500),
    releaseStatus: "released",
    priceHistory: [
      { date: "2025-05", price: 59.99 },
      { date: "2025-08", price: 49.99 },
      { date: "2025-11", price: 44.99 },
      { date: "2026-01", price: 44.99 },
      { date: "2026-02", price: 44.99 },
    ],
  },
  {
    id: "13",
    slug: slugify("Animal Crossing New Horizons"),
    title: "Animal Crossing: New Horizons",
    publisher: "Nintendo",
    coverArt: "/images/covers/animal-crossing.jpg",
    currentPrice: 39.99,
    originalPrice: 59.99,
    discount: 33,
    isOnSale: true,
    isAllTimeLow: false,
    releaseDate: daysFromNow(-1800),
    releaseStatus: "released",
    priceHistory: [
      { date: "2025-03", price: 59.99 },
      { date: "2025-06", price: 49.99 },
      { date: "2025-09", price: 44.99 },
      { date: "2025-12", price: 39.99 },
      { date: "2026-02", price: 39.99 },
    ],
  },
  {
    id: "14",
    slug: slugify("Bayonetta 3"),
    title: "Bayonetta 3",
    publisher: "Nintendo",
    coverArt: "/images/covers/bayonetta-3.jpg",
    currentPrice: 39.99,
    originalPrice: 59.99,
    discount: 33,
    isOnSale: true,
    isAllTimeLow: false,
    releaseDate: daysFromNow(-500),
    releaseStatus: "released",
    priceHistory: [
      { date: "2025-04", price: 59.99 },
      { date: "2025-07", price: 49.99 },
      { date: "2025-10", price: 44.99 },
      { date: "2026-01", price: 39.99 },
      { date: "2026-02", price: 39.99 },
    ],
  },
  {
    id: "15",
    slug: slugify("Kirby and the Forgotten Land"),
    title: "Kirby and the Forgotten Land",
    publisher: "Nintendo",
    franchise: "Kirby",
    coverArt: "/images/covers/kirby-forgotten-land.jpg",
    currentPrice: 44.99,
    originalPrice: 59.99,
    discount: 25,
    isOnSale: true,
    isAllTimeLow: false,
    releaseDate: daysFromNow(-600),
    releaseStatus: "released",
    priceHistory: [
      { date: "2025-03", price: 59.99 },
      { date: "2025-06", price: 54.99 },
      { date: "2025-09", price: 49.99 },
      { date: "2025-12", price: 44.99 },
      { date: "2026-02", price: 44.99 },
    ],
  },
  // ── Upcoming / Recent releases for the Upcoming screen ──
  {
    id: "16",
    slug: slugify("Metroid Prime 4 Beyond"),
    title: "Metroid Prime 4: Beyond",
    publisher: "Nintendo",
    franchise: "Metroid",
    coverArt: "/images/covers/metroid-prime-4.jpg",
    currentPrice: 69.99,
    originalPrice: 69.99,
    discount: 0,
    isOnSale: false,
    isAllTimeLow: false,
    releaseDate: daysFromNow(0),
    releaseStatus: "out_today",
    priceHistory: [{ date: "2026-03", price: 69.99 }],
  },
  {
    id: "17",
    slug: slugify("Professor Layton and the New World of Steam"),
    title: "Professor Layton and the New World of Steam",
    publisher: "Level-5",
    coverArt: "/images/covers/professor-layton.jpg",
    currentPrice: 49.99,
    originalPrice: 49.99,
    discount: 0,
    isOnSale: false,
    isAllTimeLow: false,
    releaseDate: daysFromNow(1),
    releaseStatus: "upcoming",
    priceHistory: [{ date: "2026-03", price: 49.99 }],
  },
  {
    id: "18",
    slug: slugify("Mario and Luigi Brothership"),
    title: "Mario & Luigi: Brothership",
    publisher: "Nintendo",
    franchise: "Mario",
    coverArt: "/images/covers/mario-luigi-brothership.jpg",
    currentPrice: 59.99,
    originalPrice: 59.99,
    discount: 0,
    isOnSale: false,
    isAllTimeLow: false,
    releaseDate: daysFromNow(3),
    releaseStatus: "upcoming",
    priceHistory: [{ date: "2026-03", price: 59.99 }],
  },
  {
    id: "19",
    slug: slugify("Donkey Kong Country Returns HD"),
    title: "Donkey Kong Country Returns HD",
    publisher: "Nintendo",
    coverArt: "/images/covers/dk-returns-hd.jpg",
    currentPrice: 49.99,
    originalPrice: 49.99,
    discount: 0,
    isOnSale: false,
    isAllTimeLow: false,
    releaseDate: daysFromNow(5),
    releaseStatus: "upcoming",
    priceHistory: [{ date: "2026-03", price: 49.99 }],
  },
  {
    id: "20",
    slug: slugify("Pokemon Legends Z-A"),
    title: "Pokémon Legends: Z-A",
    publisher: "Nintendo",
    franchise: "Pokémon",
    coverArt: "/images/covers/pokemon-legends-za.jpg",
    currentPrice: 59.99,
    originalPrice: 59.99,
    discount: 0,
    isOnSale: false,
    isAllTimeLow: false,
    releaseDate: daysFromNow(8),
    releaseStatus: "upcoming",
    priceHistory: [{ date: "2026-03", price: 59.99 }],
  },
  {
    id: "21",
    slug: slugify("Nintendo Switch Sports 2"),
    title: "Nintendo Switch Sports 2",
    publisher: "Nintendo",
    coverArt: placeholder("Switch+Sports+2"),
    currentPrice: 49.99,
    originalPrice: 49.99,
    discount: 0,
    isOnSale: false,
    isAllTimeLow: false,
    releaseDate: daysFromNow(10),
    releaseStatus: "upcoming",
    priceHistory: [{ date: "2026-03", price: 49.99 }],
  },
  {
    id: "22",
    slug: slugify("Pikmin 5"),
    title: "Pikmin 5",
    publisher: "Nintendo",
    coverArt: placeholder("Pikmin+5"),
    currentPrice: 59.99,
    originalPrice: 59.99,
    discount: 0,
    isOnSale: false,
    isAllTimeLow: false,
    releaseDate: daysFromNow(30),
    releaseStatus: "upcoming",
    priceHistory: [{ date: "2026-04", price: 59.99 }],
  },
  {
    id: "23",
    slug: slugify("Zelda Wind Waker HD"),
    title: "The Legend of Zelda: Wind Waker HD",
    publisher: "Nintendo",
    franchise: "The Legend of Zelda",
    coverArt: "/images/covers/zelda-wind-waker-hd.jpg",
    currentPrice: 49.99,
    originalPrice: 49.99,
    discount: 0,
    isOnSale: false,
    isAllTimeLow: false,
    releaseDate: daysFromNow(45),
    releaseStatus: "upcoming",
    priceHistory: [{ date: "2026-04", price: 49.99 }],
  },
  // Recently released (for "New Releases" section)
  {
    id: "24",
    slug: slugify("Kirby Star Allies DX"),
    title: "Kirby Star Allies DX",
    publisher: "Nintendo",
    franchise: "Kirby",
    coverArt: placeholder("Kirby+DX"),
    currentPrice: 59.99,
    originalPrice: 59.99,
    discount: 0,
    isOnSale: false,
    isAllTimeLow: false,
    releaseDate: daysFromNow(-1),
    releaseStatus: "released",
    priceHistory: [{ date: "2026-03", price: 59.99 }],
  },
  {
    id: "25",
    slug: slugify("Fire Emblem Warriors Three Hopes Remaster"),
    title: "Fire Emblem Warriors: Three Hopes Remaster",
    publisher: "Nintendo",
    franchise: "Fire Emblem",
    coverArt: placeholder("FE+Warriors"),
    currentPrice: 39.99,
    originalPrice: 39.99,
    discount: 0,
    isOnSale: false,
    isAllTimeLow: false,
    releaseDate: daysFromNow(-3),
    releaseStatus: "released",
    priceHistory: [{ date: "2026-02", price: 39.99 }],
  },
  {
    id: "26",
    slug: slugify("Pikmin 4 Deluxe"),
    title: "Pikmin 4 Deluxe",
    publisher: "Nintendo",
    coverArt: placeholder("Pikmin+4+DX"),
    currentPrice: 49.99,
    originalPrice: 49.99,
    discount: 0,
    isOnSale: false,
    isAllTimeLow: false,
    releaseDate: daysFromNow(-5),
    releaseStatus: "released",
    priceHistory: [{ date: "2026-02", price: 49.99 }],
  },
];

// ── Franchises ─────────────────────────────────────────────────

export const mockFranchises: Franchise[] = [
  { id: "f1", name: "The Legend of Zelda", gameCount: 47 },
  { id: "f2", name: "Mario", gameCount: 68 },
  { id: "f3", name: "Metroid", gameCount: 18 },
  { id: "f4", name: "Pokémon", gameCount: 42 },
  { id: "f5", name: "Fire Emblem", gameCount: 23 },
  { id: "f6", name: "Kirby", gameCount: 35 },
];

// ── Alerts ─────────────────────────────────────────────────────

export const mockAlerts: GameAlert[] = [
  {
    id: "a1",
    gameId: "1",
    gameTitle: "The Legend of Zelda: Tears of the Kingdom",
    gameCoverArt: "/images/covers/zelda-totk.jpg",
    type: "price_drop",
    headline: "Zelda: TotK dropped to $49.99",
    subtext: "Was $69.99 · Save $20.00",
    timestamp: "2 hours ago",
    timestampGroup: "today",
    read: false,
  },
  {
    id: "a2",
    gameId: "2",
    gameTitle: "Hollow Knight",
    gameCoverArt: "/images/covers/hollow-knight.jpg",
    type: "all_time_low",
    headline: "Hollow Knight — ALL TIME LOW",
    subtext: "$7.49 · Lowest price ever recorded",
    timestamp: "3 hours ago",
    timestampGroup: "today",
    read: false,
  },
  {
    id: "a3",
    gameId: "16",
    gameTitle: "Metroid Prime 4: Beyond",
    gameCoverArt: "/images/covers/metroid-prime-4.jpg",
    type: "out_now",
    headline: "Metroid Prime 4: Beyond is available now",
    subtext: "$69.99 on Nintendo eShop",
    timestamp: "5 hours ago",
    timestampGroup: "today",
    read: false,
  },
  {
    id: "a4",
    gameId: "5",
    gameTitle: "Celeste",
    gameCoverArt: "/images/covers/celeste.jpg",
    type: "sale_started",
    headline: "Celeste sale — 75% off",
    subtext: "$4.99 · Ends Mar 10",
    timestamp: "8 hours ago",
    timestampGroup: "today",
    read: false,
  },
  {
    id: "a5",
    gameId: "17",
    gameTitle: "Professor Layton and the New World of Steam",
    gameCoverArt: "/images/covers/professor-layton.jpg",
    type: "release_today",
    headline: "Professor Layton releases tomorrow at midnight PT",
    subtext: "Pre-order available · $49.99",
    timestamp: "Yesterday",
    timestampGroup: "yesterday",
    read: true,
  },
  {
    id: "a6",
    gameId: "22",
    gameTitle: "Pikmin 5",
    gameCoverArt: placeholder("Pikmin+5"),
    type: "announced",
    headline: "Pikmin 5 just announced for Nintendo Switch",
    subtext: "Coming Spring 2026 · $59.99",
    timestamp: "Yesterday",
    timestampGroup: "yesterday",
    read: true,
  },
  {
    id: "a7",
    gameId: "6",
    gameTitle: "Hades",
    gameCoverArt: "/images/covers/hades.jpg",
    type: "price_drop",
    headline: "Hades dropped to $12.49",
    subtext: "Was $24.99 · Save $12.50",
    timestamp: "2 days ago",
    timestampGroup: "this_week",
    read: true,
  },
  {
    id: "a8",
    gameId: "8",
    gameTitle: "Disco Elysium",
    gameCoverArt: "/images/covers/disco-elysium.jpg",
    type: "all_time_low",
    headline: "Disco Elysium — ALL TIME LOW",
    subtext: "$9.99 · 75% off · Lowest price ever",
    timestamp: "3 days ago",
    timestampGroup: "this_week",
    read: true,
  },
  {
    id: "a9",
    gameId: "10",
    gameTitle: "Fire Emblem Engage",
    gameCoverArt: "/images/covers/fire-emblem-engage.jpg",
    type: "sale_started",
    headline: "Fire Emblem Engage sale — 40% off",
    subtext: "$35.99 · Ends Mar 15",
    timestamp: "5 days ago",
    timestampGroup: "this_week",
    read: true,
  },
  {
    id: "a10",
    gameId: "15",
    gameTitle: "Kirby and the Forgotten Land",
    gameCoverArt: "/images/covers/kirby-forgotten-land.jpg",
    type: "out_now",
    headline: "Kirby DLC Wave 2 is available now",
    subtext: "Free update for all owners",
    timestamp: "1 week ago",
    timestampGroup: "earlier",
    read: true,
  },
];

// ── Helper: find game by slug ──────────────────────────────────

export function getGameBySlug(slug: string): Game | undefined {
  return mockGames.find((g) => g.slug === slug);
}

export function getAlertsForGame(gameId: string): GameAlert[] {
  return mockAlerts.filter((a) => a.gameId === gameId);
}

export function getFranchiseByName(name: string): Franchise | undefined {
  return mockFranchises.find((f) => f.name === name);
}

export function getGamesByFranchise(franchiseName: string): Game[] {
  return mockGames.filter((g) => g.franchise === franchiseName);
}
