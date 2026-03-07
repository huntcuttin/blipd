import type { AlgoliaHit } from "./types";

const LANGUAGE_PREFIX = /^\((English|French|Spanish|German|Italian|Dutch|Japanese|Korean|Chinese|Portuguese|Russian)\)\s/i;

export function isEnglishGame(hit: AlgoliaHit): boolean {
  return !LANGUAGE_PREFIX.test(hit.title);
}

const NON_GAME_PATTERNS = /\b(DLC|Season Pass|Expansion Pass|Bundle|Pack|Transfer Tool|Membership|Online Service|Voucher|Demo|Trial|Starter Edition)\b/i;
const FREE_UTILITY = /\b(Transfer Tool|Online Service|Membership|Voucher)\b/i;

export function isStandaloneGame(hit: AlgoliaHit): boolean {
  // Filter out free utilities ($0 items that aren't real games)
  if (hit.msrp <= 0 && FREE_UTILITY.test(hit.title)) return false;
  // Filter out DLC, season passes, bundles, demos, etc.
  if (NON_GAME_PATTERNS.test(hit.title)) return false;
  return true;
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function computeReleaseStatus(releaseDate: string): "released" | "upcoming" | "out_today" {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const release = releaseDate.split("T")[0];

  if (release === todayStr) return "out_today";
  if (release > todayStr) return "upcoming";
  return "released";
}

export function isAllTimeLow(
  currentPrice: number,
  priceHistory: { date: string; price: number }[]
): boolean {
  if (priceHistory.length === 0) return false;
  return priceHistory.every((entry) => currentPrice < entry.price);
}

export function computeDiscount(currentPrice: number, originalPrice: number): number {
  if (originalPrice <= 0 || currentPrice >= originalPrice) return 0;
  return Math.round((1 - currentPrice / originalPrice) * 100);
}

function parseReleaseDate(releaseDateDisplay: string): string {
  if (!releaseDateDisplay || releaseDateDisplay === "TBD") {
    return "2099-12-31";
  }
  const parsed = new Date(releaseDateDisplay);
  if (isNaN(parsed.getTime())) return "2099-12-31";
  return parsed.toISOString().split("T")[0];
}

const NINTENDO_CDN_PREFIX =
  "https://assets.nintendo.com/image/upload/ar_16:9,b_auto:border,c_lpad/b_white/f_auto/q_auto/dpr_1.5/c_scale,w_400/";

function buildCoverArtUrl(hit: AlgoliaHit): string {
  if (hit.productImage) {
    return `${NINTENDO_CDN_PREFIX}${hit.productImage}`;
  }
  return hit.productImageSquare || hit.horizontalHeaderImage || hit.boxart || "";
}

const FRANCHISE_KEYWORDS: [RegExp, string][] = [
  [/\bzelda\b/i, "The Legend of Zelda"],
  [/\bmario kart\b/i, "Mario Kart"],
  [/\bmario party\b/i, "Mario Party"],
  [/\bmario strikers\b/i, "Mario Strikers"],
  [/\bmario tennis\b/i, "Mario Tennis"],
  [/\bmario golf\b/i, "Mario Golf"],
  [/\bpaper mario\b/i, "Paper Mario"],
  [/\bmario \+ rabbids\b/i, "Mario + Rabbids"],
  [/\bmario vs\b/i, "Mario vs. Donkey Kong"],
  [/\bsuper mario\b/i, "Super Mario"],
  [/\bmario\b/i, "Mario"],
  [/\bpokémon|pokemon\b/i, "Pokemon"],
  [/\bkirby\b/i, "Kirby"],
  [/\bmetroid\b/i, "Metroid"],
  [/\bsplatoon\b/i, "Splatoon"],
  [/\banimal crossing\b/i, "Animal Crossing"],
  [/\bfire emblem\b/i, "Fire Emblem"],
  [/\bsmash bros\b/i, "Super Smash Bros."],
  [/\bxenoblade\b/i, "Xenoblade Chronicles"],
  [/\bdonkey kong\b/i, "Donkey Kong"],
  [/\byoshi\b/i, "Yoshi"],
  [/\bstar fox\b/i, "Star Fox"],
  [/\bf-zero\b/i, "F-Zero"],
  [/\bpikmin\b/i, "Pikmin"],
  [/\bbayonetta\b/i, "Bayonetta"],
  [/\bastral chain\b/i, "Astral Chain"],
  [/\bmonster hunter\b/i, "Monster Hunter"],
  [/\bstreet fighter\b/i, "Street Fighter"],
  [/\bmega man\b/i, "Mega Man"],
  [/\bresident evil\b/i, "Resident Evil"],
  [/\bace attorney\b/i, "Ace Attorney"],
  [/\bdevil may cry\b/i, "Devil May Cry"],
  [/\bfinal fantasy\b/i, "Final Fantasy"],
  [/\bdragon quest\b/i, "Dragon Quest"],
  [/\bkingdom hearts\b/i, "Kingdom Hearts"],
  [/\bpersona\b/i, "Persona"],
  [/\bshin megami\b/i, "Shin Megami Tensei"],
  [/\bsonic\b/i, "Sonic"],
  [/\btales of\b/i, "Tales of"],
  [/\bdark souls\b/i, "Dark Souls"],
  [/\bcastlevania\b/i, "Castlevania"],
  [/\bmetal gear\b/i, "Metal Gear"],
  [/\bsuikoden\b/i, "Suikoden"],
  [/\bcontra\b/i, "Contra"],
  [/\bnba 2k\b/i, "NBA 2K"],
  [/\bfifa\b/i, "FIFA"],
  [/\bjust dance\b/i, "Just Dance"],
  [/\bassist creed\b/i, "Assassin's Creed"],
  [/\bdiablo\b/i, "Diablo"],
  [/\bwolfenstein\b/i, "Wolfenstein"],
  [/\bdoom\b/i, "DOOM"],
  [/\bthe witcher\b/i, "The Witcher"],
  [/\bcivilization\b/i, "Civilization"],
  [/\bharvest moon\b/i, "Harvest Moon"],
  [/\bstory of seasons\b/i, "Story of Seasons"],
  [/\brune factory\b/i, "Rune Factory"],
  [/\batelier\b/i, "Atelier"],
  [/\bdisgaea\b/i, "Disgaea"],
  [/\blego\b/i, "LEGO"],
  [/\blayton\b/i, "Professor Layton"],
  [/\bno more heroes\b/i, "No More Heroes"],
  [/\btrail[s]?\b.*\b(sky|steel|cold|azure|zero|reverie|daybreak)\b/i, "Trails"],
  [/\bys\b/i, "Ys"],
  [/\bhyrule warriors\b/i, "Hyrule Warriors"],
  [/\bwarriors\b.*\b(age|calamity)\b/i, "Hyrule Warriors"],
  [/\btriangle strategy\b/i, "Triangle Strategy"],
  [/\boctopath\b/i, "Octopath Traveler"],
  [/\bbravely\b/i, "Bravely Default"],
  [/\bwarioware\b/i, "WarioWare"],
  [/\bwario\b/i, "Wario"],
  [/\bluigi.s mansion\b/i, "Luigi's Mansion"],
  [/\badvance wars\b/i, "Advance Wars"],
  [/\bfatal frame\b/i, "Fatal Frame"],
  [/\bring fit\b/i, "Ring Fit"],
  [/\bnintendo switch sports\b/i, "Nintendo Switch Sports"],
  [/\b1-2-switch\b/i, "1-2-Switch"],
  [/^ARMS(?:\s|™|$)/, "ARMS"],
  [/\bcaptain toad\b/i, "Captain Toad"],
  [/\bnintendo labo\b/i, "Nintendo Labo"],
];

// Patterns to strip when normalizing titles for duplicate matching
const EDITION_SUFFIXES = [
  /\s*[–—-]\s*Nintendo Switch™?\s*2\s*Edition\s*(Upgrade\s*Pack)?/i,
  /\s*[–—-]\s*Nintendo Switch\s*2\s*Edition\s*(Upgrade\s*Pack)?/i,
  /\s*Upgrade\s*Pack$/i,
  /\s*[–—-]\s*Switch\s*2\s*Edition$/i,
];
const REGIONAL_PREFIX = /^\((English|French|Spanish|German|Italian|Dutch|Japanese|Korean|Chinese|Portuguese|Russian)\)\s*/i;

export function normalizeTitle(title: string): string {
  let normalized = title;
  for (const pattern of EDITION_SUFFIXES) {
    normalized = normalized.replace(pattern, "");
  }
  normalized = normalized.replace(REGIONAL_PREFIX, "");
  return normalized.trim();
}

export function isSwitch2Edition(title: string): boolean {
  return /Nintendo Switch™?\s*2\s*Edition/i.test(title) && !/Upgrade\s*Pack/i.test(title);
}

export function isUpgradePack(title: string): boolean {
  return /Upgrade\s*Pack/i.test(title);
}

export function isRegionalVariant(title: string): boolean {
  return REGIONAL_PREFIX.test(title);
}

const FRANCHISE_NAME_MAP: Record<string, string> = {
  "Pokémon": "Pokemon",
};

function normalizeFranchiseName(name: string): string {
  return FRANCHISE_NAME_MAP[name] || name;
}

export function detectFranchise(title: string): string | null {
  for (const [pattern, franchise] of FRANCHISE_KEYWORDS) {
    if (pattern.test(title)) return franchise;
  }
  return null;
}

export function algoliaHitToGameRow(hit: AlgoliaHit) {
  const title = hit.title;
  const slug = hit.slug || generateSlug(title);
  const coverArt = buildCoverArtUrl(hit);
  const msrp = hit.msrp ?? 0;
  const salePrice = hit.salePrice;
  const currentPrice = salePrice != null && salePrice < msrp ? salePrice : msrp;
  const discount = computeDiscount(currentPrice, msrp);
  const isOnSale = salePrice != null && salePrice < msrp;
  const releaseDate = parseReleaseDate(hit.releaseDateDisplay);
  // If release date is unknown but game has a real price, it's almost certainly released
  const releaseStatus = releaseDate === "2099-12-31" && msrp > 0
    ? "released"
    : computeReleaseStatus(releaseDate);
  const publisher = hit.softwarePublisher || "Unknown";
  const franchiseStr = typeof hit.franchises === "string" ? hit.franchises : "";
  const rawFranchise = franchiseStr.length > 0 && franchiseStr !== "[]" && franchiseStr.trim() !== "" ? franchiseStr : null;
  const detectedFranchise = rawFranchise || detectFranchise(title);
  // Normalize known variants (e.g. "Pokémon" → "Pokemon" to match detectFranchise output)
  const franchise = detectedFranchise ? normalizeFranchiseName(detectedFranchise) : null;

  return {
    nsuid: hit.nsuid || null,
    slug,
    title,
    publisher,
    franchise,
    cover_art: coverArt,
    current_price: currentPrice,
    original_price: msrp,
    discount,
    is_on_sale: isOnSale,
    is_all_time_low: false,
    release_date: releaseDate,
    release_status: releaseStatus,
    price_history: [{ date: new Date().toISOString().slice(0, 7), price: currentPrice }],
    nintendo_url: hit.url ? `https://www.nintendo.com${hit.url}` : null,
  };
}
