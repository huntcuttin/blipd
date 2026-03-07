import type { Game } from "@/lib/types";

const MAJOR_PUBLISHERS = new Set([
  "CAPCOM", "Capcom",
  "Square Enix", "SQUARE ENIX",
  "Bandai Namco Entertainment", "BANDAI NAMCO Entertainment",
  "SEGA", "Sega",
  "Ubisoft",
  "Konami", "KONAMI",
  "Atlus", "ATLUS",
  "Bethesda", "Bethesda Softworks",
  "Electronic Arts", "EA",
  "2K", "2K Games",
  "Activision",
  "Warner Bros. Games",
]);

export function computeGameScore(game: Game): number {
  let score = 0;

  // Franchise bonus
  if (game.franchise) score += 30;

  // Publisher bonus
  if (game.publisher === "Nintendo") {
    score += 20;
  } else if (MAJOR_PUBLISHERS.has(game.publisher)) {
    score += 10;
  }

  // Price signal (AAA indicator)
  if (game.originalPrice >= 40) {
    score += 10;
  } else if (game.originalPrice >= 20) {
    score += 5;
  }

  return score;
}
