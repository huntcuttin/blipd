"use client";

import { useState, useEffect } from "react";
import SearchBar from "@/components/SearchBar";
import GameCard, { GameCardCompact } from "@/components/GameCard";

import { useFollow } from "@/lib/FollowContext";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getAllGames, getAllFranchises, searchGames } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { computeGameScore } from "@/lib/ranking";
import type { Game } from "@/lib/types";

const FILTERS = ["All", "My Games", "My Franchises"] as const;
type Filter = (typeof FILTERS)[number];

export default function SalesPage() {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Game[] | null>(null);
  const [filter, setFilter] = useState<Filter>("All");
  const { followedGameIds, followedFranchiseIds } = useFollow();

  const { data: games } = useSupabaseQuery(getAllGames);
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

  // Build a set of franchise names the user follows
  const followedFranchiseNames = new Set(
    allFranchises
      .filter((f) => followedFranchiseIds.has(f.id))
      .map((f) => f.name)
  );

  const onSale = allGames.filter((g) => g.isOnSale);

  // Apply filter
  const filteredSales =
    filter === "My Games"
      ? onSale.filter((g) => followedGameIds.has(g.id))
      : filter === "My Franchises"
      ? onSale.filter((g) => g.franchise && followedFranchiseNames.has(g.franchise))
      : onSale;

  const allTimeLows = filteredSales.filter((g) => g.isAllTimeLow);
  const releasedSales = filteredSales
    .filter((g) => g.releaseStatus === "released")
    .sort((a, b) => b.discount - a.discount);
  const allDeals = [...releasedSales].sort((a, b) => computeGameScore(b) - computeGameScore(a));

  const myGamesCount = onSale.filter((g) => followedGameIds.has(g.id)).length;
  const myFranchisesCount = onSale.filter(
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
            <div className="text-center py-12">
              <p className="text-[#666666] text-sm">No games found</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Filter tabs */}
          <div className="flex gap-1 p-1 bg-[#111111] rounded-xl mb-4">
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
                  : "None of your followed franchise games are on sale right now"}
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

              {/* Recently Discounted */}
              {releasedSales.length > 0 && (
                <Section title="Recently Discounted">
                  <div className="space-y-2">
                    {releasedSales.slice(0, 10).map((game) => (
                      <GameCard key={game.id} game={game} />
                    ))}
                  </div>
                </Section>
              )}

              {/* All Deals */}
              {allDeals.length > releasedSales.slice(0, 10).length && (
                <Section title="All Deals">
                  <div className="space-y-2">
                    {allDeals.map((game) => (
                      <GameCard key={game.id} game={game} />
                    ))}
                  </div>
                </Section>
              )}
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
