export type NotificationChannel = "email" | "web_push" | "expo_push";

export interface AlertPayload {
  alertId: string;
  alertType: string;
  gameId: string;
  gameSlug: string;
  gameTitle: string;
  gameCoverArt: string;
  headline: string;
  subtext: string;
  // Type-specific data
  oldPrice?: number;
  newPrice?: number;
  discount?: number;
  saleEndDate?: string | null;
}
