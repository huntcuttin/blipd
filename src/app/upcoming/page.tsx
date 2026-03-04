"use client";

import { useState, useEffect } from "react";
import FollowButton from "@/components/FollowButton";
import { useFollow } from "@/lib/FollowContext";
import { mockGames, Game } from "@/lib/mockData";
import Link from "next/link";

type DateGroup = "today" | "tomorrow" | "this_week" | "next_week" | "later";

interface GroupedGames {
  today: Game[];
  tomorrow: Game[];
  this_week: Game[];
  next_week: Game[];
  later: Game[];
}

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

function groupGames(games: Game[]): GroupedGames {
  const groups: GroupedGames = {
    today: [],
    tomorrow: [],
    this_week: [],
    next_week: [],
    later: [],
  };
  games.forEach((game) => {
    const group = getDateGroup(game.releaseDate);
    groups[group].push(game);
  });
  return groups;
}

const GROUP_LABELS: Record<DateGroup, string> = {
  today: "TODAY",
  tomorrow: "TOMORROW",
  this_week: "THIS WEEK",
  next_week: "NEXT WEEK",
  later: "LATER",
};

export default function UpcomingPage() {
  const [filter, setFilter] = useState<"all" | "watchlist">("all");
  const { followedGameIds } = useFollow();

  // Include upcoming and out_today games, plus recently released (today or just released)
  const upcomingGames = mockGames
    .filter((g) => {
      const isUpcomingOrRecent =
        g.releaseStatus === "upcoming" ||
        g.releaseStatus === "out_today";
      if (filter === "watchlist") {
        return isUpcomingOrRecent && followedGameIds.has(g.id);
      }
      return isUpcomingOrRecent;
    })
    .sort(
      (a, b) =>
        new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()
    );

  const grouped = groupGames(upcomingGames);

  return (
    <div className="px-4">
      {/* Header */}
      <div className="py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Upcoming</h1>
          <div className="flex gap-1 p-1 bg-[#111111] rounded-lg">
            <ToggleButton
              active={filter === "all"}
              onClick={() => setFilter("all")}
              label="All Games"
            />
            <ToggleButton
              active={filter === "watchlist"}
              onClick={() => setFilter("watchlist")}
              label="My Watchlist"
            />
          </div>
        </div>
      </div>

      {/* Grouped lists */}
      {upcomingGames.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[#666666] text-sm">
            {filter === "watchlist"
              ? "No upcoming games in your watchlist"
              : "No upcoming games"}
          </p>
        </div>
      ) : (
        <div className="space-y-6 pb-4">
          {(Object.keys(grouped) as DateGroup[]).map((group) => {
            const games = grouped[group];
            if (games.length === 0) return null;
            return (
              <div key={group}>
                <h2 className="text-xs font-bold text-[#666666] tracking-wider mb-3">
                  {GROUP_LABELS[group]}
                </h2>
                <div className="space-y-2">
                  {games.map((game) => (
                    <UpcomingGameCard key={game.id} game={game} group={group} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UpcomingGameCard({ game, group }: { game: Game; group: DateGroup }) {
  return (
    <div className="flex gap-3 p-3 bg-[#111111] rounded-xl border border-[#222222]">
      <Link href={`/game/${game.slug}`} className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={game.coverArt}
          alt={game.title}
          className="w-14 h-14 rounded-lg object-cover bg-[#1a1a1a]"
        />
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/game/${game.slug}`}>
          <h3 className="font-semibold text-white text-sm truncate">
            {game.title}
          </h3>
          <p className="text-[#666666] text-xs mt-0.5">{game.publisher}</p>
        </Link>
        <div className="flex items-center gap-2 mt-1.5">
          <ReleaseInfo game={game} group={group} />
        </div>
      </div>
      <div className="shrink-0 flex items-center">
        <FollowButton gameId={game.id} />
      </div>
    </div>
  );
}

function ReleaseInfo({ game, group }: { game: Game; group: DateGroup }) {
  if (group === "today" || game.releaseStatus === "out_today") {
    return (
      <span className="px-2 py-0.5 rounded-full bg-[#00ff88]/15 text-[#00ff88] text-[10px] font-bold">
        Out Now
      </span>
    );
  }
  if (group === "tomorrow") {
    return <CountdownTimer releaseDate={game.releaseDate} />;
  }
  const d = new Date(game.releaseDate);
  return (
    <span className="text-[#666666] text-xs">
      {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
      {game.releaseStatus === "upcoming" && " · 12:00 AM PT"}
    </span>
  );
}

function CountdownTimer({ releaseDate }: { releaseDate: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    function update() {
      const now = new Date();
      const target = new Date(releaseDate);
      const diff = target.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft("Out now!");
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`releases in ${hours}h ${minutes}m`);
    }

    update();
    const interval = setInterval(update, 60000); // update every minute
    return () => clearInterval(interval);
  }, [releaseDate]);

  return (
    <span className="text-[#00ff88] text-xs font-medium">
      {timeLeft}
    </span>
  );
}

function ToggleButton({
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
      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
        active
          ? "bg-[#1a1a1a] text-white"
          : "text-[#666666] hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}
