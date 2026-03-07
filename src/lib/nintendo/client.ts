import type { AlgoliaSearchResponse, NintendoPriceResponse, NintendoPriceEntry } from "./types";

const ALGOLIA_APP_ID = "U3B6GR4UA3";
const ALGOLIA_API_KEY = "a29c6927638bfd8cee23993e51e721c9";
const ALGOLIA_URL = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/store_all_products_en_us/query`;
const PRICE_API_URL = "https://api.ec.nintendo.com/v1/price";
const PRICE_BATCH_SIZE = 50;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchGameCatalog(options: {
  query?: string;
  page?: number;
  hitsPerPage?: number;
  filters?: string;
}): Promise<AlgoliaSearchResponse> {
  const { query = "", page = 0, hitsPerPage = 500, filters } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const body: Record<string, unknown> = { query, page, hitsPerPage };
    if (filters) body.filters = filters;

    const response = await fetch(ALGOLIA_URL, {
      method: "POST",
      headers: {
        "X-Algolia-Application-Id": ALGOLIA_APP_ID,
        "X-Algolia-API-Key": ALGOLIA_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Algolia API returned ${response.status}: ${await response.text()}`);
    }

    return (await response.json()) as AlgoliaSearchResponse;
  } finally {
    clearTimeout(timeout);
  }
}

// Algolia search caps at 1000 results per query. Split by price ranges
// to get full catalog coverage.
const PRICE_RANGES = [
  "msrp < 10",
  "msrp >= 10 AND msrp < 30",
  "msrp >= 30 AND msrp < 60",
  "msrp >= 60",
];

const PLATFORM_FILTER = '(platform:"Nintendo Switch" OR platform:"Nintendo Switch 2")';

async function fetchAllPages(
  baseFilter: string,
  onPage?: (page: number, total: number) => void,
  pageOffset?: number
): Promise<AlgoliaSearchResponse["hits"]> {
  const hits: AlgoliaSearchResponse["hits"] = [];
  let page = 0;

  while (true) {
    const result = await fetchGameCatalog({
      hitsPerPage: 500,
      page,
      filters: baseFilter,
    });

    hits.push(...result.hits);
    onPage?.(
      (pageOffset ?? 0) + page + 1,
      (pageOffset ?? 0) + result.nbPages
    );

    if (page + 1 >= result.nbPages) break;
    page++;
    await delay(200);
  }

  return hits;
}

export async function fetchAllGames(
  onPage?: (page: number, total: number) => void
): Promise<AlgoliaSearchResponse["hits"]> {
  const allHits: AlgoliaSearchResponse["hits"] = [];
  const seen = new Set<string>();
  let pageOffset = 0;

  for (const priceRange of PRICE_RANGES) {
    const filter = `topLevelCategoryCode:GAMES AND ${PLATFORM_FILTER} AND ${priceRange}`;
    const hits = await fetchAllPages(filter, onPage, pageOffset);
    pageOffset += Math.ceil(hits.length / 500);

    for (const hit of hits) {
      const key = hit.nsuid || hit.objectID;
      if (!seen.has(key)) {
        seen.add(key);
        allHits.push(hit);
      }
    }
  }

  return allHits;
}

export async function fetchPrices(nsuids: string[]): Promise<NintendoPriceEntry[]> {
  const allPrices: NintendoPriceEntry[] = [];

  for (let i = 0; i < nsuids.length; i += PRICE_BATCH_SIZE) {
    const batch = nsuids.slice(i, i + PRICE_BATCH_SIZE);
    const ids = batch.join(",");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${PRICE_API_URL}?country=US&lang=en&ids=${ids}`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        console.error(`Price API returned ${response.status} for batch starting at index ${i}`);
        continue;
      }

      const data = (await response.json()) as NintendoPriceResponse;
      allPrices.push(...data.prices);
    } catch (error) {
      console.error(`Price API error for batch starting at index ${i}:`, error);
    } finally {
      clearTimeout(timeout);
    }

    if (i + PRICE_BATCH_SIZE < nsuids.length) {
      await delay(100);
    }
  }

  return allPrices;
}
