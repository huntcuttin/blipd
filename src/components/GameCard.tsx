"use client";

import Link from "next/link";
import type { Game } from "@/lib/types";
import FollowButton from "./FollowButton";

export default function GameCard({ game }: { game: Game }) {
  const daysUntilRelease = getDaysUntil(game.releaseDate);
  const releaseLabel = getReleaseLabel(game, daysUntilRelease);
  const saleEndLabel = game.isOnSale && game.saleEndDate ? getSaleEndLabel(game.saleEndDate) : null;

  // Pick the single most important badge to show
  const badge = game.isAllTimeLow
    ? { label: "ALL TIME LOW", color: "bg-[#FFD700]/15 text-[#FFD700]" }
    : game.discount > 0
    ? { label: `-${game.discount}%`, color: "bg-[#00ff88]/15 text-[#00ff88]" }
    : game.switch2Nsuid
    ? { label: "Switch 2", color: "bg-[#00aaff]/15 text-[#00aaff]" }
    : null;

  return (
    <Link href={`/game/${game.slug}`} className="block">
      <div className="flex gap-3 p-3 bg-[#111111] rounded-xl border border-[#222222] hover:border-[#00ff88]/30 transition-all">
        {/* Cover art — 16:9 aspect to match Nintendo art */}
        <div className="w-[100px] shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={game.coverArt}
            alt={game.title}
            className="w-full aspect-video rounded-lg object-cover bg-[#1a1a1a]"
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div>
            <h3 className="font-semibold text-white text-sm leading-snug line-clamp-2">
              {game.title}
            </h3>
            <p className="text-[#666666] text-xs mt-0.5 truncate">
              {game.publisher}
              {game.metacriticScore !== null && (
                <span className={
                  game.metacriticScore >= 75 ? " text-[#00ce7a]"
                  : game.metacriticScore >= 50 ? " text-[#ffbd3f]"
                  : " text-[#ff6874]"
                }>
                  {" "}· {game.metacriticScore}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 mt-1.5">
            {/* Price */}
            {game.isOnSale ? (
              <>
                <span className="text-white font-bold text-sm">
                  ${game.currentPrice.toFixed(2)}
                </span>
                <span className="text-[#666666] text-xs line-through">
                  ${game.originalPrice.toFixed(2)}
                </span>
              </>
            ) : (
              <span className="text-white font-bold text-sm">
                {game.currentPrice > 0 ? `$${game.currentPrice.toFixed(2)}` : "Free"}
              </span>
            )}

            {/* Single most important badge */}
            {badge && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${badge.color}`}>
                {badge.label}
              </span>
            )}

            {/* Sale end urgency */}
            {saleEndLabel && (
              <span className="text-[#ff6874] text-[10px] font-medium">
                {saleEndLabel}
              </span>
            )}
          </div>

          {/* Release info */}
          {releaseLabel && (
            <p className="text-[#00aaff] text-[10px] font-medium mt-0.5">{releaseLabel}</p>
          )}
        </div>

        {/* Follow button — min 44px tap target */}
        <div className="shrink-0 flex items-center pl-1">
          <FollowButton gameId={game.id} />
        </div>
      </div>
    </Link>
  );
}

// Compact horizontal scroll variant for trending
export function GameCardCompact({ game }: { game: Game }) {
  return (
    <Link href={`/game/${game.slug}`} className="block shrink-0">
      <div className="w-[150px] bg-[#111111] rounded-xl border border-[#222222] hover:border-[#00ff88]/30 transition-all overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={game.coverArt}
          alt={game.title}
          className="w-full aspect-square object-cover object-top bg-[#1a1a1a] rounded-lg"
        />
        <div className="p-2.5">
          <h3 className="font-semibold text-white text-xs leading-tight truncate">
            {game.title}
          </h3>
          <p className="text-[#666666] text-[10px] mt-0.5">{game.publisher}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="text-white font-bold text-xs">
              ${game.currentPrice.toFixed(2)}
            </span>
            {game.discount > 0 && (
              <span className="px-1 py-0.5 rounded-full bg-[#00ff88]/15 text-[#00ff88] text-[9px] font-bold">
                -{game.discount}%
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  );
  return Math.round(
    (targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function getSaleEndLabel(dateStr: string): string | null {
  const target = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const days = Math.round((targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Ends today";
  if (days === 1) return "Ends tomorrow";
  if (days <= 14) return `Ends in ${days} days`;
  return null;
}

function getReleaseLabel(game: Game, daysUntil: number): string | null {
  if (game.releaseStatus === "out_today") return "Out Now";
  if (game.releaseStatus === "upcoming") {
    if (daysUntil === 0) return "Releases today";
    if (daysUntil === 1) return "Out tomorrow";
    if (daysUntil <= 7) return `Out in ${daysUntil} days`;
    const d = new Date(game.releaseDate);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return null;
}
