import type { Game } from "@/lib/types";

const MAJOR_FRANCHISES = new Set([
  "The Legend of Zelda", "Mario", "Super Mario", "Mario Kart",
  "Pokemon", "Metroid", "Kirby", "Donkey Kong", "Splatoon",
  "Fire Emblem", "Xenoblade Chronicles", "Animal Crossing",
]);

export function computeTrendingScore(
  game: Game,
  options?: {
    followedFranchises?: Set<string>;
    maxFollowCount?: number;
    gameFollowCount?: number;
  }
): number {
  let score = 0;
  const now = new Date();
  const releaseDate = new Date(game.releaseDate);
  const daysSinceRelease = Math.round(
    (now.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysUntilRelease = -daysSinceRelease;

  // Recency: upcoming
  if (daysUntilRelease > 0 && daysUntilRelease <= 14) score += 50;
  else if (daysUntilRelease > 14 && daysUntilRelease <= 30) score += 30;

  // Recently released
  if (daysSinceRelease >= 0 && daysSinceRelease <= 30) score += 10;

  // Sale signals
  if (game.isOnSale) score += 25;
  if (game.isAllTimeLow) score += 20;

  // Publisher
  if (game.publisher === "Nintendo") score += 20;

  // Major franchise
  if (game.franchise && MAJOR_FRANCHISES.has(game.franchise)) score += 15;

  // Metacritic
  if (game.metacriticScore !== null && game.metacriticScore >= 85) score += 10;

  // Follow count (normalized 0-10)
  if (options?.maxFollowCount && options.maxFollowCount > 0 && options.gameFollowCount) {
    score += Math.round((options.gameFollowCount / options.maxFollowCount) * 10);
  }

  // Personalization: user follows this franchise
  if (options?.followedFranchises && game.franchise && options.followedFranchises.has(game.franchise)) {
    score += 20;
  }

  return score;
}

// Keep old function name as alias for backward compat in non-trending contexts
export function computeGameScore(game: Game): number {
  return computeTrendingScore(game);
}
