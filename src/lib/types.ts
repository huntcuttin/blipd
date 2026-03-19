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
  saleEndDate: string | null;
  priceHistory: { date: string; price: number }[];
  nsuid?: string | null;
  nintendoUrl?: string | null;
  switch2Nsuid: string | null;
  upgradePackNsuid: string | null;
  upgradePackPrice: number | null;
  isSuppressed: boolean;
  igdbHype: number | null;
  platform: "switch" | "switch2" | null;
  saleEventId: string | null;
  retroPlatform: string | null;
}

export interface NamedSaleEvent {
  id: string;
  name: string;
  detectedAt: string;
  active: boolean;
  gamesCount: number;
}

export interface NotifyPrefs {
  announcements: boolean;
  sales: boolean;
  allTimeLow: boolean;
  releases: boolean;
}

export const DEFAULT_NOTIFY_PREFS: NotifyPrefs = {
  announcements: true,
  sales: true,
  allTimeLow: true,
  releases: true,
};

export interface Franchise {
  id: string;
  name: string;
  gameCount: number;
  logo: string;
  popularityScore: number;
}

export type AlertType =
  | "price_drop"
  | "all_time_low"
  | "out_now"
  | "sale_started"
  | "sale_ending"
  | "release_today"
  | "announced"
  | "switch2_edition_announced"
  | "retro_game_added";

export type ConsolePreference = "switch" | "switch2";

export interface GameAlert {
  id: string;
  gameId: string;
  gameTitle: string;
  gameCoverArt: string;
  gameSlug: string;
  type: AlertType;
  headline: string;
  subtext: string;
  createdAt: string;
  timestamp: string;
  timestampGroup: "today" | "yesterday" | "this_week" | "earlier";
  read: boolean;
}
