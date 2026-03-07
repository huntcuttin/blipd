"use client";

import { useFollow } from "@/lib/FollowContext";

export default function FollowButton({
  gameId,
  size = "default",
}: {
  gameId: string;
  size?: "default" | "large";
}) {
  const { isFollowingGame, toggleFollowGame } = useFollow();
  const following = isFollowingGame(gameId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFollowGame(gameId);
  };

  const isLarge = size === "large";

  if (following) {
    return (
      <button
        onClick={handleClick}
        className={`flex items-center justify-center gap-1.5 font-semibold rounded-lg bg-[#00ff88] text-[#0a0a0a] transition-all active:scale-95 shadow-[0_0_12px_#00ff8855] ${
          isLarge ? "px-6 py-3 text-base w-full" : "min-h-[36px] px-3 py-1.5 text-xs"
        }`}
      >
        <CheckIcon className={isLarge ? "w-5 h-5" : "w-3.5 h-3.5"} />
        Following
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center justify-center gap-1.5 font-medium rounded-lg border border-[#333333] text-[#888888] transition-all active:scale-95 hover:border-[#00ff88] hover:text-[#00ff88] ${
        isLarge ? "px-6 py-3 text-base w-full" : "min-h-[36px] px-3 py-1.5 text-xs"
      }`}
    >
      <PlusIcon className={isLarge ? "w-5 h-5" : "w-3.5 h-3.5"} />
      Follow
    </button>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}
