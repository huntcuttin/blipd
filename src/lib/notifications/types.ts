export type NotificationChannel = "email" | "web_push" | "expo_push";

// Per-recipient send result. The three-way split is what lets the durable
// dispatch layer retry real failures without retrying forever:
// - "sent":    at least one channel delivered.
// - "skipped": nothing sendable, and retrying can never help (no channels
//              enabled, no template, suppressed address, 24h dedup hit,
//              no email on file). Counts as done.
// - "failed":  a send was genuinely attempted and errored (Resend error,
//              rate limit, quota, network). Retry next tick may succeed.
export type SendOutcome = "sent" | "skipped" | "failed";

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
  nsuid?: string | null;
  nintendoUrl?: string | null;
}
