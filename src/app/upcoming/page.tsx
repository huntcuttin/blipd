"use client";

import { useState } from "react";
import GameCard from "@/components/GameCard";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getAllGames } from "@/lib/queries";
import { useAuth } from "@/lib/AuthContext";
import type { Game } from "@/lib/types";

type SubTab = "Out Now" | "Coming Soon";
type PlatformFilter = "all" | "switch2";

export default function UpcomingPage() {
  const { consolePreference } = useAuth();
  const { data: games, loading, error } = useSupabaseQuery(getAllGames);
  const [subTab, setSubTab] = useState<SubTab>("Out Now");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>(
    consolePreference === "switch2" ? "switch2" : "all"
  );

  const allGames = (games ?? []).filter((g) => !g.isSuppressed);

  const filtered =
    platformFilter === "switch2"
      ? allGames.filter((g) => g.switch2Nsuid || /switch\s*2/i.test(g.title))
      : allGames;

  return (
    <div className="px-4">
      {/* Header */}
      <div className="flex items-center justify-between py-4">
        <h1 className="text-lg font-bold text-white">Upcoming</h1>
      </div>

      {/* Sub-tab pills */}
      <div className="flex gap-2 mb-4">
        {(["Out Now", "Coming Soon"] as SubTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              subTab === tab
                ? "bg-[#00ff88]/15 text-[#00ff88]"
                : "bg-[#1a1a1a] text-[#666666] hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-[#111111] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-[#666666] text-sm">Failed to load games</p>
        </div>
      ) : (
        <div className="mb-4">
          {subTab === "Out Now" ? (
            <OutNowView games={filtered} />
          ) : (
            <ComingSoonView games={filtered} />
          )}
        </div>
      )}

      {/* Platform toggle — bottom section */}
      <div className="sticky bottom-20 z-10 py-3">
        <div className="flex p-1 bg-[#111111] rounded-xl border border-[#222222]">
          {(["all", "switch2"] as PlatformFilter[]).map((pf) => (
            <button
              key={pf}
              onClick={() => setPlatformFilter(pf)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                platformFilter === pf
                  ? "bg-[#1a1a1a] text-white"
                  : "text-[#666666] hover:text-white"
              }`}
            >
              {pf === "all" ? "All Platforms" : "Switch 2 Only"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function OutNowView({ games }: { games: Game[] }) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const outNow = games
    .filter(
      (g) =>
        g.releaseStatus === "released" &&
        g.releaseDate >= thirtyDaysAgo &&
        g.releaseDate !== "2099-12-31" &&
        g.releaseDate !== "2020-01-01"
    )
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));

  if (outNow.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-[#666666] text-sm">No new releases in the last 30 days</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {outNow.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  );
}

function ComingSoonView({ games }: { games: Game[] }) {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const sixtyDaysOut = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const upcoming = games
    .filter(
      (g) =>
        (g.releaseStatus === "upcoming" || g.releaseStatus === "out_today") &&
        g.releaseDate >= today &&
        g.releaseDate <= sixtyDaysOut
    )
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));

  if (upcoming.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-[#666666] text-sm">No upcoming games in the next 60 days</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {upcoming.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  );
}
