import type { Game } from "@/lib/types";

// Franchises that signal a higher-quality game
const PRESTIGE_FRANCHISES = new Set([
  "The Legend of Zelda", "Super Mario", "Mario Kart", "Mario Party", "Paper Mario",
  "Pokémon", "Metroid", "Kirby", "Donkey Kong", "Splatoon", "Fire Emblem",
  "Xenoblade Chronicles", "Animal Crossing", "Bayonetta", "Super Smash Bros.",
  "Monster Hunter", "Final Fantasy", "Persona", "Hollow Knight", "Celeste",
  "Hades", "Dead Cells", "Stardew Valley", "Cuphead", "Shovel Knight",
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

  // ── GAME QUALITY (0-25 pts) ─────────────────────────────────
  // Metacritic: real quality signal (Deku Deals surfaces these prominently)
  if (game.metacriticScore !== null) {
    if (game.metacriticScore >= 90) score += 20;
    else if (game.metacriticScore >= 80) score += 12;
    else if (game.metacriticScore >= 70) score += 6;
  }

  // Prestige franchise: signals catalog quality
  if (game.franchise && PRESTIGE_FRANCHISES.has(game.franchise)) score += 8;

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
