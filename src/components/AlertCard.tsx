"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { GameAlert, AlertType } from "@/lib/types";

const SWIPE_DISMISS_THRESHOLD = 80;

// Must match the setTimeout duration the parent uses to actually remove the
// alert from state — the visual exit and the state removal are intentionally
// decoupled (see AlertsPage), so these two numbers have to stay in sync.
const EXIT_DURATION_MS = 250;

const alertConfig: Record<
  AlertType,
  { label: string; color: string; bg: string }
> = {
  price_drop: { label: "PRICE DROP", color: "text-[#00ff88]", bg: "bg-[#00ff88]/15" },
  all_time_low: { label: "ALL TIME LOW", color: "text-[#FFD700]", bg: "bg-[#FFD700]/15" },
  out_now: { label: "OUT NOW", color: "text-[#00BFFF]", bg: "bg-[#00BFFF]/15" },
  sale_started: { label: "SALE STARTED", color: "text-[#FF69B4]", bg: "bg-[#FF69B4]/15" },
  sale_ending: { label: "SALE ENDING", color: "text-[#ff6874]", bg: "bg-[#ff6874]/15" },
  release_today: { label: "RELEASE TODAY", color: "text-[#FFA500]", bg: "bg-[#FFA500]/15" },
  announced: { label: "ANNOUNCED", color: "text-[#9B59B6]", bg: "bg-[#9B59B6]/15" },
  switch2_edition_announced: { label: "SWITCH 2", color: "text-[#00aaff]", bg: "bg-[#00aaff]/15" },
  retro_game_added: { label: "RETRO DROP", color: "text-[#ffaa00]", bg: "bg-[#ffaa00]/15" },
};

