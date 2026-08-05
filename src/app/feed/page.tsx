"use client";

import { Suspense } from "react";
import Link from "next/link";
import DirectBanner from "@/components/DirectBanner";
import NamedSaleBanner from "@/components/NamedSaleBanner";
import { GameCardCompact, GameCardCompactSkeleton } from "@/components/GameCard";
import GameCard, { GameCardSkeleton } from "@/components/GameCard";
import GameCoverImage from "@/components/GameCoverImage";
import FollowButton from "@/components/FollowButton";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import {
  getRecentReleases,
  getUpcomingGamesSoon,
  getUnannouncedUpcomingGames,
} from "@/lib/queries";
import { isPlaceholderDate, isYearOnlyDate, isMonthOnlyDate, getDaysUntil } from "@/lib/format";
import { getNintendoIpTier } from "@/lib/ranking";
import type { Game } from "@/lib/types";

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

// A day-precise release date buckets by literal countdown; a date IGDB could
// only pin to a month or year would read as false precision in a "this
// week"/"this month" list, so it folds into TBA instead -- the same honesty
// tradeoff formatReleaseDate already makes for how it displays these dates.
type ComingSoonBucket = "this_week" | "this_month" | "later" | "tba";

function getComingSoonBucket(releaseDate: string): ComingSoonBucket {
  if (!releaseDate || isPlaceholderDate(releaseDate) || isYearOnlyDate(releaseDate) || isMonthOnlyDate(releaseDate)) {
    return "tba";
  }
  const days = getDaysUntil(releaseDate);
  if (days <= 7) return "this_week";
  if (days <= 30) return "this_month";
  return "later";
}

