"use client";

import { memo } from "react";
import Link from "next/link";
import type { Game } from "@/lib/types";
import { formatPrice, isPlaceholderDate, formatReleaseDate, isYearOnlyDate } from "@/lib/format";
import FollowButton from "./FollowButton";
import GameCoverImage from "./GameCoverImage";

export default memo(function GameCard({ game }: { game: Game }) {
  const daysUntilRelease = getDaysUntil(game.releaseDate);
  const releaseLabel = getReleaseLabel(game, daysUntilRelease);
  const saleEndLabel = game.isOnSale && game.saleEndDate ? getSaleEndLabel(game.saleEndDate) : null;
  const { base, edition } = splitTitle(game.title);

  return (
    <Link href={`/game/${game.slug}`} className="block">
      <div className="flex gap-3 p-3 bg-[#111111] rounded-xl border border-[#222222] hover:border-[#333333] transition-colors">
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
            <p className="text-[#555555] text-[11px] mt-0.5 truncate">
              {game.publisher}
              {game.metacriticScore !== null && (
                <span className={
                  game.metacriticScore >= 75 ? " text-[#00ce7a]"
                  : game.metacriticScore >= 50 ? " text-[#ffbd3f]"
                  : " text-[#ff6874]"
                }>
                  {" "}· MC {game.metacriticScore}
                </span>
              )}
            </p>
          </div>

          {/* Price row */}
          <div className="flex items-center gap-1.5 mt-2">
            {game.isOnSale ? (
              <>
                <span className="text-[#00ff88] font-bold text-sm shrink-0">
                  {formatPrice(game.currentPrice)}
                </span>
                <span className="text-[#555555] text-[11px] line-through">
                  {formatPrice(game.originalPrice)}
                </span>
                {game.discount != null && (
                  <span className="px-1.5 py-0.5 rounded-md bg-[#00cc6e]/20 text-[#00ff88] text-[11px] font-bold shrink-0">
                    -{game.discount}%
                  </span>
                )}
              </>
            ) : (
              <span className="text-white font-bold text-sm">
                {game.currentPrice === 0 && game.originalPrice === 0
                  ? "Free"
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
            {game.switch2Nsuid && !game.isAllTimeLow && (
              <span className="px-1.5 py-0.5 rounded-md bg-[#00aaff]/15 text-[#00aaff] text-[10px] font-bold">
                Switch 2
              </span>
            )}
            {saleEndLabel && (
              <span className="text-[#ff6874] text-[10px] font-medium">
                {saleEndLabel}
              </span>
            )}
            {releaseLabel && (
              <span className="text-[#00aaff] text-[10px] font-medium">{releaseLabel}</span>
            )}
          </div>
        </div>

        {/* Follow button */}
        <div className="shrink-0 flex items-start pt-1">
          <FollowButton gameId={game.id} />
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
      <div className="w-[150px] bg-[#111111] rounded-xl border border-[#222222] hover:border-[#333333] transition-colors overflow-hidden">
        <GameCoverImage
          src={game.coverArt}
          alt={game.title}
          className={`w-full aspect-[16/10] bg-[#1a1a1a] ${game.coverArt?.includes("igdb.com") ? "object-contain p-1" : "object-cover"}`}
        />
        <div className="p-2.5">
          <h3 className="font-semibold text-white text-xs leading-tight truncate">
            {game.title}
          </h3>
          <p className="text-[#555555] text-[10px] mt-0.5">{game.publisher}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            {game.isOnSale ? (
              <>
                <span className="text-[#00ff88] font-bold text-xs">
                  {formatPrice(game.currentPrice)}
                </span>
                {game.discount != null && (
                  <span className="px-1 py-0.5 rounded bg-[#00cc6e]/20 text-[#00ff88] text-[9px] font-bold">
                    -{game.discount}%
                  </span>
                )}
              </>
            ) : game.releaseStatus === "upcoming" ? (
              <div className="flex items-center gap-1.5">
                {game.currentPrice > 0 && (
                  <span className="text-white font-bold text-xs">{formatPrice(game.currentPrice)}</span>
                )}
                <span className="text-[#666666] text-[10px]">
                  {game.releaseDate && !isPlaceholderDate(game.releaseDate)
                    ? formatReleaseDate(game.releaseDate)
                    : "Coming soon"}
                </span>
              </div>
            ) : (
              <span className="text-white font-bold text-xs">
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
  const days = getDaysUntil(dateStr);
  if (days <= 0) return "Ends today";
  if (days === 1) return "Ends tomorrow";
  if (days <= 14) return `Ends in ${days} days`;
  return null;
}

function getReleaseLabel(game: Game, daysUntil: number): string | null {
  // If a game is on sale or has a price, it's released — never show a release label
  if (game.isOnSale || game.currentPrice > 0 || game.originalPrice > 0) return null;
  if (game.releaseStatus === "out_today") return "Out Now";
  if (game.releaseStatus === "upcoming") {
    if (!game.releaseDate || isPlaceholderDate(game.releaseDate)) return "TBA";
    if (daysUntil === 0) return "Releases today";
    if (daysUntil === 1) return "Out tomorrow";
    if (daysUntil <= 7) return `Out in ${daysUntil} days`;
    if (isYearOnlyDate(game.releaseDate)) return new Date(game.releaseDate + "T12:00:00").getFullYear().toString();
    const d = new Date(game.releaseDate);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  }
  return null;
}
