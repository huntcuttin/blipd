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

  // ── DEAL QUALITY (0-70 pts) ─────────────────────────────────
  // This is a price tracker — deals are the primary signal
  if (game.isOnSale) {
    score += 35;

    // Discount depth: up to +25 for 50%+ off
    const disc = game.discount ?? 0;
    score += Math.min(Math.floor(disc * 0.5), 25);

    // All-time low is the killer signal
    if (game.isAllTimeLow) score += 20;

    // Sale ending soon — urgency (within 3 days)
    if (game.saleEndDate) {
      const endDate = new Date(game.saleEndDate);
      const daysLeft = Math.round((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 1) score += 15;
      else if (daysLeft <= 3) score += 8;
    }
  }

  // ── GAME QUALITY (0-20 pts) ─────────────────────────────────
  if (game.metacriticScore !== null) {
    if (game.metacriticScore >= 90) score += 20;
    else if (game.metacriticScore >= 80) score += 12;
    else if (game.metacriticScore >= 70) score += 6;
  }

  // ── PUBLISHER TIER (0-40 pts) ───────────────────────────────
  // Nintendo 1st party always surface prominently — they're the core of the Switch library.
  // Reputable 3rd party ranked above random eShop shovelware.
  if (game.franchise) {
    if (NINTENDO_1ST_PARTY.has(game.franchise)) score += 40;
    else if (REPUTABLE_3RD_PARTY.has(game.franchise)) score += 20;
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

// Keep old alias for backward compat
export function computeGameScore(game: Game): number {
  return computeTrendingScore(game);
}
