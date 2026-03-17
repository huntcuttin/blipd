import type { Game } from "@/lib/types";

// Nintendo 1st party franchises — top tier, always show prominently
const NINTENDO_1ST_PARTY = new Set([
  "The Legend of Zelda", "Super Mario", "Mario Kart", "Mario Party", "Paper Mario",
  "Mario + Rabbids", "Pokémon", "Kirby", "Metroid", "Donkey Kong", "Pikmin",
  "Fire Emblem", "Xenoblade Chronicles", "Splatoon", "Animal Crossing", "Star Fox",
  "F-Zero", "WarioWare", "Yoshi", "Bayonetta", "ARMS", "Super Smash Bros.",
  "Astral Chain", "Luigi's Mansion", "Nintendo Switch Sports", "Ring Fit Adventure",
]);

// Reputable 3rd party franchises — critically acclaimed or major sellers
const REPUTABLE_3RD_PARTY = new Set([
  "Sonic the Hedgehog", "Mega Man", "Castlevania", "Street Fighter", "Monster Hunter",
  "Final Fantasy", "Dragon Quest", "Octopath Traveler", "Triangle Strategy",
  "Persona", "Ace Attorney", "Danganronpa",
  "Shovel Knight", "Hollow Knight", "Dead Cells", "Hades", "Cuphead", "Stardew Valley",
  "Celeste", "Ori", "Terraria", "Minecraft", "Vampire Survivors",
  "FromSoftware", "The Witcher", "Cyberpunk", "Disco Elysium", "Dave the Diver",
  "Overwatch", "Diablo", "Borderlands", "Katamari", "Okami", "Professor Layton",
  "BioShock", "Klonoa", "Fall Guys", "Among Us", "Fortnite",
]);

// Reputable publishers — even without franchise tags, these aren't shovelware
const REPUTABLE_PUBLISHERS = new Set([
  "Nintendo", "Capcom", "Square Enix", "Bandai Namco", "Sega", "Konami",
  "Ubisoft", "Devolver Digital", "Annapurna Interactive", "Team17",
  "505 Games", "Focus Entertainment", "THQ Nordic", "Atlus",
  "Playdead", "Supergiant Games", "ConcernedApe", "Re-Logic",
  "FromSoftware", "CD PROJEKT RED", "Larian Studios", "Naughty Dog",
  "Bethesda", "Electronic Arts", "Activision", "2K Games",
  "Warner Bros.", "Koei Tecmo", "NIS America", "XSEED Games",
  "Dangen Entertainment", "Raw Fury", "Yacht Club Games",
]);

export function computeTrendingScore(
  game: Game,
  options?: {
    followedFranchises?: Set<string>;
  }
): number {
  let score = 0;
  const now = new Date();
  const releaseDate = new Date(game.releaseDate);
  const daysSinceRelease = Math.round(
    (now.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const msrp = game.originalPrice ?? 0;
  const metacritic = game.metacriticScore ?? 0;

  // ── GAME QUALITY (0-50 pts) ─────────────────────────────────
  // This is the primary anti-shovelware signal. Great games rise,
  // regardless of whether they're on sale.
  if (game.metacriticScore !== null) {
    if (metacritic >= 90) score += 50;
    else if (metacritic >= 85) score += 40;
    else if (metacritic >= 80) score += 30;
    else if (metacritic >= 75) score += 20;
    else if (metacritic >= 70) score += 12;
    else if (metacritic >= 60) score += 5;
    // Below 60: no quality points
  }

  // ── DEAL QUALITY (0-50 pts) ─────────────────────────────────
  // Deals matter, but only on good games
  if (game.isOnSale) {
    // Base deal signal — scaled by game quality
    // A sale on a great game (80+) gets full 25 base pts
    // A sale on an unrated game gets 15 base pts
    // A sale on a low-rated game (<60) gets only 8 base pts
    if (metacritic >= 80) score += 25;
    else if (metacritic >= 70) score += 20;
    else if (metacritic >= 60 || game.metacriticScore === null) score += 15;
    else score += 8;

    // Discount depth: up to +15 for deep discounts
    const disc = game.discount ?? 0;
    score += Math.min(Math.floor(disc * 0.3), 15);

    // All-time low is the killer signal
    if (game.isAllTimeLow) score += 15;

    // Sale ending soon — urgency (within 3 days)
    if (game.saleEndDate) {
      const endDate = new Date(game.saleEndDate);
      const daysLeft = Math.round((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 1) score += 10;
      else if (daysLeft <= 3) score += 5;
    }
  }

  // ── PUBLISHER / FRANCHISE TIER (0-40 pts) ─────────────────────
  // Nintendo 1st party always surface prominently
  if (game.franchise) {
    if (NINTENDO_1ST_PARTY.has(game.franchise)) score += 40;
    else if (REPUTABLE_3RD_PARTY.has(game.franchise)) score += 25;
  } else if (game.publisher && REPUTABLE_PUBLISHERS.has(game.publisher)) {
    // No franchise tag but reputable publisher — still not shovelware
    score += 15;
  }

  // ── PRICE TIER PENALTY (0 to -20 pts) ──────────────────────
  // Cheap games with no critical acclaim sink. Great cheap games (Inside,
  // Celeste, Vampire Survivors) are protected by their metacritic score.
  if (msrp > 0 && msrp < 5 && metacritic < 75) {
    score -= 20;
  } else if (msrp >= 5 && msrp < 10 && metacritic < 70) {
    score -= 10;
  } else if (msrp >= 10 && msrp < 15 && metacritic < 60) {
    score -= 5;
  }

  // ── RECENCY (0-15 pts) ─────────────────────────────────────
  // New releases deserve discovery exposure
  if (daysSinceRelease >= 0 && daysSinceRelease <= 14) score += 15;
  else if (daysSinceRelease <= 30) score += 10;
  else if (daysSinceRelease <= 90) score += 5;

  // ── PERSONALIZATION (0-25 pts) ─────────────────────────────
  // Franchise the user follows — boost heavily
  if (options?.followedFranchises && game.franchise && options.followedFranchises.has(game.franchise)) {
    score += 25;
  }

  return score;
}

/**
 * Determine if a game qualifies for the "Rarely on sale" badge.
 * Uses price history to detect games that almost never go on sale.
 * A game is "rarely on sale" if it has very few sale periods in its tracked history
 * and its MSRP is $20+ (cheap games being on sale isn't notable).
 */
export function isRarelyOnSale(game: Game): boolean {
  // Must be currently on sale — badge only makes sense in a sale context
  if (!game.isOnSale) return false;

  // Only meaningful for games with a real MSRP
  if (game.originalPrice < 20) return false;

  // Nintendo 1st party games rarely go on sale — always flag them
  if (game.franchise && NINTENDO_1ST_PARTY.has(game.franchise)) return true;

  // Use price history to count how often the game has been on sale
  const history = game.priceHistory ?? [];
  if (history.length < 5) return false; // not enough data

  // Count transitions from full price to a lower price (sale start events)
  let saleTransitions = 0;
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1].price;
    const curr = history[i].price;
    const msrp = game.originalPrice;
    // A transition from near-MSRP to discounted counts as a sale start
    if (prev >= msrp * 0.95 && curr < msrp * 0.9) {
      saleTransitions++;
    }
  }

  // 0-1 sale transitions in tracked history = rarely on sale
  return saleTransitions <= 1;
}

// Keep old alias for backward compat
export function computeGameScore(game: Game): number {
  return computeTrendingScore(game);
}
