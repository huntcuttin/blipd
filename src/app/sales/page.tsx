"use client";

import { useState, useEffect } from "react";
import SearchBar from "@/components/SearchBar";
import GameCard, { GameCardCompact } from "@/components/GameCard";
import UpsellBanner from "@/components/UpsellBanner";
import { useFollow } from "@/lib/FollowContext";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getAllGames, searchGames } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import type { Game } from "@/lib/types";

export default function SalesPage() {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Game[] | null>(null);
  const { isAtLimit } = useFollow();

  const { data: games } = useSupabaseQuery(getAllGames);

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
  const onSale = allGames.filter((g) => g.isOnSale);
  const allTimeLows = onSale.filter((g) => g.isAllTimeLow);
  const biggestDiscounts = [...onSale].sort((a, b) => b.discount - a.discount);

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

          {/* Biggest Discounts */}
          <Section title="Biggest Discounts">
            <div className="space-y-2">
              {biggestDiscounts.slice(0, 10).map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          </Section>

          {/* Upsell */}
          {isAtLimit && (
            <div className="my-4">
              <UpsellBanner />
            </div>
          )}

          {/* All On Sale */}
          {onSale.length > biggestDiscounts.slice(0, 10).length && (
            <Section title="All On Sale">
              <div className="space-y-2">
                {onSale.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            </Section>
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
