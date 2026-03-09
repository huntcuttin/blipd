"use client";

import { useState } from "react";
import Link from "next/link";
import type { GameAlert, AlertType } from "@/lib/types";

const alertConfig: Record<
  AlertType,
  { emoji: string; label: string; color: string; bg: string }
> = {
  price_drop: { emoji: "🟢", label: "PRICE DROP", color: "text-[#00ff88]", bg: "bg-[#00ff88]/15" },
  all_time_low: { emoji: "🔥", label: "ALL TIME LOW", color: "text-[#FFD700]", bg: "bg-[#FFD700]/15" },
  out_now: { emoji: "🎮", label: "OUT NOW", color: "text-[#00BFFF]", bg: "bg-[#00BFFF]/15" },
  sale_started: { emoji: "🏷️", label: "SALE STARTED", color: "text-[#FF69B4]", bg: "bg-[#FF69B4]/15" },
  release_today: { emoji: "📅", label: "RELEASE TODAY", color: "text-[#FFA500]", bg: "bg-[#FFA500]/15" },
  announced: { emoji: "📣", label: "ANNOUNCED", color: "text-[#9B59B6]", bg: "bg-[#9B59B6]/15" },
  switch2_edition_announced: { emoji: "🎮", label: "SWITCH 2", color: "text-[#00aaff]", bg: "bg-[#00aaff]/15" },
};

export default function AlertCard({
  alert,
  onTap,
  onRemind,
}: {
  alert: GameAlert;
  onTap?: (id: string) => void;
  onRemind?: (id: string) => void;
}) {
  const config = alertConfig[alert.type] ?? { emoji: "📢", label: alert.type.toUpperCase(), color: "text-[#888888]", bg: "bg-[#888888]/15" };
  const [reminded, setReminded] = useState(false);

  const handleClick = () => {
    if (!alert.read) onTap?.(alert.id);
  };

  const handleRemind = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setReminded(true);
    onRemind?.(alert.id);
  };

  const inner = (
    <div
      onClick={handleClick}
      className={`flex gap-3 p-3 rounded-xl border transition-all ${
        alert.read
          ? "bg-[#111111]/60 border-[#1a1a1a] opacity-60"
          : "bg-[#111111] border-[#00ff88]/20"
      }`}
    >
      {/* Unread dot */}
      <div className="shrink-0 flex items-start pt-1">
        {!alert.read ? (
          <div className="w-2 h-2 rounded-full bg-[#00ff88] shadow-[0_0_8px_#00ff88]" />
        ) : (
          <div className="w-2" />
        )}
      </div>

      {/* Cover art */}
      {alert.gameCoverArt && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={alert.gameCoverArt}
          alt={alert.gameTitle}
          loading="lazy"
          className="w-12 h-12 rounded-lg object-cover object-center bg-[#1a1a1a] shrink-0"
        />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${config.color} ${config.bg}`}
          >
            {config.emoji} {config.label}
          </span>
          <span className="text-[#555555] text-[10px] ml-auto shrink-0">
            {alert.timestamp}
          </span>
        </div>

        <h3
          className={`font-semibold text-sm leading-tight ${
            alert.read ? "text-white/70" : "text-white"
          }`}
        >
          {alert.headline}
        </h3>
        <p className="text-[#555555] text-xs mt-0.5">{alert.subtext}</p>

        {/* Remind action — only show on unread alerts */}
        {!alert.read && onRemind && !reminded && (
          <button
            onClick={handleRemind}
            className="mt-1.5 text-[10px] text-[#666666] hover:text-[#00ff88] transition-colors"
          >
            Remind me in a few days
          </button>
        )}
        {reminded && (
          <p className="mt-1.5 text-[10px] text-[#00ff88]">Reminder set</p>
        )}
      </div>
    </div>
  );

  // Link to game detail if we have a slug
  if (alert.gameSlug) {
    return <Link href={`/game/${alert.gameSlug}`}>{inner}</Link>;
  }

  return inner;
}
