"use client";

import { memo } from "react";
import Link from "next/link";
import type { Game } from "@/lib/types";
import { formatPrice, isPlaceholderDate, formatReleaseDate, getDaysUntil, getSaleEndLabel } from "@/lib/format";
import { isRarelyOnSale } from "@/lib/ranking";
import { useFollow } from "@/lib/FollowContext";
import { CheckIcon } from "@/components/icons";
import FollowButton from "./FollowButton";
import GameCoverImage from "./GameCoverImage";

export default memo(function GameCard({ game, ownAction, justOwned }: { game: Game; ownAction?: () => void; justOwned?: boolean }) {
  const { getTargetPrice } = useFollow();
  const targetPrice = getTargetPrice(game.id);
  const daysUntilRelease = getDaysUntil(game.releaseDate);
  const releaseLabel = getReleaseLabel(game, daysUntilRelease);
  const saleEndLabel = game.isOnSale && game.saleEndDate ? getSaleEndLabel(game.saleEndDate) : null;
  const rarelyOnSale = isRarelyOnSale(game);
  const { base, edition } = splitTitle(game.title);

  return (
    <Link href={`/game/${game.slug}`} className="block">
      <div className="flex gap-3 p-3 bg-[#111111] rounded-xl border border-[#222222] hover:border-[#333333] transition-all active:scale-[0.98]">
        {/* Cover art */}
        <div className="w-[110px] shrink-0">
          <GameCoverImage
            src={game.coverArt}
            alt={game.title}
            className={`w-full aspect-[16/10] rounded-lg bg-[#1a1a1a] ${game.coverArt?.includes("igdb.com") ? "object-contain p-1" : "object-cover"}`}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-white text-[15px] leading-snug line-clamp-2">
              {base}
            </h3>
            {edition && (
              <p className="text-[#00aaff] text-[11px] mt-0.5 leading-tight line-clamp-1">
                {edition}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
              <p className="text-[#555555] text-[11px] truncate min-w-0">
                {game.publisher}
              </p>
              {game.metacriticScore !== null && game.metacriticScore >= 70 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                  game.metacriticScore >= 85
                    ? "bg-[#FFD700]/15 text-[#FFD700]"
                    : "bg-[#888888]/15 text-[#888888]"
                }`}>
                  ★ {game.metacriticScore}
                </span>
              )}
              {game.retroPlatform && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#ffaa00]/15 text-[#ffaa00] shrink-0">
                  {game.retroPlatform.toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* Price row */}
          <div className="flex items-center gap-1.5 mt-2">
            {game.isOnSale ? (
              <>
                <span className="font-mono text-[#00ff88] font-bold text-sm shrink-0">
                  {formatPrice(game.currentPrice)}
                </span>
                <span className="font-mono text-[#555555] text-[11px] line-through">
                  {formatPrice(game.originalPrice)}
                </span>
                {game.discount != null && (
                  <span className="font-mono px-1.5 py-0.5 rounded-md bg-[#00cc6e]/20 text-[#00ff88] text-[11px] font-bold flex-shrink-0">
                    -{game.discount}%
                  </span>
                )}
              </>
            ) : (
              <span className="font-mono text-white font-bold text-sm">
                {game.currentPrice === 0 && game.originalPrice === 0
                  ? game.releaseStatus === "released" ? "Free" : ""
                  : game.currentPrice > 0
                  ? formatPrice(game.currentPrice)
                  : game.originalPrice > 0
                  ? formatPrice(game.originalPrice)
                  : ""}
              </span>
            )}
          </div>

          {/* Secondary badges row */}
          <div className="flex items-center gap-1.5 mt-1">
            {game.isAllTimeLow && (
              <span className="px-2 py-0.5 rounded-md bg-[#FFD700]/15 text-[#FFD700] text-[10px] font-bold tracking-wide">
                ALL TIME LOW
              </span>
            )}
            {rarelyOnSale && !game.isAllTimeLow && (
              <span className="px-2 py-0.5 rounded-md bg-[#ff6ec7]/15 text-[#ff6ec7] text-[10px] font-bold tracking-wide">
                RARELY ON SALE
              </span>
            )}
            {game.switch2Nsuid && !game.isAllTimeLow && !rarelyOnSale && (
              <span className="px-1.5 py-0.5 rounded-md bg-[#00aaff]/15 text-[#00aaff] text-[10px] font-bold">
                Switch 2
              </span>
            )}
            {game.hasDemo && (
              <span className="px-1.5 py-0.5 rounded-md bg-[#888888]/15 text-[#888888] text-[10px] font-bold">
                DEMO
              </span>
            )}
            {saleEndLabel && (
              <span className={`text-[10px] font-medium ${saleEndLabel.urgency === "high" ? "text-[#ff4444] font-bold" : saleEndLabel.urgency === "medium" ? "text-[#ffaa00]" : "text-[#777777]"}`}>
                {saleEndLabel.text}
              </span>
            )}
            {releaseLabel && (
              <span className="text-[#00aaff] text-[10px] font-medium">{releaseLabel}</span>
            )}
          </div>

          {/* Target price progress */}
          {targetPrice !== null && game.currentPrice > targetPrice && (
            <div className="flex items-center gap-1.5 mt-1">
              <div className="flex-1 h-1 rounded-full bg-[#222222] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#00ff88]/40"
                  style={{ width: `${Math.min(100, Math.round((1 - (game.currentPrice - targetPrice) / (game.originalPrice - targetPrice)) * 100))}%` }}
                />
              </div>
              <span className="text-[9px] text-[#555555] font-mono shrink-0">
                Target {formatPrice(targetPrice)}
              </span>
            </div>
          )}
          {targetPrice !== null && game.currentPrice <= targetPrice && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[9px] text-[#00ff88] font-bold">
                HIT TARGET {formatPrice(targetPrice)}!
              </span>
            </div>
          )}
        </div>

        {/* Follow button */}
        <div className="shrink-0 flex flex-col items-end gap-1.5 pt-1">
          <FollowButton gameId={game.id} />
          {ownAction && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!justOwned) ownAction(); }}
              disabled={justOwned}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-all active:scale-95 ${
                justOwned
                  ? "bg-white/10 text-white border-white/20"
                  : "bg-[#1a1a1a] text-[#777777] border-[#2a2a2a] hover:border-[#3a3a3a] hover:text-[#aaaaaa]"
              }`}
            >
              <CheckIcon className="w-3 h-3" />
              {justOwned ? "Added!" : "I own this"}
            </button>
          )}
        </div>
      </div>
    </Link>
  );
});

