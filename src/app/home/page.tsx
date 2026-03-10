"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import SearchBar from "@/components/SearchBar";
import DirectBanner from "@/components/DirectBanner";
import GameCard, { GameCardSkeleton } from "@/components/GameCard";
import FranchiseFollowButton from "@/components/FranchiseFollowButton";

import { useAuth } from "@/lib/AuthContext";
import { useFollow } from "@/lib/FollowContext";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getTrendingGames, getGamesByIds, getAllFranchises, searchGames } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { computeTrendingScore } from "@/lib/ranking";
import type { Game, Franchise } from "@/lib/types";
// Game used in DiscoverTab and search; Franchise used in MyFranchisesTab

const TABS = ["Discover", "My Games", "My Franchises"] as const;
type Tab = (typeof TABS)[number];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>("Discover");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Game[] | null>(null);
  const { user, signOut, consolePreference } = useAuth();
  const { followedGameIds, followedFranchiseIds, ownedGameIds } = useFollow();
  const { data: trendingData, loading: trendingLoading, error: trendingError } = useSupabaseQuery(getTrendingGames);
  const followedIds = useMemo(() => Array.from(followedGameIds), [followedGameIds]);
  const { data: followedGamesData } = useSupabaseQuery(
    (sb) => getGamesByIds(sb, followedIds),
    [followedIds.join(",")]
  );
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
      try {
        const supabase = createClient();
        const results = await searchGames(supabase, search, consolePreference);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, consolePreference]);

  const allFranchises = franchises ?? [];
  const followedGames = followedGamesData ?? [];

  const followedFranchiseList = allFranchises.filter((f) =>
    followedFranchiseIds.has(f.id)
  );
  const unfollowedFranchises = allFranchises.filter(
    (f) => !followedFranchiseIds.has(f.id)
  );
  const followedFranchiseNames = useMemo(
    () => new Set(followedFranchiseList.map((f) => f.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [followedFranchiseList.length, followedFranchiseIds]
  );

  return (
    <div className="px-4">
      {/* Header */}
      <div className="flex items-center justify-between py-4">
        <Logo size={28} />
        <div className="flex items-center gap-2">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search games..."
          />
          {user ? (
            <button
              onClick={signOut}
              aria-label="Sign out"
              className="shrink-0 w-10 h-10 rounded-full bg-[#111111] border border-[#222222] flex items-center justify-center text-[#666666] hover:text-white hover:border-[#333333] transition-all"
              title="Sign out"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
            </button>
          ) : (
            <Link
              href="/login"
              className="shrink-0 px-4 py-3 rounded-full bg-[#00ff88] text-[#0a0a0a] text-xs font-semibold hover:shadow-[0_0_12px_#00ff8855] transition-all"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>

      {/* Nintendo Direct banner */}
      <DirectBanner />

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
            <div className="flex flex-col items-center py-16 px-4">
              <svg className="w-10 h-10 text-[#333333] mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <p className="text-white text-sm font-medium mb-1">
                No results for &ldquo;{search}&rdquo;
              </p>
              <p className="text-[#555555] text-xs">Check your spelling or try a different search</p>
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
                  className={`flex-1 py-3 px-2 rounded-lg text-xs font-medium transition-all ${
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
                trendingGames={trendingData ?? []}
                loading={trendingLoading}
                error={trendingError}
                followedFranchises={followedFranchiseNames}
              />
            )}
            {activeTab === "My Games" && (
              <MyGamesTab games={followedGames} ownedGameIds={ownedGameIds} />
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

function DiscoverTab({
  trendingGames,
  loading,
  error,
  followedFranchises,
}: {
  trendingGames: Game[];
  loading: boolean;
  error: Error | null;
  followedFranchises: Set<string>;
}) {
  const sorted = useMemo(() => {
    return [...trendingGames]
      .sort((a, b) =>
        computeTrendingScore(b, { followedFranchises }) - computeTrendingScore(a, { followedFranchises })
      )
      .slice(0, 40);
  }, [trendingGames, followedFranchises]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <GameCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error || sorted.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-[#666666] text-sm">
          {error ? "Failed to load games" : "No trending games"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  );
}

// ── My Games Tab ──────────────────────────────────────────────

function MyGamesTab({ games, ownedGameIds }: { games: Game[]; ownedGameIds: Set<string> }) {
  const watching = games.filter((g) => !ownedGameIds.has(g.id));
  const owned = games.filter((g) => ownedGameIds.has(g.id));

  if (watching.length === 0 && owned.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="w-16 h-16 rounded-2xl bg-[#111111] border border-[#222222] flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-[#444444]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">No games yet</h2>
        <p className="text-[#666666] text-sm text-center max-w-[260px]">
          Follow games to track prices and get alerts, or mark ones you own
        </p>
      </div>
    );
  }

  const onSale = watching.filter((g) => g.isOnSale);
  const notOnSale = watching.filter((g) => !g.isOnSale);

  return (
    <div className="space-y-4 pb-4">
      {onSale.length > 0 && (
        <div>
          <h3 className="text-[10px] font-bold text-[#00ff88] tracking-wider mb-2">ON SALE NOW</h3>
          <div className="space-y-2">
            {onSale.map((game) => <GameCard key={game.id} game={game} />)}
          </div>
        </div>
      )}
      {notOnSale.length > 0 && (
        <div>
          <h3 className="text-[10px] font-bold text-[#666666] tracking-wider mb-2">WATCHING</h3>
          <div className="space-y-2">
            {notOnSale.map((game) => <GameCard key={game.id} game={game} />)}
          </div>
        </div>
      )}
      {owned.length > 0 && (
        <div>
          <h3 className="text-[10px] font-bold text-[#555555] tracking-wider mb-2">OWNED</h3>
          <div className="space-y-2">
            {owned.map((game) => <GameCard key={game.id} game={game} />)}
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

