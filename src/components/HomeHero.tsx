"use client";

import Link from "next/link";
import type { Game } from "@/lib/types";
import { formatPrice, getDaysUntil, getSaleEndLabel, isPlaceholderDate } from "@/lib/format";
import GameCoverImage from "./GameCoverImage";

/**
 * Orders the "New for you" feed: all-time lows lead, then deeper discounts,
 * then upcoming launches by soonest date. The feed IS the product surface —
 * what just happened / is about to happen to the games this user watches —
 * so event significance beats any merchandising logic (founder direction
 * 2026-08-04, modeled on Beepr's drop feed: no "best deal" framing, ever).
 */
export function buildRadarFeed(onSaleGames: Game[], comingSoonGames: Game[]): Game[] {
  const deals = [...onSaleGames].sort((a, b) => {
    if (a.isAllTimeLow !== b.isAllTimeLow) return a.isAllTimeLow ? -1 : 1;
    return (b.discount ?? 0) - (a.discount ?? 0);
  });
  const upcoming = [...comingSoonGames]
    .filter((g) => g.releaseDate && !isPlaceholderDate(g.releaseDate))
    .sort((a, b) => getDaysUntil(a.releaseDate) - getDaysUntil(b.releaseDate));
  return [...deals, ...upcoming];
}

function countdownChipText(releaseDate: string): string {
  if (!releaseDate || isPlaceholderDate(releaseDate)) return "TBA";
  const days = getDaysUntil(releaseDate);
  if (days <= 0) return "Out today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

/**
 * Spotify-style borderless rows on the page background — no card boxes,
 * larger art, one line of event context under the title. Tap area is the
 * whole row.
 */
export default function RadarFeed({ games }: { games: Game[] }) {
  if (games.length === 0) return <QuietState />;

  return (
    <section className="hero-card-in">
      <h2 className="text-[10px] font-bold text-[#00ff88] tracking-wider mb-1 uppercase">New for you</h2>
      <div>
        {games.slice(0, 6).map((game) => (
          <RadarRow key={game.id} game={game} />
        ))}
      </div>
    </section>
  );
}

function RadarRow({ game }: { game: Game }) {
  const isDeal = game.isOnSale;
  const saleEndLabel = game.saleEndDate ? getSaleEndLabel(game.saleEndDate) : null;

  return (
    <Link
      href={`/game/${game.slug}`}
      className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg active:bg-white/5 active:scale-[0.99] transition-all"
    >
      <div className="w-[72px] shrink-0">
        <GameCoverImage
          src={game.coverArt}
          alt={game.title}
          className={`w-full aspect-[16/10] rounded-md bg-[#1a1a1a] ${game.coverArt?.includes("igdb.com") ? "object-contain p-0.5" : "object-cover"}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-white text-[14px] leading-snug line-clamp-1">{game.title}</h3>
        {isDeal ? (
          <p className="text-[12px] mt-0.5 flex items-center gap-1.5 min-w-0">
            <span className="font-mono text-[#00ff88] font-bold shrink-0">{formatPrice(game.currentPrice)}</span>
            <span className="font-mono text-[#555555] line-through text-[11px] shrink-0">{formatPrice(game.originalPrice)}</span>
            {game.isAllTimeLow ? (
              <span className="text-[#FFD700] text-[10px] font-bold tracking-wide shrink-0">ALL-TIME LOW</span>
            ) : saleEndLabel ? (
              <span className={`text-[10px] truncate ${saleEndLabel.urgency === "high" ? "text-[#ff4444] font-bold" : "text-[#777777]"}`}>
                {saleEndLabel.text}
              </span>
            ) : null}
          </p>
        ) : (
          <p className="text-[#777777] text-[12px] mt-0.5 truncate">{game.publisher}</p>
        )}
      </div>
      {isDeal ? (
        game.discount != null && (
          <span className="shrink-0 font-mono text-[#00ff88] text-[12px] font-bold">-{game.discount}%</span>
        )
      ) : (
        <span className="shrink-0 font-mono px-2 py-1 rounded-full bg-[#00aaff]/15 text-[#00aaff] text-[11px] font-bold">
          {countdownChipText(game.releaseDate)}
        </span>
      )}
    </Link>
  );
}

function QuietState() {
  return (
    <Link href="/sales" className="block active:scale-[0.98] transition-transform">
      <div className="rounded-2xl border border-[#222222] bg-[#111111] p-5 flex flex-col items-center text-center gap-2.5">
        <div className="w-11 h-11 rounded-full bg-[#00ff88]/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-[#00ff88]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>
        <p className="text-white text-sm font-semibold">All quiet for now</p>
        <p className="text-[#666666] text-xs max-w-[240px]">
          Nothing you watch is on sale or launching soon. Browse deals to find your next watch.
        </p>
        <span className="mt-1 w-full rounded-full bg-[#00ff88] text-[#0a0a0a] text-sm font-bold py-3 active:scale-95 transition-transform">
          Browse deals
        </span>
      </div>
    </Link>
  );
}
