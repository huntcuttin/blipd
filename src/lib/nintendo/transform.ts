import type { AlgoliaHit } from "./types";

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

export function algoliaHitToGameRow(hit: AlgoliaHit) {
  const title = hit.title;
  // Prefer the slug from Nintendo's API, fall back to generating one
  const slug = hit.slug || generateSlug(title);
  const coverArt = hit.horizontalHeaderImage || hit.boxart || hit.productImage || "";
  const msrp = hit.msrp ?? 0;
  const salePrice = hit.salePrice;
  const currentPrice = salePrice != null && salePrice < msrp ? salePrice : msrp;
  const discount = computeDiscount(currentPrice, msrp);
  const isOnSale = salePrice != null && salePrice < msrp;
  const releaseDate = parseReleaseDate(hit.releaseDateDisplay);
  const releaseStatus = computeReleaseStatus(releaseDate);
  const publisher = hit.publishers?.[0] || "Unknown";
  // Use the franchises field from Nintendo's API directly
  const franchise = hit.franchises || null;

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
