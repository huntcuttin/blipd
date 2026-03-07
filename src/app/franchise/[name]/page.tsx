"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import GameCard from "@/components/GameCard";
import FranchiseFollowButton from "@/components/FranchiseFollowButton";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getFranchiseByName, getGamesByFranchise } from "@/lib/queries";

export default function FranchiseDetailPage() {
  const params = useParams();
  const name = decodeURIComponent(params.name as string);

  const { data: franchise, loading } = useSupabaseQuery(
    (sb) => getFranchiseByName(sb, name),
    [name]
  );

  const { data: games } = useSupabaseQuery(
    (sb) => getGamesByFranchise(sb, name),
    [name]
  );

  if (loading) {
    return (
      <div className="px-4 py-20 text-center">
        <div className="w-8 h-8 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!franchise) {
    return (
      <div className="px-4 py-20 text-center">
        <p className="text-[#666666] text-sm">Franchise not found</p>
        <Link
          href="/home"
          className="inline-block mt-4 text-sm text-[#00ff88] hover:underline"
        >
          &larr; Back to Home
        </Link>
      </div>
    );
  }

  const allGames = games ?? [];
  const onSale = allGames.filter((g) => g.isOnSale);
  const notOnSale = allGames.filter((g) => !g.isOnSale);

  return (
    <div className="pb-4">
      {/* Header with franchise logo */}
      <div className="relative h-48 bg-[#1a1a1a] overflow-hidden">
        {franchise.logo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={franchise.logo}
              alt={franchise.name}
              className="w-full h-full object-cover object-center opacity-40 scale-110 blur-sm"
            />
          </>
        ) : (
          <div className="w-full h-full bg-[#1a1a1a]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />

        {/* Back button */}
        <Link
          href="/home"
          className="absolute top-4 left-4 w-8 h-8 flex items-center justify-center rounded-full bg-[#0a0a0a]/60 backdrop-blur-sm text-white"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5 8.25 12l7.5-7.5"
            />
          </svg>
        </Link>

        {/* Franchise info overlay */}
        <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3">
          {franchise.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={franchise.logo}
              alt={franchise.name}
              className="w-16 h-16 rounded-2xl object-cover bg-[#1a1a1a] border border-[#333333] shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-[#1a1a1a] border border-[#333333] flex items-center justify-center shrink-0">
              <span className="text-[#666666] text-lg font-bold">{franchise.name.slice(0, 2).toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white leading-tight">
              {franchise.name}
            </h1>
            <p className="text-[#666666] text-sm mt-0.5">
              {franchise.gameCount} games
              {onSale.length > 0 && (
                <span className="text-[#00ff88]"> · {onSale.length} on sale</span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4">
        {/* Follow button */}
        <div className="py-4 border-b border-[#222222]">
          <FranchiseFollowButton franchiseId={franchise.id} size="large" />
        </div>

        {/* On Sale section */}
        {onSale.length > 0 && (
          <div className="pt-4">
            <h2 className="text-[10px] font-bold text-[#00ff88] tracking-wider mb-2">
              ON SALE
            </h2>
            <div className="space-y-2">
              {onSale.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          </div>
        )}

        {/* All Games section */}
        {notOnSale.length > 0 && (
          <div className="pt-4">
            <h2 className="text-[10px] font-bold text-[#666666] tracking-wider mb-2">
              ALL GAMES
            </h2>
            <div className="space-y-2">
              {notOnSale.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          </div>
        )}

        {allGames.length === 0 && !loading && (
          <div className="text-center py-16">
            <p className="text-[#666666] text-sm">No games found</p>
          </div>
        )}
      </div>
    </div>
  );
}
