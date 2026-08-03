// Raw response types from Nintendo's public APIs

export interface AlgoliaHit {
  title: string;
  nsuid: string;
  slug: string;
  url: string;
  description: string;
  headerImage?: string;
  horizontalHeaderImage?: string;
  boxart?: string;
  productImage: string;
  productImageSquare?: string;
  msrp: number;
  salePrice: number | null;
  lowestPrice: number;
  price: {
    finalPrice: number;
    regPrice: number;
    salePrice: number | null;
  };
  softwarePublisher: string;
  softwareDeveloper: string;
  franchises: string;
  genres?: string[];
  gameGenreLabels?: string[];
  generalFilters: string[];
  availability: string[];
  releaseDateDisplay: string;
  // The reliably-populated ISO release date. releaseDateDisplay is often
  // null even for real, long-released titles (confirmed live 2026-08-03
  // against Super Mario Odyssey and others) — releaseDate is the field
  // that's actually always there.
  releaseDate?: string;
  platform: string;
  corePlatforms: string[];
  esrbRating: string;
  freeToStart: boolean;
  objectID: string;
  topLevelCategoryCode: string;
  // productType: "TITLE" for a real standalone game, "ADD_ON_CONTENT" for
  // DLC/cosmetics/soundtracks/etc — confirmed live 2026-08-03 (e.g. "Taiko
  // no Tatsujin: Rhythm Festival - Habit", a $1.49 song pack, vs. a real
  // game like Super Mario Odyssey). Far more reliable than title regex.
  eshopDetails?: { productType?: string };
  topLevelFilters?: string[];
  hasDlc?: boolean;
  editions?: string[];
}

export interface AlgoliaSearchResponse {
  hits: AlgoliaHit[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
}

export interface NintendoPriceEntry {
  title_id: number;
  sales_status: string;
  regular_price?: {
    amount: string;
    currency: string;
    raw_value: string;
  };
  discount_price?: {
    amount: string;
    currency: string;
    raw_value: string;
    start_datetime: string;
    end_datetime: string;
  };
}

export interface NintendoPriceResponse {
  prices: NintendoPriceEntry[];
  personalized: boolean;
  country: string;
}
