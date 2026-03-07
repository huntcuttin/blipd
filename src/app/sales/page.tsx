"use client";

import { useState, useEffect } from "react";
import SearchBar from "@/components/SearchBar";
import GameCard, { GameCardCompact, GameCardSkeleton, GameCardCompactSkeleton } from "@/components/GameCard";

import { useFollow } from "@/lib/FollowContext";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getGamesOnSale, getAllFranchises, searchGames } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import type { Game } from "@/lib/types";

const FILTERS = ["All", "My Games", "My Franchises"] as const;
type Filter = (typeof FILTERS)[number];

const SORTS = ["Biggest Discount", "Lowest Price", "Ending Soon"] as const;
type SortMode = (typeof SORTS)[number];

function sortGames(games: Game[], mode: SortMode): Game[] {
  const sorted = [...games];
  switch (mode) {
    case "Biggest Discount":
      return sorted.sort((a, b) => b.discount - a.discount);
    case "Lowest Price":
      return sorted.sort((a, b) => a.currentPrice - b.currentPrice);
    case "Ending Soon":
      return sorted.sort((a, b) => {
        const aEnd = a.saleEndDate || "9999-12-31";
        const bEnd = b.saleEndDate || "9999-12-31";
        return aEnd.localeCompare(bEnd);
      });
  }
}

export default function SalesPage() {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Game[] | null>(null);
  const [filter, setFilter] = useState<Filter>("All");
  const [sort, setSort] = useState<SortMode>("Biggest Discount");
  const { followedGameIds, followedFranchiseIds } = useFollow();

  const { data: games, loading: gamesLoading } = useSupabaseQuery(getGamesOnSale);
  const { data: franchises } = useSupabaseQuery(getAllFranchises);

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

  const followedFranchiseNames = new Set(
    allFranchises
      .filter((f) => followedFranchiseIds.has(f.id))
      .map((f) => f.name)
  );

  // Games are already filtered to on-sale by the query
  const filteredSales =
    filter === "My Games"
      ? allGames.filter((g) => followedGameIds.has(g.id))
      : filter === "My Franchises"
      ? allGames.filter((g) => g.franchise && followedFranchiseNames.has(g.franchise))
      : allGames;

  const allTimeLows = filteredSales.filter((g) => g.isAllTimeLow);
  const sortedSales = sortGames(
    filteredSales.filter((g) => g.releaseStatus === "released"),
    sort
  );

  const myGamesCount = allGames.filter((g) => followedGameIds.has(g.id)).length;
  const myFranchisesCount = allGames.filter(
    (g) => g.franchise && followedFranchiseNames.has(g.franchise)
  ).length;

  return (
    <div className="px-4">
      {/* Header */}
      <div className="flex items-center justify-between py-4">
        <h1 className="text-2xl font-bold text-white">Sales</h1>
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search deals..."
        />
      </div>

      {/* Search results */}
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
      ) : gamesLoading ? (
        <div className="space-y-6">
          <div>
            <div className="h-5 bg-[#1a1a1a] rounded w-28 mb-3" />
            <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <GameCardCompactSkeleton key={i} />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <GameCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Filter tabs */}
          <div className="flex gap-1 p-1 bg-[#111111] rounded-xl mb-3">
            {FILTERS.map((f) => {
              const isActive = filter === f;
              const count =
                f === "My Games"
                  ? myGamesCount
                  : f === "My Franchises"
                  ? myFranchisesCount
                  : 0;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-[#1a1a1a] text-white"
                      : "text-[#666666] hover:text-white"
                  }`}
                >
                  {f}
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

          {filteredSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div className="w-16 h-16 rounded-2xl bg-[#111111] border border-[#222222] flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#444444]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">
                No sales found
              </h2>
              <p className="text-[#666666] text-sm text-center max-w-[260px]">
                {filter === "My Games"
                  ? "None of your followed games are on sale right now"
                  : filter === "My Franchises"
                  ? "None of your followed franchise games are on sale right now"
                  : "No games are on sale right now"}
              </p>
            </div>
          ) : (
            <>
              {/* All Time Lows */}
              {allTimeLows.length > 0 && (
                <Section title="All Time Lows">
                  <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2">
                    {allTimeLows.map((game) => (
                      <GameCardCompact key={game.id} game={game} />
                    ))}
                  </div>
                </Section>
              )}

              {/* Sort pills */}
              <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar">
                {SORTS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSort(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                      sort === s
                        ? "bg-[#00ff88]/15 text-[#00ff88]"
                        : "bg-[#1a1a1a] text-[#666666] hover:text-white"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Sorted deals */}
              <div className="space-y-2 pb-4">
                {sortedSales.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
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
