"use client";

import Link from "next/link";
import { useFollow } from "@/lib/FollowContext";

/**
 * The release-time page is server-rendered for SEO, so it can't know follow
 * state itself. A static "Watch & Get Notified" shown to someone already
 * watching reads as the app not recognizing them (founder-reported).
 */
export default function ReleaseTimeCta({
  gameId,
  gameSlug,
  gameTitle,
  isReleased,
}: {
  gameId: string;
  gameSlug: string;
  gameTitle: string;
  isReleased: boolean;
}) {
  const { isFollowingGame, loading } = useFollow();
  const watching = !loading && isFollowingGame(gameId);

  if (watching) {
    return (
      <div className="bg-[#111111] rounded-xl border border-[#00ff88]/20 p-5 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="animate-radar-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff88] opacity-60" />
            <span className="relative inline-flex rounded-full bg-[#00ff88] h-2.5 w-2.5" />
          </span>
          <h3 className="text-[#00ff88] font-bold text-base">Watching</h3>
        </div>
        <p className="text-[#888888] text-sm mb-4">
          {isReleased
            ? `You'll hear the moment ${gameTitle} goes on sale.`
            : `You'll get an alert the moment ${gameTitle} is available.`}
        </p>
        <Link
          href={`/game/${gameSlug}`}
          className="inline-block px-7 py-3 rounded-full bg-transparent border border-[#3a3a3a] text-white text-sm font-bold hover:border-white active:scale-95 transition-all"
        >
          View game
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-[#111111] rounded-xl border border-[#00ff88]/20 p-5 text-center">
      <h3 className="text-white font-bold text-base mb-2">
        {isReleased ? "Track price drops" : "Don't miss the launch"}
      </h3>
      <p className="text-[#888888] text-sm mb-4">
        {isReleased
          ? `Get notified when ${gameTitle} goes on sale.`
          : `Watch ${gameTitle} on Blippd to get an alert the moment it's available.`}
      </p>
      <Link
        href={`/game/${gameSlug}`}
        className="inline-block px-7 py-3 rounded-full bg-[#00ff88] text-[#0a0a0a] text-sm font-bold hover:bg-[#00dd77] active:scale-95 transition-all"
      >
        {isReleased ? "View game" : "Watch & get notified"}
      </Link>
    </div>
  );
}
