"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import SearchBar from "@/components/SearchBar";
import GameCard from "@/components/GameCard";
import FranchiseFollowButton from "@/components/FranchiseFollowButton";

import { useFollow } from "@/lib/FollowContext";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getAllGames, getAllFranchises, searchGames } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { computeTrendingScore } from "@/lib/ranking";
import { useAuth } from "@/lib/AuthContext";
import type { Game, Franchise, ConsolePreference } from "@/lib/types";

const TABS = ["Discover", "My Games", "My Franchises"] as const;
type Tab = (typeof TABS)[number];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>("Discover");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Game[] | null>(null);
  const { followedGameIds, followedFranchiseIds } = useFollow();
  const { consolePreference } = useAuth();

  const { data: games, loading: gamesLoading, error: gamesError } = useSupabaseQuery(getAllGames);
  const { data: franchises } = useSupabaseQuery(getAllFranchises);

  // Swipe handling
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dx = touchStartX.current - e.changedTouches[0].clientX;
      const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY);
      // Only swipe if horizontal movement > 60px and more horizontal than vertical
      if (Math.abs(dx) < 60 || dy > Math.abs(dx)) return;
      const currentIndex = TABS.indexOf(activeTab);
      if (dx > 0 && currentIndex < TABS.length - 1) {
        setActiveTab(TABS[currentIndex + 1]);
      } else if (dx < 0 && currentIndex > 0) {
        setActiveTab(TABS[currentIndex - 1]);
      }
    },
    [activeTab]
  );

  useEffect(() => {
    if (!search) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const results = await searchGames(supabase, search);
      setSearchResults(results);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const allGames = games ?? [];
  const allFranchises = franchises ?? [];

  const followedGames = allGames.filter((g) => followedGameIds.has(g.id));
  const followedFranchiseList = allFranchises.filter((f) =>
    followedFranchiseIds.has(f.id)
  );
  const unfollowedFranchises = allFranchises.filter(
    (f) => !followedFranchiseIds.has(f.id)
  );

  return (
    <div className="px-4">
      {/* Header */}
      <div className="flex items-center justify-between py-4">
        <Logo size={28} />
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search games..."
        />
      </div>

      {/* Search results override */}
      {searchResults ? (
        <div className="space-y-2 pb-4">
          <p className="text-xs text-[#666666] mb-3">
            {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
          </p>
          {searchResults.length > 0 ? (
            searchResults.map((game) => (
              <GameCard key={game.id} game={game} />
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-[#666666] text-sm">No games found</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Tab bar */}
          <div className="flex gap-1 p-1 bg-[#111111] rounded-xl mb-4">
            {TABS.map((tab) => {
              const isActive = activeTab === tab;
              const count =
                tab === "My Games"
                  ? followedGames.length
                  : tab === "My Franchises"
                  ? followedFranchiseList.length
                  : 0;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-[#1a1a1a] text-white"
                      : "text-[#666666] hover:text-white"
                  }`}
                >
                  {tab}
                  {count > 0 && (
                    <span
                      className={`ml-1 ${
                        isActive ? "text-[#00ff88]" : "text-[#555555]"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Swipe indicator dots */}
          <div className="flex justify-center gap-1.5 mb-4">
            {TABS.map((tab) => (
              <div
                key={tab}
                className={`h-1.5 rounded-full transition-all ${
                  activeTab === tab
                    ? "w-4 bg-[#00ff88]"
                    : "w-1.5 bg-[#333333]"
                }`}
              />
            ))}
          </div>

          {/* Swipeable content area */}
          <div
            ref={containerRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="min-h-[60vh]"
          >
            {activeTab === "Discover" && (
              <DiscoverTab
                allGames={allGames}
                loading={gamesLoading}
                error={gamesError}
                followedFranchises={new Set(
                  allFranchises.filter((f) => followedFranchiseIds.has(f.id)).map((f) => f.name)
                )}
                consolePreference={consolePreference}
              />
            )}
            {activeTab === "My Games" && (
              <MyGamesTab games={followedGames} />
            )}
            {activeTab === "My Franchises" && (
              <MyFranchisesTab
                followed={followedFranchiseList}
                suggestions={unfollowedFranchises}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Discover Tab ──────────────────────────────────────────────

type DiscoverSubTab = "Trending" | "Upcoming" | "Out Now";
type PlatformFilter = "all" | "switch2";

function DiscoverTab({
  allGames,
  loading,
  error,
  followedFranchises,
  consolePreference,
}: {
  allGames: Game[];
  loading: boolean;
  error: Error | null;
  followedFranchises: Set<string>;
  consolePreference: ConsolePreference | null;
}) {
  const [subTab, setSubTab] = useState<DiscoverSubTab>("Trending");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>(
    consolePreference === "switch2" ? "switch2" : "all"
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 bg-[#111111] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || allGames.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-[#666666] text-sm">
          {error ? "Failed to load games" : "No games available"}
        </p>
      </div>
    );
  }

  // Filter out suppressed games for all list views
  const visibleGames = allGames.filter((g) => !g.isSuppressed);

  // Platform filter — match switch2_nsuid OR title containing "Switch 2"
  const filtered = platformFilter === "switch2"
    ? visibleGames.filter((g) => g.switch2Nsuid || /switch\s*2/i.test(g.title))
    : visibleGames;

  const SUB_TABS: DiscoverSubTab[] = ["Trending", "Upcoming", "Out Now"];

  return (
    <div className="flex flex-col">
      {/* Sub-tab pills */}
      <div className="flex gap-2 mb-4">
        {SUB_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              subTab === tab
                ? "bg-[#00ff88]/15 text-[#00ff88]"
                : "bg-[#1a1a1a] text-[#666666] hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Game list */}
      <div className="mb-4">
        {subTab === "Trending" && (
          <TrendingView games={filtered} followedFranchises={followedFranchises} />
        )}
        {subTab === "Upcoming" && (
          <UpcomingView games={filtered} />
        )}
        {subTab === "Out Now" && (
          <OutNowView games={filtered} />
        )}
      </div>

      {/* Platform toggle — bottom section */}
      <div className="sticky bottom-20 z-10 py-3">
        <div className="flex p-1 bg-[#111111] rounded-xl border border-[#222222]">
          {(["all", "switch2"] as PlatformFilter[]).map((pf) => (
            <button
              key={pf}
              onClick={() => setPlatformFilter(pf)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
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

function TrendingView({ games, followedFranchises }: { games: Game[]; followedFranchises: Set<string> }) {
  const trending = [...games]
    .filter((g) => g.releaseStatus === "released" && g.currentPrice > 0)
    .sort((a, b) =>
      computeTrendingScore(b, { followedFranchises }) - computeTrendingScore(a, { followedFranchises })
    )
    .slice(0, 20);

  if (trending.length === 0) {
    return <EmptyState text="No trending games" />;
  }

  return (
    <div className="space-y-2">
      {trending.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  );
}

function UpcomingView({ games }: { games: Game[] }) {
  const now = new Date();
  const sixtyDaysOut = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const upcoming = games
    .filter(
      (g) =>
        (g.releaseStatus === "upcoming" || g.releaseStatus === "out_today") &&
        g.releaseDate >= now.toISOString().split("T")[0] &&
        g.releaseDate <= sixtyDaysOut
    )
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));

  if (upcoming.length === 0) {
    return <EmptyState text="No upcoming games in the next 60 days" />;
  }

  return (
    <div className="space-y-2">
      {upcoming.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  );
}

function OutNowView({ games }: { games: Game[] }) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const outNow = games
    .filter(
      (g) =>
        g.releaseStatus === "released" &&
        g.releaseDate >= thirtyDaysAgo &&
        g.releaseDate !== "2099-12-31" &&
        g.releaseDate !== "2020-01-01"
    )
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));

  if (outNow.length === 0) {
    return <EmptyState text="No new releases in the last 30 days" />;
  }

  return (
    <div className="space-y-2">
      {outNow.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-16">
      <p className="text-[#666666] text-sm">{text}</p>
    </div>
  );
}

// ── My Games Tab ──────────────────────────────────────────────

function MyGamesTab({ games }: { games: Game[] }) {
  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="w-16 h-16 rounded-2xl bg-[#111111] border border-[#222222] flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-[#444444]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">
          No games flagged yet
        </h2>
        <p className="text-[#666666] text-sm text-center max-w-[260px]">
          Follow games from the Upcoming tab or search to track prices and get alerts
        </p>
      </div>
    );
  }

  const onSale = games.filter((g) => g.isOnSale);
  const notOnSale = games.filter((g) => !g.isOnSale);

  return (
    <div className="space-y-4 pb-4">
      {onSale.length > 0 && (
        <div>
          <h3 className="text-[10px] font-bold text-[#00ff88] tracking-wider mb-2">
            ON SALE NOW
          </h3>
          <div className="space-y-2">
            {onSale.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </div>
      )}
      {notOnSale.length > 0 && (
        <div>
          <h3 className="text-[10px] font-bold text-[#666666] tracking-wider mb-2">
            WATCHING
          </h3>
          <div className="space-y-2">
            {notOnSale.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── My Franchises Tab ─────────────────────────────────────────

function MyFranchisesTab({
  followed,
  suggestions,
}: {
  followed: Franchise[];
  suggestions: Franchise[];
}) {
  return (
    <div className="pb-4">
      {followed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-16 h-16 rounded-2xl bg-[#111111] border border-[#222222] flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#444444]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">
            No franchises followed
          </h2>
          <p className="text-[#666666] text-sm text-center max-w-[280px]">
            Follow a franchise to get alerts for every game in the series — new releases, price drops, and sales
          </p>
        </div>
      ) : (
        <div className="mb-6">
          <h3 className="text-[10px] font-bold text-[#00ff88] tracking-wider mb-2">
            FOLLOWING
          </h3>
          <div className="space-y-2">
            {followed.map((franchise) => (
              <FranchiseRow key={franchise.id} franchise={franchise} />
            ))}
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div>
          <h3 className="text-[10px] font-bold text-[#666666] tracking-wider mb-2">
            SUGGESTED
          </h3>
          <div className="space-y-2">
            {suggestions.map((franchise) => (
              <FranchiseRow key={franchise.id} franchise={franchise} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FranchiseRow({ franchise }: { franchise: Franchise }) {
  return (
    <div className="flex items-center justify-between p-3 bg-[#111111] rounded-xl border border-[#222222] hover:border-[#00ff88]/30 transition-all">
      <Link
        href={`/franchise/${encodeURIComponent(franchise.name)}`}
        className="flex items-center gap-3 min-w-0 flex-1 mr-3"
      >
        {franchise.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={franchise.logo}
            alt={franchise.name}
            className="w-10 h-10 rounded-lg object-cover bg-[#1a1a1a] shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] border border-[#333333] flex items-center justify-center shrink-0">
            <span className="text-[#666666] text-xs font-bold">{franchise.name.slice(0, 2).toUpperCase()}</span>
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-semibold text-white text-sm">{franchise.name}</h3>
          <p className="text-[#666666] text-xs">{franchise.gameCount} games</p>
        </div>
      </Link>
      <FranchiseFollowButton franchiseId={franchise.id} />
    </div>
  );
}

