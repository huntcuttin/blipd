import type { AlgoliaSearchResponse } from "./types";

/**
 * Nintendo's public Algolia storefront index, same credentials and index the
 * web app uses. Mobile only ever reads it for search: relevance-ranked results
 * beat an ILIKE scan badly, and "if a user searches for a game and it isn't
 * there, they lose trust immediately" is the single most repeated complaint in
 * this category (see Competitor Intelligence in CLAUDE.md).
 *
 * Deliberately a trimmed copy rather than a shared package: the web module
 * also carries the price API and the whole catalog-sync fetch strategy, none
 * of which mobile should ever run.
 */
const ALGOLIA_APP_ID = "U3B6GR4UA3";
const ALGOLIA_API_KEY = "a29c6927638bfd8cee23993e51e721c9";
const ALGOLIA_URL = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/store_all_products_en_us/query`;

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
      throw new Error(`Algolia API returned ${response.status}`);
    }

    return (await response.json()) as AlgoliaSearchResponse;
  } finally {
    clearTimeout(timeout);
  }
}
