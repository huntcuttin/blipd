"use client";

import { useState, useEffect } from "react";
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
import type { Game } from "@/lib/types";

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

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Game[] | null>(null);
  const { followedGameIds, followedFranchiseIds, isAtLimit } = useFollow();

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

  // Followed content
  const followedGames = allGames.filter((g) => followedGameIds.has(g.id));
  const followedFranchiseList = allFranchises.filter((f) =>
    followedFranchiseIds.has(f.id)
  );
  const hasFollowed = followedGames.length > 0 || followedFranchiseList.length > 0;

  // Upcoming games
  const upcomingGames = allGames
    .filter((g) => g.releaseStatus === "upcoming" || g.releaseStatus === "out_today")
    .sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime());

  // Group upcoming by date
  const groupedUpcoming: Record<DateGroup, Game[]> = {
    today: [], tomorrow: [], this_week: [], next_week: [], later: [],
  };
  upcomingGames.forEach((game) => {
    groupedUpcoming[getDateGroup(game.releaseDate)].push(game);
  });

  // Trending for discovery
  const trending = allGames.slice(0, 8);

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
          {/* My Games - followed games with price/sale status */}
          {followedGames.length > 0 && (
            <Section title="My Games">
              <div className="space-y-2">
                {followedGames.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            </Section>
          )}

          {/* My Franchises */}
          {followedFranchiseList.length > 0 && (
            <Section title="My Franchises">
              <div className="space-y-2">
                {followedFranchiseList.map((franchise) => (
                  <div
                    key={franchise.id}
                    className="flex items-center justify-between p-3 bg-[#111111] rounded-xl border border-[#222222]"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={franchise.logo}
                        alt={franchise.name}
                        className="w-8 h-8 rounded-lg object-cover bg-[#1a1a1a] shrink-0"
                      />
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white text-sm">
                          {franchise.name}
                        </h3>
                        <p className="text-[#666666] text-xs">
                          {franchise.gameCount} games
                        </p>
                      </div>
                    </div>
                    <FranchiseFollowButton franchiseId={franchise.id} />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Upcoming */}
          <Section title="Upcoming">
            {upcomingGames.length === 0 ? (
              <p className="text-[#666666] text-sm py-4">No upcoming games</p>
            ) : (
              <div className="space-y-4">
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
          </Section>

          {/* Upsell */}
          {isAtLimit && (
            <div className="my-4">
              <UpsellBanner />
            </div>
          )}

          {/* Discover - franchises to follow */}
          <Section title="Discover Franchises">
            <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2">
              {allFranchises.map((franchise) => (
                <FranchiseCard key={franchise.id} franchise={franchise} />
              ))}
            </div>
          </Section>

          {/* Trending for discovery */}
          {!hasFollowed && (
            <Section title="Trending">
              <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2">
                {trending.map((game) => (
                  <GameCardCompact key={game.id} game={game} />
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

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
