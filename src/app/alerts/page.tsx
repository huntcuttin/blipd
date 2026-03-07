"use client";

import { useState, useEffect } from "react";
import AlertCard from "@/components/AlertCard";

import { useAuth } from "@/lib/AuthContext";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getAlerts, markAlertRead, remindAlert } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import type { GameAlert, AlertType } from "@/lib/types";

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

export default function AlertsPage() {
  const { user } = useAuth();
  const { data: fetchedAlerts } = useSupabaseQuery(
    (sb) => getAlerts(sb, user?.id),
    [user?.id]
  );

  const [localAlerts, setLocalAlerts] = useState<GameAlert[]>([]);
  const [filter, setFilter] = useState<AlertFilter>("all");

  useEffect(() => {
    if (fetchedAlerts) setLocalAlerts(fetchedAlerts);
  }, [fetchedAlerts]);

  const handleTap = async (id: string) => {
    setLocalAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, read: true } : a))
    );
    if (user) {
      const supabase = createClient();
      await markAlertRead(supabase, user.id, id);
    }
  };

  const handleRemind = async (id: string) => {
    setLocalAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, read: true } : a))
    );
    if (user) {
      const supabase = createClient();
      await remindAlert(supabase, user.id, id);
    }
  };

  const handleMarkAllRead = async () => {
    const unread = localAlerts.filter((a) => !a.read);
    if (unread.length === 0) return;
    setLocalAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    if (user) {
      const supabase = createClient();
      await Promise.all(unread.map((a) => markAlertRead(supabase, user.id, a.id)));
    }
  };

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

  const isEmpty = alerts.length === 0;

  return (
    <div className="px-4">
      {/* Header */}
      <div className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">Alerts</h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#00ff88]/15 text-[#00ff88] text-xs font-bold">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-[#00ff88] font-medium hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-16 h-16 rounded-2xl bg-[#111111] border border-[#222222] flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#444444]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No alerts yet</h2>
          <p className="text-[#555555] text-sm text-center max-w-[260px]">
            Follow games to get notified about price drops, sales, and new releases
          </p>
        </div>
      ) : (
        <>
          {/* Filter pills */}
          <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
            {ALERT_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  filter === f.key
                    ? "bg-[#00ff88]/15 text-[#00ff88]"
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
                  <h2 className="text-xs font-bold text-[#666666] tracking-wider mb-3">
                    {GROUP_LABELS[group]}
                  </h2>
                  <div className="space-y-2">
                    {groupAlerts.map((alert) => (
                      <AlertCard
                        key={alert.id}
                        alert={alert}
                        onTap={handleTap}
                        onRemind={handleRemind}
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
    </div>
  );
}
