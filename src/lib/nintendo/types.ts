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
  platform: string;
  corePlatforms: string[];
  esrbRating: string;
  freeToStart: boolean;
  objectID: string;
  topLevelCategoryCode: string;
  eshopDetails?: unknown;
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
