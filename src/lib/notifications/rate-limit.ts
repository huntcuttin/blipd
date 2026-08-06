// Shared within a single dispatch-notifications run. Every Resend send site
// (email.ts, send-batch.ts) calls markRateLimited() the moment it sees
// Resend's rate_limit_exceeded error name; dispatch.ts polls isRateLimited()
// between work items and stops making further send calls for the rest of
// this run rather than hammering an already-limited API through hundreds
// more attempts. Nothing is lost: un-sent alerts stay inside the dispatch
// window and get retried whole on the next 10-min cron tick, once Resend's
// limit has had time to reset — same idempotency guarantee (alreadySentPairs)
// that makes widening the lookback window safe in the first place.
let limited = false;

export function markRateLimited(): void {
  limited = true;
}

export function isRateLimited(): boolean {
  return limited;
}

export function resetRateLimitFlag(): void {
  limited = false;
}

export function isResendRateLimitError(error: { name?: string } | null | undefined): boolean {
  // Quota exhaustion (the 100/day and 3,000/month free-tier caps) must trip
  // the breaker exactly like a burst rate limit: both mean every further
  // send this run is guaranteed to fail. Before these two names were
  // matched, a quota-exhausted day attempted every pending alert, failed
  // them all, and marked them dispatched — permanently lost (2026-08-05
  // audit C1).
  return (
    error?.name === "rate_limit_exceeded" ||
    error?.name === "daily_quota_exceeded" ||
    error?.name === "monthly_quota_exceeded"
  );
}
