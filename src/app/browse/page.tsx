"use client";

import { useState, useEffect } from "react";
import Logo from "@/components/Logo";
import SearchBar from "@/components/SearchBar";
import GameCard, { GameCardCompact } from "@/components/GameCard";
import FranchiseCard from "@/components/FranchiseCard";
import UpsellBanner from "@/components/UpsellBanner";
import { useFollow } from "@/lib/FollowContext";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getAllGames, getAllFranchises, searchGames } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import type { Game } from "@/lib/types";

export default function BrowsePage() {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Game[] | null>(null);
  const { isAtLimit } = useFollow();

  const { data: games } = useSupabaseQuery(getAllGames);
  const { data: franchises } = useSupabaseQuery(getAllFranchises);

  // Debounced search
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
  const trending = allGames.slice(0, 8);
  const onSale = allGames.filter((g) => g.isOnSale);
  const newReleases = allGames.filter((g) => {
    const d = new Date(g.releaseDate);
    const now = new Date();
    const daysAgo = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return g.releaseStatus === "released" && daysAgo >= 0 && daysAgo <= 7;
  });
  const comingSoon = allGames
    .filter((g) => g.releaseStatus === "upcoming" || g.releaseStatus === "out_today")
    .sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime())
    .slice(0, 5);

  return (
    <div className="px-4">
      {/* Header */}
      <div className="flex items-center justify-between py-4">
        <Logo size={28} />
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search Nintendo games..."
        />
      </div>

      {/* Search results inline */}
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
          {/* Trending — horizontal scroll */}
          <Section title="Trending">
            <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2">
              {trending.map((game) => (
                <GameCardCompact key={game.id} game={game} />
              ))}
            </div>
          </Section>

          {/* On Sale Now */}
          <Section title="On Sale Now">
            <div className="space-y-2">
              {onSale.slice(0, 6).map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          </Section>

          {/* Upsell banner */}
          {isAtLimit && (
            <div className="my-4">
              <UpsellBanner />
            </div>
          )}

          {/* Franchises — horizontal scroll, tucked away */}
          <Section title="Franchises">
            <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2">
              {(franchises ?? []).map((franchise) => (
                <FranchiseCard key={franchise.id} franchise={franchise} />
              ))}
            </div>
          </Section>

          {/* New Releases */}
          {newReleases.length > 0 && (
            <Section title="New Releases">
              <div className="space-y-2">
                {newReleases.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            </Section>
          )}

          {/* Coming Soon */}
          <Section title="Coming Soon">
            <div className="space-y-2">
              {comingSoon.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          </Section>
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
