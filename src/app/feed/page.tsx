"use client";

import { Suspense } from "react";
import Link from "next/link";
import { GameCardCompact, GameCardCompactSkeleton } from "@/components/GameCard";
import GameCard, { GameCardSkeleton } from "@/components/GameCard";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import {
  getActiveDirects,
  getActiveNamedSaleEvents,
  getRecentReleases,
  getUpcomingGamesSoon,
} from "@/lib/queries";

export default function FeedPage() {
  return (
    <Suspense fallback={<FeedLoading />}>
      <FeedContent />
    </Suspense>
  );
}

function FeedLoading() {
  return (
    <div className="px-4">
      <div className="py-4">
        <h1 className="text-lg font-bold text-white">Feed</h1>
      </div>
      {/* Out Now skeleton */}
      <div className="mb-6">
        <div className="h-5 bg-[#1a1a1a] rounded w-20 mb-3" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <GameCardCompactSkeleton key={i} />
          ))}
        </div>
      </div>
      {/* Coming Soon skeleton */}
      <div>
        <div className="h-5 bg-[#1a1a1a] rounded w-28 mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <GameCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FeedContent() {
  const { data: directs } = useSupabaseQuery(getActiveDirects);
  const { data: saleEvents } = useSupabaseQuery(getActiveNamedSaleEvents);
  const { data: recentReleases, loading: releasesLoading } = useSupabaseQuery(getRecentReleases);
  const { data: upcomingGames, loading: upcomingLoading } = useSupabaseQuery(getUpcomingGamesSoon);

  // Filter recent releases to ones with cover art and a real price
  const outNow = (recentReleases ?? []).filter(
    (g) => g.coverArt && g.originalPrice > 0
  ).slice(0, 20);

  const comingSoon = (upcomingGames ?? []).filter(
    (g) => g.coverArt
  ).slice(0, 30);

  const loading = releasesLoading && upcomingLoading;

  return (
    <div className="px-4">
      {/* Header */}
      <div className="py-4">
        <h1 className="text-lg font-bold text-white">Feed</h1>
      </div>

      {/* Nintendo Direct banner */}
      {(directs ?? []).length > 0 && (
        <div className="mb-4 space-y-2">
          {directs!.map((d) => (
            <a
              key={d.id}
              href={d.videoId ? `https://www.youtube.com/watch?v=${d.videoId}` : "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl border border-[#e60012]/30 bg-[#e60012]/10 hover:border-[#e60012]/50 transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-[#e60012]/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-[#e60012]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-white truncate">{d.title || "Nintendo Direct"}</h3>
                <p className="text-[11px] text-[#e60012]/70 font-medium">Watch now →</p>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Active sale banners */}
      {(saleEvents ?? []).length > 0 && (
        <div className="mb-4 space-y-2">
          {saleEvents!.slice(0, 2).map((event) => (
            <Link
              key={event.id}
              href={`/sales?event=${event.id}`}
              className="flex items-center gap-3 p-3 rounded-xl border border-[#ffaa00]/30 bg-[#ffaa00]/10 hover:border-[#ffaa00]/50 transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-[#ffaa00]/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-[#ffaa00]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-white truncate">{event.name}</h3>
                <p className="text-[11px] text-[#ffaa00] font-medium">{event.gamesCount} games on sale →</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {loading ? (
        <>
          <div className="mb-6">
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <GameCardCompactSkeleton key={i} />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <GameCardSkeleton key={i} />
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Out Now section */}
          {outNow.length > 0 && (
            <section className="mb-6">
              <h2 className="text-sm font-bold text-white mb-3 tracking-wide uppercase text-[#888888]">Out Now</h2>
              <div className="overflow-x-auto -mx-4 px-4 no-scrollbar">
                <div className="flex gap-3 pb-1">
                  {outNow.map((game) => (
                    <GameCardCompact key={game.id} game={game} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Coming Soon section */}
          {comingSoon.length > 0 && (
            <section className="pb-4">
              <h2 className="text-sm font-bold text-white mb-3 tracking-wide uppercase text-[#888888]">Coming Soon</h2>
              <div className="space-y-2">
                {comingSoon.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            </section>
          )}

          {outNow.length === 0 && comingSoon.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div className="w-14 h-14 rounded-2xl bg-[#111111] border border-[#222222] flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-[#444444]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-white mb-1">Nothing yet</h2>
              <p className="text-[#555555] text-sm text-center max-w-[260px]">Check back soon for new releases and upcoming games</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
