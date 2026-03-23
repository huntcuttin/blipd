"use client";

import { Suspense } from "react";
import DirectBanner from "@/components/DirectBanner";
import NamedSaleBanner from "@/components/NamedSaleBanner";
import { GameCardCompact, GameCardCompactSkeleton } from "@/components/GameCard";
import GameCard, { GameCardSkeleton } from "@/components/GameCard";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import {
  getRecentReleases,
  getUpcomingGamesSoon,
} from "@/lib/queries";

export default function UpcomingPage() {
  return (
    <Suspense fallback={<UpcomingLoading />}>
      <UpcomingContent />
    </Suspense>
  );
}

function UpcomingLoading() {
  return (
    <div className="px-4">
      <div className="py-4">
        <h1 className="text-2xl font-bold text-white">Upcoming</h1>
      </div>
      <div className="mb-6">
        <div className="h-5 bg-[#1a1a1a] rounded w-20 mb-3" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <GameCardCompactSkeleton key={i} />
          ))}
        </div>
      </div>
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

function UpcomingContent() {
  const { data: recentReleases, loading: releasesLoading } = useSupabaseQuery(getRecentReleases);
  const { data: upcomingGames, loading: upcomingLoading } = useSupabaseQuery(getUpcomingGamesSoon);

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
        <h1 className="text-2xl font-bold text-white">Upcoming</h1>
      </div>

      {/* Shared banners */}
      <DirectBanner />
      <NamedSaleBanner />

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
              <h2 className="text-[10px] font-bold tracking-wider mb-3 uppercase text-[#888888]">Out Now</h2>
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
              <h2 className="text-[10px] font-bold tracking-wider mb-3 uppercase text-[#888888]">Coming Soon</h2>
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
