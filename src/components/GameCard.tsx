"use client";

import Link from "next/link";
import { Game } from "@/lib/mockData";
import FollowButton from "./FollowButton";

export default function GameCard({ game }: { game: Game }) {
  const daysUntilRelease = getDaysUntil(game.releaseDate);
  const releaseLabel = getReleaseLabel(game, daysUntilRelease);

  return (
    <Link href={`/game/${game.slug}`} className="block">
      <div className="flex gap-3 p-3 bg-[#111111] rounded-xl border border-[#222222] hover:border-[#00ff88]/30 transition-all">
        {/* Cover art */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={game.coverArt}
          alt={game.title}
          className="w-[72px] h-[72px] rounded-lg object-cover bg-[#1a1a1a] shrink-0"
        />

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-white text-sm leading-tight truncate">
              {game.title}
            </h3>
            <p className="text-[#666666] text-xs mt-0.5">{game.publisher}</p>
          </div>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
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
                ${game.currentPrice.toFixed(2)}
              </span>
            )}

            {/* Discount badge */}
            {game.discount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-[#00ff88]/15 text-[#00ff88] text-[10px] font-bold">
                -{game.discount}%
              </span>
            )}

            {/* All time low badge */}
            {game.isAllTimeLow && (
              <span className="px-1.5 py-0.5 rounded-full bg-[#FFD700]/15 text-[#FFD700] text-[10px] font-bold">
                ALL TIME LOW
              </span>
            )}
          </div>

          {/* Release info */}
          {releaseLabel && (
            <p className="text-[#666666] text-[10px] mt-0.5">{releaseLabel}</p>
          )}
        </div>

        {/* Follow button */}
        <div className="shrink-0 flex items-center">
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
          className="w-full h-[100px] object-cover bg-[#1a1a1a]"
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
