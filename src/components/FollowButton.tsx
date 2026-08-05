"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useFollow } from "@/lib/FollowContext";
import { RadarIcon } from "@/components/icons";

export default function FollowButton({
  gameId,
  size = "default",
}: {
  gameId: string;
  size?: "default" | "large";
}) {
  const { user } = useAuth();
  const { isFollowingGame, toggleFollowGame } = useFollow();
  const router = useRouter();
  const following = isFollowingGame(gameId);
  const [pulse, setPulse] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push("/login");
      return;
    }
    const willFollow = !following;
    toggleFollowGame(gameId);
    if (willFollow) setPulse(true);
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const isLarge = size === "large";

  // Spotify-style pill (founder reference 2026-08-04): transparent bg,
  // hairline border, bold label, fully rounded. State reads through border
  // and text color alone -- no fills, no boxes. Watching adds the live
  // radar dot: "the radar is armed for this game."
  if (following) {
    return (
      <button
        onClick={handleClick}
        onAnimationEnd={() => setPulse(false)}
        className={`flex items-center justify-center gap-2 font-bold rounded-full bg-transparent text-[#00ff88] border border-[#00ff88]/70 transition-all active:scale-95 hover:border-[#00ff88] ${
          pulse ? "animate-follow-pulse" : ""
        } ${isLarge ? "px-7 py-3 text-base w-full" : "min-h-[44px] px-4 py-1.5 text-xs"}`}
      >
        <span className={`relative flex ${isLarge ? "h-2.5 w-2.5" : "h-2 w-2"}`} aria-hidden="true">
          <span className="animate-radar-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff88] opacity-60" />
          <span className={`relative inline-flex rounded-full bg-[#00ff88] ${isLarge ? "h-2.5 w-2.5" : "h-2 w-2"}`} />
        </span>
        Watching
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center justify-center gap-1.5 font-bold rounded-full bg-transparent border border-[#3a3a3a] text-white transition-all active:scale-95 hover:border-white ${
        isLarge ? "px-7 py-3 text-base w-full" : "min-h-[44px] px-4 py-1.5 text-xs"
      }`}
    >
      <RadarIcon className={isLarge ? "w-5 h-5" : "w-3.5 h-3.5"} />
      Watch
    </button>
  );
}
