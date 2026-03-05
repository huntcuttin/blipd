"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import FollowButton from "@/components/FollowButton";
import FranchiseFollowButton from "@/components/FranchiseFollowButton";
import { useFollow } from "@/lib/FollowContext";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getAllGames, getAllFranchises } from "@/lib/queries";
import type { Game } from "@/lib/types";

export default function WatchlistPage() {
  const [activeTab, setActiveTab] = useState<"games" | "franchises">("games");
  const { followedGameIds, followedFranchiseIds, toggleFollowGame } =
    useFollow();

  const { data: allGames } = useSupabaseQuery(getAllGames);
  const { data: allFranchises } = useSupabaseQuery(getAllFranchises);

  const followedGames = (allGames ?? []).filter((g) => followedGameIds.has(g.id));
  const followedFranchiseList = (allFranchises ?? []).filter((f) =>
    followedFranchiseIds.has(f.id)
  );

  const totalCount = followedGames.length + followedFranchiseList.length;

  return (
    <div className="px-4">
      {/* Header */}
      <div className="py-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-white">Watchlist</h1>
          {totalCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-[#00ff88]/15 text-[#00ff88] text-xs font-bold">
              {totalCount}
            </span>
          )}
        </div>
      </div>

      {totalCount === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-[#111111] rounded-xl mb-4">
            <TabButton
              active={activeTab === "games"}
              onClick={() => setActiveTab("games")}
              label={`Games${followedGames.length > 0 ? ` (${followedGames.length})` : ""}`}
            />
            <TabButton
              active={activeTab === "franchises"}
              onClick={() => setActiveTab("franchises")}
              label={`Franchises${followedFranchiseList.length > 0 ? ` (${followedFranchiseList.length})` : ""}`}
            />
          </div>

          {activeTab === "games" ? (
            <div className="space-y-2">
              {followedGames.map((game) => (
                <SwipeableGameCard
                  key={game.id}
                  game={game}
                  onUnfollow={() => toggleFollowGame(game.id)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {followedFranchiseList.length > 0 ? (
                followedFranchiseList.map((franchise) => (
                  <div
                    key={franchise.id}
                    className="flex items-center justify-between p-4 bg-[#111111] rounded-xl border border-[#222222]"
                  >
                    <div className="min-w-0 flex-1 mr-3">
                      <h3 className="font-semibold text-white text-sm">
                        {franchise.name}
                      </h3>
                      <p className="text-[#666666] text-xs mt-0.5">
                        {franchise.gameCount} games
                      </p>
                    </div>
                    <div className="shrink-0">
                      <FranchiseFollowButton franchiseId={franchise.id} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-[#666666] text-sm py-8">
                  No franchises followed yet
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="mb-6">
        <Logo size={64} showText={false} />
      </div>
      <h2 className="text-lg font-semibold text-white mb-2">
        You&apos;re not following any games yet
      </h2>
      <p className="text-[#666666] text-sm text-center mb-6">
        Follow games to track prices and get alerts
      </p>
      <Link
        href="/browse"
        className="px-6 py-3 bg-[#00ff88] text-[#0a0a0a] font-semibold rounded-xl shadow-[0_0_12px_#00ff88,0_0_24px_#00ff8844] hover:shadow-[0_0_16px_#00ff88,0_0_32px_#00ff8844] transition-all"
      >
        Browse games →
      </Link>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-[#1a1a1a] text-white"
          : "text-[#666666] hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function SwipeableGameCard({
  game,
  onUnfollow,
}: {
  game: Game;
  onUnfollow: () => void;
}) {
  const [swiped, setSwiped] = useState(false);
  const touchStartX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 50) {
      setSwiped(true);
    } else if (diff < -50) {
      setSwiped(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Unfollow action behind */}
      <div className="absolute inset-y-0 right-0 flex items-center bg-red-500/20 px-6">
        <button
          onClick={() => {
            onUnfollow();
            setSwiped(false);
          }}
          className="text-red-400 text-xs font-semibold"
        >
          Unfollow
        </button>
      </div>

      {/* Card */}
      <div
        className={`relative flex gap-3 p-3 bg-[#111111] border border-[#222222] transition-transform ${
          swiped ? "-translate-x-24" : "translate-x-0"
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => swiped && setSwiped(false)}
      >
        <Link href={`/game/${game.slug}`} className="flex gap-3 flex-1 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={game.coverArt}
            alt={game.title}
            className="w-14 h-14 rounded-lg object-cover object-center bg-[#1a1a1a] shrink-0"
          />
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <h3 className="font-semibold text-white text-sm truncate">
              {game.title}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-white text-xs font-bold">
                ${game.currentPrice.toFixed(2)}
              </span>
              {game.isOnSale && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#00ff88]/15 text-[#00ff88] text-[10px] font-bold">
                  -{game.discount}%
                </span>
              )}
            </div>
          </div>
        </Link>
        <div className="shrink-0 flex items-center">
          <FollowButton gameId={game.id} />
        </div>
      </div>
    </div>
  );
}
