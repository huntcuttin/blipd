/**
 * Minimal slice of the web app's Nintendo types: only what mobile's search
 * path touches. The full definitions live in the web repo at
 * src/lib/nintendo/types.ts — mobile has no ingest pipeline, so it needs the
 * Algolia search shapes and nothing else.
 */
export interface AlgoliaHit {
  title: string;
  nsuid: string;
  slug?: string;
  msrp?: number;
  salePrice?: number | null;
  softwarePublisher?: string;
  platform?: string;
  eshopDetails?: {
    productType?: string;
  };
}

export interface AlgoliaSearchResponse {
  hits: AlgoliaHit[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
}
