"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useFollow } from "@/lib/FollowContext";
import { createClient } from "@/lib/supabase/client";
import { getGamesByIds, getAllFranchises, getAlerts } from "@/lib/queries";
import type { Game, Franchise, GameAlert } from "@/lib/types";
import GameCard from "@/components/GameCard";

export default function ProfilePage() {
  const router = useRouter();
  const { user, consolePreference, signOut, loading: authLoading } = useAuth();
  const { followedGameIds, ownedGameIds, followedFranchiseIds, loading: followLoading } = useFollow();

  const [ownedGames, setOwnedGames] = useState<Game[]>([]);
  const [watchlistGames, setWatchlistGames] = useState<Game[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [alerts, setAlerts] = useState<GameAlert[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  // Load game/franchise data once follow state is ready
  useEffect(() => {
    if (!user || followLoading) return;

    const supabase = createClient();
    setDataLoading(true);

    const ownedIds = Array.from(ownedGameIds);
    const watchlistIds = Array.from(followedGameIds).filter((id) => !ownedGameIds.has(id));
    const franchiseIds = Array.from(followedFranchiseIds);

    Promise.all([
      ownedIds.length > 0 ? getGamesByIds(supabase, ownedIds) : Promise.resolve([]),
      watchlistIds.length > 0 ? getGamesByIds(supabase, watchlistIds) : Promise.resolve([]),
      franchiseIds.length > 0 ? getAllFranchises(supabase) : Promise.resolve([]),
      getAlerts(supabase, user.id),
    ])
      .then(([owned, watchlist, allFranchises, userAlerts]) => {
        setOwnedGames(owned);
        setWatchlistGames(watchlist);
        setFranchises(allFranchises.filter((f) => franchiseIds.includes(f.id)));
        setAlerts(userAlerts);
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));
  }, [user, followLoading, followedGameIds, ownedGameIds, followedFranchiseIds]);

  if (authLoading || !user) {
    return (
      <div className="px-4 py-6 min-h-[calc(100svh-80px)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const username = user.email?.split("@")[0] ?? "user";
  const initial = username[0]?.toUpperCase() ?? "?";
  const alertCount = alerts.length;

  // Estimated savings: owned games currently on sale
  const estimatedSavings = ownedGames
    .filter((g) => g.isOnSale)
    .reduce((sum, g) => sum + Math.max(0, g.originalPrice - g.currentPrice), 0);

  const consoleName =
    consolePreference === "switch2" ? "Nintendo Switch 2" :
    consolePreference === "switch" ? "Nintendo Switch" : null;

  return (
    <div className="px-4 py-6 pb-8 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <Link
          href="/settings"
          className="w-9 h-9 rounded-full bg-[#111111] border border-[#222222] flex items-center justify-center hover:border-[#333333] transition-colors"
          aria-label="Settings"
        >
          <svg className="w-4 h-4 text-[#444444]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </Link>
      </div>

      {/* Avatar + username */}
      <div className="flex flex-col items-center py-6">
        <div className="w-20 h-20 rounded-full bg-[#111111] border-2 border-[#00ff88]/30 flex items-center justify-center mb-3 shadow-[0_0_24px_#00ff8820]">
          <span className="text-[#00ff88] text-3xl font-bold">{initial}</span>
        </div>
        <p className="text-white text-lg font-semibold">{username}</p>
        {consoleName && (
          <p className="text-[#555555] text-xs mt-1">{consoleName}</p>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#111111] rounded-xl border border-[#222222] p-3 text-center">
          <p className="text-2xl font-bold text-white">{followedGameIds.size}</p>
          <p className="text-[#555555] text-xs mt-0.5">Following</p>
        </div>
        <div className="bg-[#111111] rounded-xl border border-[#222222] p-3 text-center">
          <p className="text-2xl font-bold text-white">{ownedGameIds.size}</p>
          <p className="text-[#555555] text-xs mt-0.5">Owned</p>
        </div>
        <div className="bg-[#111111] rounded-xl border border-[#222222] p-3 text-center">
          <p className="text-2xl font-bold text-white">{alertCount}</p>
          <p className="text-[#555555] text-xs mt-0.5">Alerts</p>
        </div>
      </div>

      {/* My Savings */}
      <div className="bg-[#111111] rounded-xl border border-[#00ff88]/20 p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#00ff88]/10 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-[#00ff88]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <div>
          <p className="font-mono text-[#00ff88] text-lg font-bold">${estimatedSavings.toFixed(2)}</p>
          <p className="text-[#555555] text-xs">
            {estimatedSavings > 0 ? "saved on owned games currently on sale" : "savings tracked here as you buy games on sale"}
          </p>
        </div>
      </div>

      {/* Owned Games */}
      {(dataLoading || ownedGames.length > 0) && (
        <section>
          <h2 className="text-[10px] font-bold text-[#666666] tracking-wider mb-3">
            OWNED GAMES ({ownedGames.length})
          </h2>
          {dataLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-[88px] bg-[#111111] rounded-xl border border-[#222222] animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {ownedGames.map((game) => <GameCard key={game.id} game={game} />)}
            </div>
          )}
        </section>
      )}

      {/* Watchlist */}
      {(dataLoading || watchlistGames.length > 0) && (
        <section>
          <h2 className="text-[10px] font-bold text-[#666666] tracking-wider mb-3">
            WATCHLIST ({watchlistGames.length})
          </h2>
          {dataLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-[88px] bg-[#111111] rounded-xl border border-[#222222] animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {watchlistGames.map((game) => <GameCard key={game.id} game={game} />)}
            </div>
          )}
        </section>
      )}

      {/* Empty state */}
      {!dataLoading && followedGameIds.size === 0 && ownedGameIds.size === 0 && (
        <div className="bg-[#111111] rounded-xl border border-[#222222] p-6 text-center">
          <p className="text-[#444444] text-sm mb-3">No games followed yet</p>
          <Link
            href="/home"
            className="inline-block px-4 py-2 bg-[#00ff88] text-[#0a0a0a] rounded-lg text-sm font-semibold"
          >
            Browse games
          </Link>
        </div>
      )}

      {/* Franchises */}
      {franchises.length > 0 && (
        <section>
          <h2 className="text-[10px] font-bold text-[#666666] tracking-wider mb-3">
            FRANCHISES ({franchises.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {franchises.map((f) => (
              <Link
                key={f.id}
                href={`/franchise/${encodeURIComponent(f.name)}`}
                className="px-3 py-1.5 bg-[#111111] border border-[#222222] rounded-full text-white text-sm hover:border-[#00ff88]/30 transition-colors"
              >
                {f.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Account */}
      <section>
        <h2 className="text-[10px] font-bold text-[#666666] tracking-wider mb-3">ACCOUNT</h2>
        <div className="bg-[#111111] rounded-xl border border-[#222222] divide-y divide-[#222222]">
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">Email</p>
              <p className="text-[#555555] text-xs mt-0.5">{user.email}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full p-4 text-left text-[#ff6874] text-sm font-medium hover:bg-[#ff6874]/5 transition-colors rounded-b-xl"
          >
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}