// Skeleton loading variant
export function GameCardSkeleton() {
  return (
    <div className="flex gap-3 p-3 bg-[#111111] rounded-xl border border-[#222222] animate-pulse">
      <div className="w-[110px] shrink-0 aspect-[16/10] rounded-lg bg-[#1a1a1a]" />
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="h-4 bg-[#1a1a1a] rounded w-3/4" />
          <div className="h-3 bg-[#1a1a1a] rounded w-1/2 mt-1.5" />
        </div>
        <div className="h-4 bg-[#1a1a1a] rounded w-1/3 mt-2" />
        <div className="h-3 bg-[#1a1a1a] rounded w-1/4 mt-1" />
      </div>
      <div className="w-[70px] h-[36px] rounded-lg bg-[#1a1a1a] shrink-0 mt-1" />
    </div>
  );
}

// Compact horizontal scroll variant
export const GameCardCompact = memo(function GameCardCompact({ game }: { game: Game }) {
  return (
    <Link href={`/game/${game.slug}`} className="block shrink-0">
      <div className="w-[150px] bg-[#111111] rounded-xl border border-[#222222] hover:border-[#333333] transition-all active:scale-[0.98] overflow-hidden">
        <GameCoverImage
          src={game.coverArt}
          alt={game.title}
          className={`w-full aspect-[16/10] bg-[#1a1a1a] ${game.coverArt?.includes("igdb.com") ? "object-contain p-1" : "object-cover"}`}
        />
        <div className="p-2.5">
          <h3 className="font-semibold text-white text-xs leading-tight line-clamp-2">
            {game.title}
          </h3>
          <p className="text-[#555555] text-[10px] mt-0.5">{game.publisher}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            {game.isOnSale ? (
              <>
                <span className="font-mono text-[#00ff88] font-bold text-xs">
                  {formatPrice(game.currentPrice)}
                </span>
                {game.discount != null && (
                  <span className="font-mono px-1 py-0.5 rounded bg-[#00cc6e]/20 text-[#00ff88] text-[9px] font-bold">
                    -{game.discount}%
                  </span>
                )}
              </>
            ) : game.releaseStatus === "upcoming" ? (
              <div className="flex items-center gap-1.5">
                {game.currentPrice > 0 && (
                  <span className="font-mono text-white font-bold text-xs">{formatPrice(game.currentPrice)}</span>
                )}
                <span className="text-[#666666] text-[10px]">
                  {game.releaseDate && !isPlaceholderDate(game.releaseDate)
                    ? formatReleaseDate(game.releaseDate)
                    : "Coming soon"}
                </span>
              </div>
            ) : (
              <span className="font-mono text-white font-bold text-xs">
                {game.currentPrice === 0 && game.originalPrice === 0 ? "Free" : game.currentPrice > 0 ? formatPrice(game.currentPrice) : ""}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
});

// Compact skeleton
export function GameCardCompactSkeleton() {
  return (
    <div className="w-[150px] shrink-0 bg-[#111111] rounded-xl border border-[#222222] overflow-hidden animate-pulse">
      <div className="w-full aspect-[16/10] bg-[#1a1a1a]" />
      <div className="p-2.5">
        <div className="h-3 bg-[#1a1a1a] rounded w-3/4" />
        <div className="h-2.5 bg-[#1a1a1a] rounded w-1/2 mt-1.5" />
        <div className="h-3 bg-[#1a1a1a] rounded w-1/3 mt-2" />
      </div>
    </div>
  );
}

// Split "Base Title – Edition Subtitle" into { base, edition }
// Handles Nintendo's em-dash separator (–) and strips trademark symbols from base
function splitTitle(title: string): { base: string; edition: string | null } {
  const sep = title.indexOf(" – ");
  if (sep === -1) return { base: title, edition: null };
  const base = title.slice(0, sep).replace(/[™®]/g, "").trim();
  const edition = title.slice(sep + 3).trim();
  return { base, edition };
}

function getReleaseLabel(game: Game, daysUntil: number): string | null {
  // A populated price alone isn't proof a game has released -- Nintendo's API
  // can carry a real preorder price on a still-upcoming listing -- so this
  // only suppresses the label once the game is actually on sale or confirmed
  // released. A price and a release-date label can legitimately show together.
  if (game.isOnSale || game.releaseStatus === "released") return null;
  if (game.releaseStatus === "out_today") return "Out Now";
  if (game.releaseStatus === "upcoming") {
    if (!game.releaseDate || isPlaceholderDate(game.releaseDate)) return "TBA";
    if (daysUntil === 0) return "Releases today";
    if (daysUntil === 1) return "Out tomorrow";
    // A month of countdown, matching the feed page's This Week/This Month
    // buckets -- a game 9 days out labeled only "2026" inside a section
    // titled "This Month" read as a bug, not restraint.
    if (daysUntil <= 30) return `Out in ${daysUntil} days`;
    // Beyond the near-term window, show just the year rather than a specific
    // month/day -- release-date precision this far out is often no more
    // reliable than a placeholder guess anyway (see CLAUDE.md session log
    // 2026-08-03), so a confident "Sep 17" reads as more certain than it is.
    // Year-only for far-out dates is the founder's explicit request -- keep.
    return new Date(game.releaseDate + "T12:00:00").getFullYear().toString();
  }
  return null;
}
