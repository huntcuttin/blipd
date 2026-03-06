export interface Game {
  id: string;
  slug: string;
  title: string;
  publisher: string;
  franchise: string | null;
  coverArt: string;
  currentPrice: number;
  originalPrice: number;
  discount: number;
  isOnSale: boolean;
  isAllTimeLow: boolean;
  releaseDate: string;
  releaseStatus: "released" | "upcoming" | "out_today";
  metacriticScore: number | null;
  priceHistory: { date: string; price: number }[];
}

export interface Franchise {
  id: string;
  name: string;
  gameCount: number;
  logo: string;
}

export type AlertType =
  | "price_drop"
  | "all_time_low"
  | "out_now"
  | "sale_started"
  | "release_today"
  | "announced";

export interface GameAlert {
  id: string;
  gameId: string;
  gameTitle: string;
  gameCoverArt: string;
  type: AlertType;
  headline: string;
  subtext: string;
  createdAt: string;
  timestampGroup: "today" | "yesterday" | "this_week" | "earlier";
  read: boolean;
}
