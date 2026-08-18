"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import AlertCard from "@/components/AlertCard";
import UndoToast from "@/components/UndoToast";
import { RadarIcon } from "@/components/icons";

import QueryError from "@/components/QueryError";
import { useAuth } from "@/lib/AuthContext";
import { useFollow } from "@/lib/FollowContext";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getAlerts, markAlertRead, markAllAlertsRead, remindAlert, dismissAlerts, getLastPriceCheckTimestamp } from "@/lib/queries";
import { formatFreshness } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { notifyAlertsChanged } from "@/lib/alertEvents";
import type { GameAlert, AlertType } from "@/lib/types";

const UNDO_WINDOW_MS = 5000;
// Must match AlertCard's own EXIT_DURATION_MS — the card animates itself out
// over this long before the parent actually drops it from state.
const EXIT_ANIM_MS = 250;
// Stagger offset between each card in a "Clear all" cascade.
const CLEAR_ALL_STAGGER_MS = 45;

type TimeGroup = "today" | "yesterday" | "this_week" | "earlier";
type AlertFilter = "all" | "price" | "sales" | "releases";

const GROUP_LABELS: Record<TimeGroup, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This Week",
  earlier: "Earlier",
};

const ALERT_FILTERS: { key: AlertFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "price", label: "Price Drops" },
  { key: "sales", label: "Sales" },
  { key: "releases", label: "Releases" },
];

const FILTER_TYPES: Record<AlertFilter, AlertType[] | null> = {
  all: null,
  price: ["price_drop", "all_time_low"],
  sales: ["sale_started"],
  releases: ["out_now", "release_today", "announced", "switch2_edition_announced"],
};

