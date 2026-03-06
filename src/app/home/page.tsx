"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import SearchBar from "@/components/SearchBar";
import GameCard, { GameCardCompact } from "@/components/GameCard";
import FranchiseCard from "@/components/FranchiseCard";
import FollowButton from "@/components/FollowButton";
import FranchiseFollowButton from "@/components/FranchiseFollowButton";
import UpsellBanner from "@/components/UpsellBanner";
import { useFollow } from "@/lib/FollowContext";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getAllGames, getAllFranchises, searchGames } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import type { Game, Franchise } from "@/lib/types";

type DateGroup = "today" | "tomorrow" | "this_week" | "next_week" | "later";

function getDateGroup(dateStr: string): DateGroup {
  const target = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diff = Math.round((targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 7) return "this_week";
  if (diff <= 14) return "next_week";
  return "later";
}

const GROUP_LABELS: Record<DateGroup, string> = {
  today: "TODAY",
  tomorrow: "TOMORROW",
  this_week: "THIS WEEK",
  next_week: "NEXT WEEK",
  later: "LATER",
};

const TABS = ["Discover", "My Games", "My Franchises"] as const;
type Tab = (typeof TABS)[number];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>("Discover");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Game[] | null>(null);
  const { followedGameIds, followedFranchiseIds, isAtLimit } = useFollow();

  const { data: games } = useSupabaseQuery(getAllGames);
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
              <UpcomingTab allGames={allGames} allFranchises={allFranchises} isAtLimit={isAtLimit} />
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

// ── Upcoming Tab ──────────────────────────────────────────────

function UpcomingTab({
  allGames,
  allFranchises,
  isAtLimit,
}: {
  allGames: Game[];
  allFranchises: Franchise[];
  isAtLimit: boolean;
}) {
  const upcomingGames = allGames
    .filter((g) => g.releaseStatus === "upcoming" || g.releaseStatus === "out_today")
    .sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime());

  const groupedUpcoming: Record<DateGroup, Game[]> = {
    today: [], tomorrow: [], this_week: [], next_week: [], later: [],
  };
  upcomingGames.forEach((game) => {
    groupedUpcoming[getDateGroup(game.releaseDate)].push(game);
  });

  const trending = allGames.filter((g) => g.releaseStatus === "released").slice(0, 8);

  return (
    <>
      {upcomingGames.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[#666666] text-sm">No upcoming games</p>
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          {(Object.keys(groupedUpcoming) as DateGroup[]).map((group) => {
            const groupGames = groupedUpcoming[group];
            if (groupGames.length === 0) return null;
            return (
              <div key={group}>
                <h3 className="text-[10px] font-bold text-[#666666] tracking-wider mb-2">
                  {GROUP_LABELS[group]}
                </h3>
                <div className="space-y-2">
                  {groupGames.map((game) => (
                    <UpcomingCard key={game.id} game={game} group={group} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isAtLimit && (
        <div className="mb-4">
          <UpsellBanner />
        </div>
      )}

      {/* Discover */}
      <Section title="Discover">
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2">
          {trending.map((game) => (
            <GameCardCompact key={game.id} game={game} />
          ))}
        </div>
      </Section>
    </>
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
    <div className="flex items-center justify-between p-3 bg-[#111111] rounded-xl border border-[#222222]">
      <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={franchise.logo}
          alt={franchise.name}
          className="w-10 h-10 rounded-lg object-cover bg-[#1a1a1a] shrink-0"
        />
        <div className="min-w-0">
          <h3 className="font-semibold text-white text-sm">{franchise.name}</h3>
          <p className="text-[#666666] text-xs">{franchise.gameCount} games</p>
        </div>
      </div>
      <FranchiseFollowButton franchiseId={franchise.id} />
    </div>
  );
}

// ── Shared ────────────────────────────────────────────────────

function UpcomingCard({ game, group }: { game: Game; group: DateGroup }) {
  const isOut = group === "today" || game.releaseStatus === "out_today";
  return (
    <Link href={`/game/${game.slug}`} className="block">
      <div className="flex gap-3 p-3 bg-[#111111] rounded-xl border border-[#222222] hover:border-[#00ff88]/30 transition-all">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={game.coverArt}
          alt={game.title}
          className="w-14 h-14 rounded-lg object-cover object-top bg-[#1a1a1a] shrink-0"
        />
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-white text-sm truncate">{game.title}</h3>
            <p className="text-[#666666] text-xs mt-0.5">{game.publisher}</p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {isOut ? (
              <span className="px-2 py-0.5 rounded-full bg-[#00ff88]/15 text-[#00ff88] text-[10px] font-bold">
                Out Now
              </span>
            ) : (
              <span className="text-[#666666] text-xs">
                {new Date(game.releaseDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
            <span className="text-[#666666] text-xs font-medium">
              ${game.currentPrice.toFixed(2)}
            </span>
          </div>
        </div>
        <div className="shrink-0 flex items-center">
          <FollowButton gameId={game.id} />
        </div>
      </div>
    </Link>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="text-lg font-bold text-white mb-3">{title}</h2>
      {children}
    </section>
  );
}
