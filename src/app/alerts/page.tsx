"use client";

import { useState } from "react";
import AlertCard from "@/components/AlertCard";
import UpsellBanner from "@/components/UpsellBanner";
import { mockAlerts, GameAlert } from "@/lib/mockData";

type TimeGroup = "today" | "yesterday" | "this_week" | "earlier";

const GROUP_LABELS: Record<TimeGroup, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This Week",
  earlier: "Earlier",
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<GameAlert[]>(mockAlerts);

  const handleMarkSeen = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, read: true } : a))
    );
  };

  const handleRemind = (id: string) => {
    // Hide the alert — it would reappear in 3 days
    // TODO: Implement remind_at logic with actual timestamps
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const unreadCount = alerts.filter((a) => !a.read).length;

  // Group alerts by time
  const grouped: Record<TimeGroup, GameAlert[]> = {
    today: [],
    yesterday: [],
    this_week: [],
    earlier: [],
  };
  alerts.forEach((alert) => {
    grouped[alert.timestampGroup].push(alert);
  });

  const isEmpty = alerts.length === 0;

  return (
    <div className="px-4">
      {/* Header */}
      <div className="py-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-white">Alerts</h1>
          <div className="w-6 h-6 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-[#00ff88] drop-shadow-[0_0_8px_#00ff88]"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
              />
            </svg>
          </div>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-[#00ff88]/15 text-[#00ff88] text-xs font-bold">
              {unreadCount} new
            </span>
          )}
        </div>
      </div>

      {/* Upsell banner */}
      <div className="mb-4">
        <UpsellBanner variant="top" />
      </div>

      {isEmpty ? (
        <div className="text-center py-16">
          <p className="text-[#666666] text-sm mb-1">
            Your alerts will appear here
          </p>
          <p className="text-[#666666] text-xs">
            Follow games on Browse to get started
          </p>
        </div>
      ) : (
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
                      onMarkSeen={handleMarkSeen}
                      onRemind={handleRemind}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