// formatFreshness() reads as a standalone sentence ("Checked 3 min ago");
// folded into the empty state's single "Watching N games · checked X" line
// it needs to read as a continuation clause instead.
function lowercaseFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export default function AlertsPage() {
  const { user, loading: authLoading } = useAuth();
  const { followedGameIds } = useFollow();
  const { data: fetchedAlerts, loading: alertsLoading, error: alertsError } = useSupabaseQuery(
    (sb) => authLoading ? Promise.resolve([]) : getAlerts(sb, user?.id),
    [user?.id, authLoading]
  );
  // Pipeline-global freshness stamp for the empty state's "checked X ago" --
  // same source/rationale as /deals and game-detail's own use of this query.
  const { data: lastChecked } = useSupabaseQuery(getLastPriceCheckTimestamp, []);

  const [localAlerts, setLocalAlerts] = useState<GameAlert[]>([]);
  const [filter, setFilter] = useState<AlertFilter>("all");
  const [pending, setPending] = useState<{ alerts: GameAlert[]; message: string } | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ids currently mid-exit-animation, mapped to their stagger delay (ms).
  // The alert stays in localAlerts (and thus rendered) until its animation
  // finishes, so AlertCard can actually play the exit transition.
  const [leavingDelays, setLeavingDelays] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (fetchedAlerts) setLocalAlerts(fetchedAlerts);
  }, [fetchedAlerts]);

  // Refs mirror `user` and the pending alerts so the unmount cleanup can
  // commit with current values despite its empty dependency array.
  const userRef = useRef(user);
  userRef.current = user;
  const pendingAlertsRef = useRef<GameAlert[]>([]);

  const commitPending = useCallback(async (alertsToDismiss: GameAlert[]) => {
    const userId = userRef.current?.id;
    if (!userId || alertsToDismiss.length === 0) return;
    try {
      const supabase = createClient();
      await dismissAlerts(supabase, userId, alertsToDismiss.map((a) => a.id));
      notifyAlertsChanged();
    } catch {
      // Already removed from view; a failed write just means it may
      // reappear next refresh. Not worth a rollback UX for this action.
    }
  }, []);

  useEffect(() => {
    return () => {
      // Unmounting mid-undo-window (user tapped an alert, switched tabs)
      // must commit the pending dismissal, not drop it — clearing the
      // timer alone silently undid the user's action on next load
      // (2026-08-05 audit C4).
      if (pendingTimer.current) {
        clearTimeout(pendingTimer.current);
        pendingTimer.current = null;
        void commitPending(pendingAlertsRef.current);
      }
    };
  }, [commitPending]);

  const dismissWithUndo = (alertsToDismiss: GameAlert[], message: string) => {
    if (alertsToDismiss.length === 0) return;
    // A dismiss fired while a previous one is still pending — commit that
    // one immediately rather than losing it.
    if (pendingTimer.current) {
      clearTimeout(pendingTimer.current);
      if (pending) commitPending(pending.alerts);
    }
    const dismissIds = new Set(alertsToDismiss.map((a) => a.id));
    setLocalAlerts((prev) => prev.filter((a) => !dismissIds.has(a.id)));
    setPending({ alerts: alertsToDismiss, message });
    pendingAlertsRef.current = alertsToDismiss;
    pendingTimer.current = setTimeout(() => {
      commitPending(alertsToDismiss);
      setPending(null);
      pendingAlertsRef.current = [];
      pendingTimer.current = null;
    }, UNDO_WINDOW_MS);
  };

  const handleUndo = () => {
    if (!pending) return;
    if (pendingTimer.current) {
      clearTimeout(pendingTimer.current);
      pendingTimer.current = null;
    }
    pendingAlertsRef.current = [];
    setLocalAlerts((prev) =>
      [...prev, ...pending.alerts].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    );
    setPending(null);
  };

  const handleDismiss = (id: string) => {
    const alert = localAlerts.find((a) => a.id === id);
    if (!alert || leavingDelays.has(id)) return;
    // Play the exit animation first; only remove from state (and start the
    // undo window) once AlertCard has actually finished animating it away.
    setLeavingDelays((prev) => {
      const next = new Map(prev);
      next.set(id, 0);
      return next;
    });
    setTimeout(() => {
      setLeavingDelays((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      dismissWithUndo([alert], "Alert dismissed");
    }, EXIT_ANIM_MS);
  };

  const handleClearAll = () => {
    if (localAlerts.length === 0 || leavingDelays.size > 0) return;
    // Stagger by the order cards actually appear in (the current filter's
    // visible order) so the cascade reads top-to-bottom regardless of
    // which alerts happen to be filtered out of view right now.
    const filterTypes = FILTER_TYPES[filter];
    const visibleOrder = filterTypes ? localAlerts.filter((a) => filterTypes.includes(a.type)) : localAlerts;
    const delays = new Map<string, number>();
    visibleOrder.forEach((a, i) => delays.set(a.id, i * CLEAR_ALL_STAGGER_MS));
    localAlerts.forEach((a) => {
      if (!delays.has(a.id)) delays.set(a.id, 0);
    });
    setLeavingDelays(delays);
    const maxDelay = visibleOrder.length > 0 ? (visibleOrder.length - 1) * CLEAR_ALL_STAGGER_MS : 0;
    const total = localAlerts.length;
    setTimeout(() => {
      setLeavingDelays(new Map());
      dismissWithUndo(localAlerts, `${total} alert${total !== 1 ? "s" : ""} cleared`);
    }, maxDelay + EXIT_ANIM_MS);
  };

  const handleTap = async (id: string) => {
    setLocalAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, read: true } : a))
    );
    if (user) {
      try {
        const supabase = createClient();
        await markAlertRead(supabase, user.id, id);
        notifyAlertsChanged();
      } catch {
        setLocalAlerts((prev) =>
          prev.map((a) => (a.id === id ? { ...a, read: false } : a))
        );
      }
    }
  };

  const handleRemind = async (id: string) => {
    setLocalAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, read: true } : a))
    );
    if (user) {
      try {
        const supabase = createClient();
        await remindAlert(supabase, user.id, id);
      } catch {
        setLocalAlerts((prev) =>
          prev.map((a) => (a.id === id ? { ...a, read: false } : a))
        );
      }
    }
  };

  const handleMarkAllRead = async () => {
    const unread = localAlerts.filter((a) => !a.read);
    if (unread.length === 0) return;
    const unreadIds = new Set(unread.map((a) => a.id));
    setLocalAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    if (user) {
      try {
        const supabase = createClient();
        await markAllAlertsRead(supabase, user.id, Array.from(unreadIds));
        notifyAlertsChanged();
      } catch {
        setLocalAlerts((prev) =>
          prev.map((a) => (unreadIds.has(a.id) ? { ...a, read: false } : a))
        );
      }
    }
  };

  // Unauthenticated — show sign-in prompt
  if (!authLoading && !user) {
    return (
      <div className="px-4 flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#111111] border border-[#222222] flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-[#444444]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">Sign in to see your alerts</h2>
        <p className="text-[#555555] text-sm mb-6 max-w-[240px]">Watch games and get notified when prices drop or sales go live.</p>
        <Link href="/login" className="px-6 py-3 rounded-full bg-[#00ff88] text-[#0a0a0a] text-sm font-semibold">
          Sign in
        </Link>
      </div>
    );
  }

  const alerts = localAlerts;
  const unreadCount = alerts.filter((a) => !a.read).length;

  // Apply filter
  const filterTypes = FILTER_TYPES[filter];
  const filteredAlerts = filterTypes
    ? alerts.filter((a) => filterTypes.includes(a.type))
    : alerts;

  // Group alerts by time
  const grouped: Record<TimeGroup, GameAlert[]> = {
    today: [],
    yesterday: [],
    this_week: [],
    earlier: [],
  };
  filteredAlerts.forEach((alert) => {
    grouped[alert.timestampGroup].push(alert);
  });

  const isEmpty = alerts.length === 0 && !alertsError;

  return (
    <div className="px-4">
      {/* Header */}
      <div className="py-4 pr-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">Alerts</h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-white text-xs font-bold">
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="shrink-0 flex items-center gap-1 min-h-[44px] px-3 py-2 rounded-full bg-[#111111] border border-[#222222] text-[#aaaaaa] text-xs font-medium hover:border-[#333333] hover:text-white transition-all active:scale-[0.97]"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Mark all read
              </button>
            )}
            {localAlerts.length > 0 && (
              <button
                onClick={handleClearAll}
                className="shrink-0 flex items-center gap-1 min-h-[44px] px-3 py-2 rounded-full bg-[#111111] border border-[#222222] text-[#aaaaaa] text-xs font-medium hover:border-[#ff4d4d]/40 hover:text-[#ff4d4d] transition-all active:scale-[0.97]"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      {authLoading || alertsLoading ? (
        <div className="space-y-4 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3 p-3 bg-[#111111] rounded-xl border border-[#222222] animate-pulse">
              <div className="w-2 h-2 rounded-full bg-[#1a1a1a] shrink-0 mt-2" />
              <div className="w-12 h-12 rounded-lg bg-[#1a1a1a] shrink-0" />
              <div className="flex-1">
                <div className="h-3 bg-[#1a1a1a] rounded w-20 mb-2" />
                <div className="h-4 bg-[#1a1a1a] rounded w-3/4 mb-1.5" />
                <div className="h-3 bg-[#1a1a1a] rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : alertsError ? (
        <QueryError subject="alerts" />
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="relative w-16 h-16 rounded-2xl bg-[#111111] border border-[#222222] flex items-center justify-center mb-4">
            <RadarIcon className="w-8 h-8 text-[#444444]" />
            {user && <span className="absolute inset-0 m-auto w-8 h-8 rounded-full animate-radar-ping bg-[#444444]/20" aria-hidden="true" />}
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">
            {user ? "All quiet. We're watching" : "No alerts yet"}
          </h2>
          <p className="text-[#555555] text-sm text-center max-w-[260px]">
            {user
              ? `Watching ${followedGameIds.size} game${followedGameIds.size !== 1 ? "s" : ""} for you · ${lowercaseFirst(formatFreshness(lastChecked))}`
              : "Sign in and watch games to get notified about price drops, sales, and new releases."}
          </p>
          {!user && (
            <Link
              href="/login"
              className="mt-4 px-5 py-2.5 rounded-xl bg-[#00ff88] text-[#0a0a0a] text-sm font-semibold hover:shadow-[0_0_12px_#00ff8855] transition-all"
            >
              Sign in to get alerts
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Filter pills */}
          <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
            {ALERT_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={`shrink-0 min-h-[44px] px-3 flex items-center rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  filter === f.key
                    ? "bg-white/10 text-white"
                    : "bg-[#1a1a1a] text-[#666666] hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-6 pb-4">
            {(Object.keys(grouped) as TimeGroup[]).map((group) => {
              const groupAlerts = grouped[group];
              if (groupAlerts.length === 0) return null;
              return (
                <div key={group}>
                  <h2 className="text-[10px] font-bold text-[#666666] tracking-wider mb-3">
                    {GROUP_LABELS[group]}
                  </h2>
                  <div>
                    {groupAlerts.map((alert) => (
                      <AlertCard
                        key={alert.id}
                        alert={alert}
                        onTap={handleTap}
                        onRemind={handleRemind}
                        onDismiss={user ? handleDismiss : undefined}
                        leaving={leavingDelays.has(alert.id)}
                        exitDelayMs={leavingDelays.get(alert.id) ?? 0}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            {filteredAlerts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-[#555555] text-sm">No alerts match this filter</p>
              </div>
            )}
          </div>
        </>
      )}
      {pending && <UndoToast message={pending.message} onUndo={handleUndo} />}
    </div>
  );
}
