"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import GameCard, { GameCardSkeleton } from "@/components/GameCard";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getRecentReleases, getUpcomingGames, getAnnouncedGames } from "@/lib/queries";
import QueryError from "@/components/QueryError";
import { useAuth } from "@/lib/AuthContext";

type SubTab = "Out Now" | "Coming Soon";
type PlatformFilter = "all" | "switch2";

export default function UpcomingPage() {
  const { consolePreference } = useAuth();
  const { data: recentReleases, loading: recentLoading, error: recentError } = useSupabaseQuery(getRecentReleases);
  const { data: upcomingGames, loading: upcomingLoading, error: upcomingError } = useSupabaseQuery(getUpcomingGames);
  const { data: announcedGames } = useSupabaseQuery(getAnnouncedGames);
  const [subTab, setSubTab] = useState<SubTab>("Out Now");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Sync platform filter with user preference once auth loads
  useEffect(() => {
    if (consolePreference === "switch2") setPlatformFilter("switch2");
  }, [consolePreference]);

  // Active touchmove listener — prevents iOS Safari back gesture on horizontal swipes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const onMove = (e: TouchEvent) => {
      const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
      const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
      if (dx > dy && dx > 10) e.preventDefault();
    };

    const onEnd = (e: TouchEvent) => {
      const dx = touchStartX.current - e.changedTouches[0].clientX;
      const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY);
      if (Math.abs(dx) < 50 || dy > Math.abs(dx)) return;
      const tabs: SubTab[] = ["Out Now", "Coming Soon"];
      const i = tabs.indexOf(subTab);
      if (dx > 0 && i < tabs.length - 1) setSubTab(tabs[i + 1]);
      else if (dx < 0 && i > 0) setSubTab(tabs[i - 1]);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [subTab]);

  const loading = subTab === "Out Now" ? recentLoading : upcomingLoading;
  const queryError = subTab === "Out Now" ? recentError : upcomingError;
  const rawGames = useMemo(
    () => (subTab === "Out Now" ? (recentReleases ?? []) : (upcomingGames ?? [])),
    [subTab, recentReleases, upcomingGames]
  );

  const filtered = useMemo(() => {
    return platformFilter === "switch2"
      ? rawGames.filter((g) => g.platform === "switch2" || g.switch2Nsuid || /switch\s*2/i.test(g.title))
      : rawGames;
  }, [rawGames, platformFilter]);

  const announcedFiltered = useMemo(() => {
    const all = announcedGames ?? [];
    return platformFilter === "switch2"
      ? all.filter((g) => g.platform === "switch2" || g.switch2Nsuid || /switch\s*2/i.test(g.title))
      : all;
  }, [announcedGames, platformFilter]);

  const isFiltered = platformFilter === "switch2";

  return (
    <div ref={containerRef} className="px-4 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between py-4">
        <h1 className="text-lg font-bold text-white">Upcoming</h1>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-2 mb-4">
        {/* Sub-tab pills */}
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

        {/* Platform toggle */}
        <div className="ml-auto flex gap-1 bg-[#111111] rounded-lg p-0.5 border border-[#222222]">
          {(["all", "switch2"] as PlatformFilter[]).map((pf) => (
            <button
              key={pf}
              aria-pressed={platformFilter === pf}
              onClick={() => setPlatformFilter(pf)}
              className={`px-3 py-2.5 rounded-md text-[10px] font-medium whitespace-nowrap transition-all ${
                platformFilter === pf
                  ? "bg-[#1a1a1a] text-white"
                  : "text-[#666666] hover:text-white"
              }`}
            >
              {pf === "all" ? "All" : "Switch 2"}
            </button>
          ))}
        </div>

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
      ) : filtered.length === 0 && (subTab !== "Coming Soon" || !announcedFiltered.length) ? (
        <EmptyState subTab={subTab} isFiltered={isFiltered} />
      ) : (
        <>
          {filtered.length > 0 && (
            <div className="space-y-2 mb-4">
              {filtered.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          )}
          {subTab === "Coming Soon" && announcedFiltered.length > 0 && (
            <div className="mb-4">
              {filtered.length > 0 && (
                <h2 className="text-xs font-semibold text-[#555555] uppercase tracking-wider mb-3 mt-6">
                  Announced — No Release Date
                </h2>
              )}
              <div className="space-y-2">
                {announcedFiltered.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

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
