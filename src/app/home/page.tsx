"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import SearchBar from "@/components/SearchBar";
import DirectBanner from "@/components/DirectBanner";
import GameCard, { GameCardCompact, GameCardSkeleton } from "@/components/GameCard";
import FranchiseFollowButton from "@/components/FranchiseFollowButton";

import { useAuth } from "@/lib/AuthContext";
import { useFollow } from "@/lib/FollowContext";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getGamesByIds, getAllFranchises, searchGames } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import type { Game, Franchise } from "@/lib/types";

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Game[] | null>(null);
  const { user, consolePreference } = useAuth();
  const { followedGameIds, followedFranchiseIds, ownedGameIds, toggleOwnGame } = useFollow();

  const followedIds = useMemo(() => Array.from(followedGameIds), [followedGameIds]);
  const { data: followedGamesData, loading: followedLoading } = useSupabaseQuery(
    (sb) => followedIds.length > 0 ? getGamesByIds(sb, followedIds) : Promise.resolve([]),
    [followedIds.join(",")]
  );
  const { data: franchises } = useSupabaseQuery(getAllFranchises);

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

  // Split followed games into categories
  const onSale = followedGames.filter((g) => g.isOnSale && !ownedGameIds.has(g.id));
  const watching = followedGames.filter((g) => !g.isOnSale && !ownedGameIds.has(g.id));
  const owned = followedGames.filter((g) => ownedGameIds.has(g.id));

  const hasPersonalContent = followedGames.length > 0 || followedFranchiseList.length > 0;

  return (
    <div className="px-4">
      {/* Header */}
      <div className="flex items-center justify-between py-3">
        <Logo size={28} />
        <div className="flex items-center gap-2">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search games..."
          />
          {user ? (
            <Link
              href="/profile"
              aria-label="Profile"
              className="shrink-0 w-10 h-10 rounded-full bg-[#111111] border border-[#222222] flex items-center justify-center text-white hover:border-[#333333] transition-all"
            >
              <span className="text-[13px] font-bold">{user.email?.[0]?.toUpperCase()}</span>
            </Link>
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
      ) : !user ? (
        /* Logged-out state */
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#111111] border border-[#222222] flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#444444]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Your games, your deals</h2>
          <p className="text-[#666666] text-sm max-w-[260px] mb-6">
            Sign in to follow games and get alerted the moment prices drop.
          </p>
          <Link
            href="/login"
            className="px-6 py-3 rounded-xl bg-[#00ff88] text-[#0a0a0a] text-sm font-semibold hover:shadow-[0_0_16px_#00ff8855] transition-all"
          >
            Sign in to get started
          </Link>
          <Link
            href="/sales"
            className="mt-3 text-xs text-[#888888] hover:text-white transition-colors"
          >
            Browse deals without an account →
          </Link>
        </div>
      ) : followedLoading ? (
        <div className="space-y-2 pt-2">
          {Array.from({ length: 4 }).map((_, i) => <GameCardSkeleton key={i} />)}
        </div>
      ) : !hasPersonalContent ? (
        /* Signed in but nothing followed */
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#111111] border border-[#222222] flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#444444]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No games yet</h2>
          <p className="text-[#666666] text-sm max-w-[260px] mb-4">
            Follow games to track prices and get alerts when they go on sale.
          </p>
          <Link
            href="/sales"
            className="px-5 py-2.5 rounded-xl bg-[#00ff88] text-[#0a0a0a] text-sm font-semibold hover:shadow-[0_0_12px_#00ff8855] transition-all"
          >
            Browse deals
          </Link>
        </div>
      ) : (
        /* Personal dashboard */
        <div className="space-y-5 pb-4">
          {/* On Sale Now — most important section */}
          {onSale.length > 0 && (
            <section>
              <h2 className="text-[10px] font-bold text-[#00ff88] tracking-wider mb-2 uppercase">On Sale Now</h2>
              {onSale.length <= 4 ? (
                <div className="space-y-2">
                  {onSale.map((game) => (
                    <GameCard key={game.id} game={game} ownAction={() => toggleOwnGame(game.id)} />
                  ))}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto -mx-4 px-4 no-scrollbar mb-2">
                    <div className="flex gap-3 pb-1">
                      {onSale.map((game) => (
                        <GameCardCompact key={game.id} game={game} />
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-[#555555]">{onSale.length} of your games are on sale</p>
                </>
              )}
            </section>
          )}

          {/* Watching for Deals */}
          {watching.length > 0 && (
            <section>
              <h2 className="text-[10px] font-bold text-[#666666] tracking-wider mb-2 uppercase">Watching for Deals</h2>
              <div className="space-y-2">
                {watching.map((game) => (
                  <GameCard key={game.id} game={game} ownAction={() => toggleOwnGame(game.id)} />
                ))}
              </div>
            </section>
          )}

          {/* My Library */}
          {owned.length > 0 && (
            <section>
              <h2 className="text-[10px] font-bold text-[#7c3aed]/60 tracking-wider mb-2 uppercase">My Library</h2>
              <div className="space-y-2">
                {owned.map((game) => <GameCard key={game.id} game={game} />)}
              </div>
            </section>
          )}

          {/* Franchises */}
          {followedFranchiseList.length > 0 && (
            <section>
              <h2 className="text-[10px] font-bold text-[#666666] tracking-wider mb-2 uppercase">My Franchises</h2>
              <div className="space-y-2">
                {followedFranchiseList.map((franchise) => (
                  <FranchiseRow key={franchise.id} franchise={franchise} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function FranchiseRow({ franchise }: { franchise: Franchise }) {
  return (
    <div className="flex items-center justify-between p-3 bg-[#111111] rounded-xl border border-[#222222] hover:border-[#333333] transition-all">
      <Link
        href={`/franchise/${encodeURIComponent(franchise.name)}`}
        className="flex items-center gap-3 min-w-0 flex-1 mr-3"
      >
        {franchise.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={franchise.logo}
            alt={franchise.name}
            className="w-12 h-12 rounded-xl object-cover bg-[#1a1a1a] shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] border border-[#333333] flex items-center justify-center shrink-0">
            <span className="text-[#888888] text-sm font-bold">{franchise.name.charAt(0).toUpperCase()}</span>
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