export default function AlertCard({
  alert,
  onTap,
  onRemind,
  onDismiss,
  leaving = false,
  exitDelayMs = 0,
}: {
  alert: GameAlert;
  onTap?: (id: string) => void;
  onRemind?: (id: string) => void;
  onDismiss?: (id: string) => void;
  /** Parent has decided this card is on its way out — play the exit transition. */
  leaving?: boolean;
  /** Stagger offset (ms) for "Clear all"'s cascade; 0 for a single dismiss. */
  exitDelayMs?: number;
}) {
  const config = alertConfig[alert.type] ?? { label: alert.type.toUpperCase(), color: "text-[#888888]", bg: "bg-[#888888]/15" };
  const [reminded, setReminded] = useState(false);
  const [dragX, setDragX] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const dragging = useRef(false);

  const handleClick = () => {
    if (dragging.current || leaving) return;
    if (!alert.read) onTap?.(alert.id);
  };

  const handleRemind = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setReminded(true);
    onRemind?.(alert.id);
  };

  // Just hand off intent — the parent owns leaving/exitDelayMs and the
  // actual removal timing, so the card itself doesn't self-animate anymore.
  const triggerDismiss = () => {
    onDismiss?.(alert.id);
  };

  const handleDismissClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    triggerDismiss();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (leaving) return;
    touchStartX.current = e.touches[0].clientX;
    dragging.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (leaving || touchStartX.current === null) return;
    const delta = e.touches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 6) dragging.current = true;
    if (delta < 0) setDragX(Math.max(delta, -140));
  };

  const handleTouchEnd = () => {
    touchStartX.current = null;
    if (dragX <= -SWIPE_DISMISS_THRESHOLD && onDismiss) {
      triggerDismiss();
    } else {
      setDragX(0);
      // Let the click handler see stale dragging state briefly, then reset.
      setTimeout(() => {
        dragging.current = false;
      }, 50);
    }
  };

  const inner = (
    <div className="relative overflow-hidden rounded-xl">
      {onDismiss && (
        <div className="absolute inset-0 flex items-center justify-end pr-5 bg-[#ff4d4d]/20 rounded-xl">
          <svg className="w-5 h-5 text-[#ff4d4d]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </div>
      )}
      <div
        onClick={handleClick}
        onTouchStart={onDismiss ? handleTouchStart : undefined}
        onTouchMove={onDismiss ? handleTouchMove : undefined}
        onTouchEnd={onDismiss ? handleTouchEnd : undefined}
        style={{
          transform: leaving ? "translateX(120%)" : `translateX(${dragX}px)`,
          opacity: leaving ? 0 : 1,
          // A single explicit transitionProperty list, covering both the
          // exit/drag motion AND the read-state color fade below — an
          // inline transitionProperty fully replaces (not merges with) any
          // transition-property a Tailwind class would set, so the color
          // easing has to live here too or it silently never runs.
          transitionProperty: "transform, opacity, background-color, border-color",
          transitionDuration:
            !leaving && dragging.current && dragX !== 0
              ? "0s, 0s, 300ms, 300ms"
              : `${leaving ? EXIT_DURATION_MS : 180}ms, ${leaving ? EXIT_DURATION_MS : 180}ms, 300ms, 300ms`,
          transitionTimingFunction: `${leaving ? "var(--ease-spring)" : "ease-out"}, ${
            leaving ? "var(--ease-spring)" : "ease-out"
          }, ease-out, ease-out`,
          transitionDelay: `${leaving ? exitDelayMs : 0}ms, ${leaving ? exitDelayMs : 0}ms, 0ms, 0ms`,
          pointerEvents: leaving ? "none" : undefined,
        }}
        className={`relative flex gap-3 p-3 rounded-xl border ${
          alert.read
            ? "bg-[#111111]/60 border-[#1a1a1a] opacity-60"
            : "bg-[#111111] border-[#333333]"
        }`}
      >
        {/* Unread dot — always mounted so the read transition can fade it,
            rather than swapping elements (which can't transition). */}
        <div className="shrink-0 flex items-start pt-1 w-2">
          <div
            className={`w-2 h-2 rounded-full bg-[#00ff88] shadow-[0_0_8px_#00ff88] transition-opacity duration-300 ease-out ${
              alert.read ? "opacity-0" : "opacity-100"
            }`}
          />
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
              {config.label}
            </span>
            {/* Only the franchise-follow case answers "why am I seeing
                this" — a direct follow ("Watching") is the obvious default
                and stays unlabeled so this chip doesn't compete with the
                alert content. Absent entirely for older callers that never
                computed sourceLabel (e.g. game-detail's alert list). */}
            {alert.sourceLabel && alert.sourceLabel !== "Watching" && (
              <span className="max-w-[40%] truncate text-[10px] text-[#999999] bg-[#ffffff0d] px-2 py-0.5 rounded-full">
                via {alert.sourceLabel}
              </span>
            )}
            <span className="text-[#555555] text-[10px] ml-auto shrink-0">
              {alert.timestamp}
            </span>
            {onDismiss && (
              <button
                onClick={handleDismissClick}
                aria-label="Dismiss alert"
                className="shrink-0 w-11 h-11 -m-2.5 flex items-center justify-center text-[#444444] hover:text-white transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
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
              className="mt-1 py-2.5 min-h-[44px] text-[11px] text-[#666666] hover:text-white transition-colors flex items-center"
            >
              Remind me in a few days
            </button>
          )}
          {reminded && (
            <p className="mt-1.5 text-[10px] text-[#00ff88]">Reminder set</p>
          )}
        </div>
      </div>
    </div>
  );

  const linked = alert.gameSlug ? <Link href={`/game/${alert.gameSlug}`}>{inner}</Link> : inner;

  // grid-template-rows 1fr -> 0fr is the standard trick for animating an
  // unknown-height element to zero without jank (a max-height transition
  // would need a guessed cap and either clips real content or leaves a gap).
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: leaving ? "0fr" : "1fr",
        transitionProperty: "grid-template-rows",
        transitionDuration: `${EXIT_DURATION_MS}ms`,
        transitionTimingFunction: "ease-out",
        transitionDelay: leaving ? `${exitDelayMs}ms` : "0ms",
      }}
    >
      <div className="overflow-hidden">
        {/* Padding (not the parent's gap/space-y) carries the inter-card
            spacing so it collapses to zero together with the row above. */}
        <div className="pb-2">{linked}</div>
      </div>
    </div>
  );
}