function UpcomingContent() {
  const { data: recentReleases, loading: releasesLoading } = useSupabaseQuery(getRecentReleases);
  const { data: upcomingGames, loading: upcomingLoading } = useSupabaseQuery(getUpcomingGamesSoon);
  const { data: unannouncedGames, loading: unannouncedLoading } = useSupabaseQuery(getUnannouncedUpcomingGames);

  const outNow = (recentReleases ?? []).filter(
    (g) => g.coverArt && g.originalPrice > 0
  ).slice(0, 20);

  const comingSoon = (upcomingGames ?? []).filter(
    (g) => g.coverArt
  ).slice(0, 30);

  const onTheHorizon = (unannouncedGames ?? []).filter(
    (g) => g.coverArt
  ).slice(0, 12);

  // The Nintendo slate leads the whole page (founder direction 2026-08-05:
  // "the upcoming Nintendo first-party slate needs to be top of mind").
  // Pulls Nintendo IP from BOTH the dated pool and the no-date-yet pool so
  // a TBA Splatoon still makes the slate, ordered flagship-first
  // (getNintendoIpTier), dated titles before TBA within a tier. Slate
  // members are excluded from the date buckets below so nothing shows twice.
  const nintendoSlate = [...comingSoon, ...onTheHorizon]
    .filter((g, i, arr) => getNintendoIpTier(g) > 0 && arr.findIndex((x) => x.id === g.id) === i)
    .sort((a, b) => {
      const tierDiff = getNintendoIpTier(b) - getNintendoIpTier(a);
      if (tierDiff !== 0) return tierDiff;
      const aTba = !a.releaseDate || isPlaceholderDate(a.releaseDate);
      const bTba = !b.releaseDate || isPlaceholderDate(b.releaseDate);
      if (aTba !== bTba) return aTba ? 1 : -1;
      return (a.releaseDate ?? "").localeCompare(b.releaseDate ?? "");
    })
    .slice(0, 10);
  const slateIds = new Set(nintendoSlate.map((g) => g.id));

  const thisWeek: Game[] = [];
  const thisMonth: Game[] = [];
  const later: Game[] = [];
  const tbaDated: Game[] = [];
  for (const game of comingSoon) {
    if (slateIds.has(game.id)) continue;
    const bucket = getComingSoonBucket(game.releaseDate);
    if (bucket === "this_week") thisWeek.push(game);
    else if (bucket === "this_month") thisMonth.push(game);
    else if (bucket === "later") later.push(game);
    else tbaDated.push(game);
  }
  const horizonRest = onTheHorizon.filter((g) => !slateIds.has(g.id));
  const hasComingSoon = comingSoon.length > 0 || onTheHorizon.length > 0;

  const loading = releasesLoading && upcomingLoading && unannouncedLoading;

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
          {/* Nintendo slate: the page's headline section */}
          {nintendoSlate.length > 0 && (
            <section className="mb-6">
              <h2 className="text-[10px] font-bold tracking-wider mb-3 uppercase text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#e60012]" aria-hidden="true" />
                Nintendo
              </h2>
              <div className="overflow-x-auto -mx-4 px-4 no-scrollbar">
                <div className="flex gap-3 pb-1">
                  {nintendoSlate.map((game) => (
                    <GameCardCompact key={game.id} game={game} />
                  ))}
                </div>
              </div>
            </section>
          )}

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
          {hasComingSoon && (
            <section className="pb-4">
              <h2 className="text-[10px] font-bold tracking-wider mb-3 uppercase text-[#888888]">Coming Soon</h2>
              <div className="space-y-6">
                {thisWeek.length > 0 && (
                  <div>
                    <h3 className="text-[13px] font-semibold text-white mb-2">This Week</h3>
                    <div className="space-y-2">
                      {thisWeek.map((game) => (
                        <GameCard key={game.id} game={game} />
                      ))}
                    </div>
                  </div>
                )}

                {thisMonth.length > 0 && (
                  <div>
                    <h3 className="text-[13px] font-semibold text-white mb-2">This Month</h3>
                    <div className="space-y-2">
                      {thisMonth.map((game) => (
                        <GameCard key={game.id} game={game} />
                      ))}
                    </div>
                  </div>
                )}

                {later.length > 0 && (
                  <div>
                    <h3 className="text-[13px] font-semibold text-white mb-2">Later</h3>
                    <div className="space-y-2">
                      {later.map((game) => (
                        <GameCard key={game.id} game={game} />
                      ))}
                    </div>
                  </div>
                )}

                {(tbaDated.length > 0 || horizonRest.length > 0) && (
                  <div>
                    <h3 className="text-[13px] font-semibold text-white mb-2">TBA</h3>

                    {tbaDated.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {tbaDated.map((game) => (
                          <GameCard key={game.id} game={game} />
                        ))}
                      </div>
                    )}

                    {horizonRest.length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-medium text-[#666666] mb-2">On the Horizon</h4>
                        <div className="space-y-2">
                          {horizonRest.map((game) => (
                            <OnTheHorizonCard key={game.id} game={game} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {outNow.length === 0 && !hasComingSoon && (
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

// Genuinely upcoming titles Nintendo hasn't attached any date to yet -- no
// release label to show (there's nothing honest to say beyond "TBA," which
// the section header already covers), so the card leads with the follow CTA
// instead of a date.
function OnTheHorizonCard({ game }: { game: Game }) {
  return (
    <Link href={`/game/${game.slug}`} className="block">
      <div className="flex items-center gap-3 p-3 bg-[#111111] rounded-xl border border-[#222222] hover:border-[#333333] transition-colors">
        <div className="w-[70px] shrink-0">
          <GameCoverImage
            src={game.coverArt}
            alt={game.title}
            className={`w-full aspect-[16/10] rounded-lg bg-[#1a1a1a] ${game.coverArt?.includes("igdb.com") ? "object-contain p-1" : "object-cover"}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-[13px] leading-snug line-clamp-2">{game.title}</h3>
          <p className="text-[#555555] text-[11px] mt-0.5 truncate">{game.publisher}</p>
          <p className="text-[#666666] text-[11px] mt-1 leading-snug">
            No date yet. Follow to know the minute it gets one, and the minute it launches.
          </p>
        </div>
        <div className="shrink-0">
          <FollowButton gameId={game.id} />
        </div>
      </div>
    </Link>
  );
}
