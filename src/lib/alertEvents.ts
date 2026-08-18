"use client";

/**
 * The unread badge in BottomNav and the alerts feed are rendered by different
 * component trees with no shared provider, so marking an alert read on /alerts
 * left the badge stale until a full page reload (audit #16, still open through
 * three passes). A window event is the smallest thing that actually fixes it:
 * no new context, no query cache, no refetch on every navigation.
 */
const ALERTS_CHANGED = "blippd:alerts-changed";

export function notifyAlertsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ALERTS_CHANGED));
}

export function onAlertsChanged(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(ALERTS_CHANGED, callback);
  return () => window.removeEventListener(ALERTS_CHANGED, callback);
}
