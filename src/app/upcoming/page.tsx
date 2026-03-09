"use client";

import { useState, useEffect, useMemo } from "react";
import GameCard, { GameCardSkeleton } from "@/components/GameCard";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getRecentReleases, getUpcomingGames } from "@/lib/queries";
import QueryError from "@/components/QueryError";
import { useAuth } from "@/lib/AuthContext";

type SubTab = "Out Now" | "Coming Soon";
type PlatformFilter = "all" | "switch2";
type SortMode = "date" | "hype";

export default function UpcomingPage() {
  const { consolePreference } = useAuth();
  const { data: recentReleases, loading: recentLoading, error: recentError } = useSupabaseQuery(getRecentReleases);
  const { data: upcomingGames, loading: upcomingLoading, error: upcomingError } = useSupabaseQuery(getUpcomingGames);
  const [subTab, setSubTab] = useState<SubTab>("Out Now");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("date");

  // Sync platform filter with user preference once auth loads
  useEffect(() => {
    if (consolePreference === "switch2") setPlatformFilter("switch2");
  }, [consolePreference]);

  const loading = subTab === "Out Now" ? recentLoading : upcomingLoading;
  const queryError = subTab === "Out Now" ? recentError : upcomingError;
  const rawGames = subTab === "Out Now" ? (recentReleases ?? []) : (upcomingGames ?? []);

  const filtered = useMemo(() => {
    let games = platformFilter === "switch2"
      ? rawGames.filter((g) => g.switch2Nsuid || /switch\s*2/i.test(g.title))
      : rawGames;

    if (subTab === "Coming Soon" && sortMode === "hype") {
      games = [...games].sort((a, b) => (b.igdbHype ?? 0) - (a.igdbHype ?? 0));
    }

    return games;
  }, [rawGames, platformFilter, subTab, sortMode]);

  const isFiltered = platformFilter === "switch2";
  const hasAnyHype = subTab === "Coming Soon" && rawGames.some((g) => g.igdbHype && g.igdbHype > 0);

  return (
    <div className="px-4 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between py-4">
        <h1 className="text-lg font-bold text-white">Upcoming</h1>
      </div>

      {/* Sub-tab pills */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex gap-2" role="tablist">
          {(["Out Now", "Coming Soon"] as SubTab[]).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={subTab === tab}
              onClick={() => setSubTab(tab)}
              className={`px-3 py-2.5 rounded-full text-xs font-medium transition-all ${
                subTab === tab
                  ? "bg-[#00ff88]/15 text-[#00ff88]"
                  : "bg-[#1a1a1a] text-[#666666] hover:text-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Sort toggle — only on Coming Soon when hype data exists */}
        {hasAnyHype && (
          <div className="ml-auto flex gap-1 bg-[#111111] rounded-lg p-0.5 border border-[#222222]">
            <button
              onClick={() => setSortMode("date")}
              aria-pressed={sortMode === "date"}
              className={`px-2 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                sortMode === "date"
                  ? "bg-[#1a1a1a] text-white"
                  : "text-[#666666] hover:text-white"
              }`}
            >
              Date
            </button>
            <button
              onClick={() => setSortMode("hype")}
              aria-pressed={sortMode === "hype"}
              className={`px-2 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                sortMode === "hype"
                  ? "bg-[#1a1a1a] text-white"
                  : "text-[#666666] hover:text-white"
              }`}
            >
              Hype
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {queryError ? (
        <QueryError subject="games" />
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <GameCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState subTab={subTab} isFiltered={isFiltered} />
      ) : (
        <div className="space-y-2 mb-4">
          {filtered.map((game) => (
            <GameCard key={game.id} game={game} showHype={subTab === "Coming Soon"} />
          ))}
        </div>
      )}

      {/* Platform toggle — bottom section */}
      <div className="sticky bottom-20 z-10 py-3">
        <div className="flex p-1 bg-[#111111] rounded-xl border border-[#222222]">
          {(["all", "switch2"] as PlatformFilter[]).map((pf) => (
            <button
              key={pf}
              aria-pressed={platformFilter === pf}
              onClick={() => setPlatformFilter(pf)}
              className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all ${
                platformFilter === pf
                  ? "bg-[#1a1a1a] text-white"
                  : "text-[#666666] hover:text-white"
              }`}
            >
              {pf === "all" ? "All Platforms" : "Switch 2 Only"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ subTab, isFiltered }: { subTab: SubTab; isFiltered: boolean }) {
  const title = isFiltered
    ? "No Switch 2 games found"
    : subTab === "Out Now"
    ? "No recent releases"
    : "Nothing upcoming";

  const description = isFiltered
    ? "Try switching to All Platforms"
    : subTab === "Out Now"
    ? "No new games released in the last 30 days"
    : "No confirmed releases coming soon";

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-14 h-14 rounded-2xl bg-[#111111] border border-[#222222] flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-[#444444]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
          {subTab === "Out Now" ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          )}
        </svg>
      </div>
      <h2 className="text-base font-semibold text-white mb-1">{title}</h2>
      <p className="text-[#555555] text-sm text-center max-w-[260px]">{description}</p>
    </div>
  );
}
