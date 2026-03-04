"use client";

import { useFollow } from "@/lib/FollowContext";
import { useState } from "react";

export default function FollowButton({
  gameId,
  size = "default",
}: {
  gameId: string;
  size?: "default" | "large";
}) {
  const { isFollowingGame, toggleFollowGame, isAtLimit } = useFollow();
  const following = isFollowingGame(gameId);
  const [showLimitToast, setShowLimitToast] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const success = toggleFollowGame(gameId);
    if (!success) {
      setShowLimitToast(true);
      setTimeout(() => setShowLimitToast(false), 2000);
    }
  };

  const isLarge = size === "large";

  if (following) {
    return (
      <button
        onClick={handleClick}
        className={`flex items-center gap-1.5 font-semibold rounded-lg bg-[#00ff88] text-[#0a0a0a] transition-all shadow-[0_0_12px_#00ff88,0_0_24px_#00ff8844] hover:shadow-[0_0_16px_#00ff88,0_0_32px_#00ff8844] ${
          isLarge ? "px-6 py-3 text-base w-full justify-center" : "px-3 py-1.5 text-xs"
        }`}
      >
        <CheckIcon className={isLarge ? "w-5 h-5" : "w-3.5 h-3.5"} />
        Following
      </button>
    );
  }

  if (isAtLimit && !following) {
    return (
      <div className="relative">
        <button
          onClick={handleClick}
          className={`flex items-center gap-1.5 font-semibold rounded-lg border border-[#444444] text-[#444444] transition-all ${
            isLarge ? "px-6 py-3 text-base w-full justify-center" : "px-3 py-1.5 text-xs"
          }`}
        >
          <LockIcon className={isLarge ? "w-5 h-5" : "w-3.5 h-3.5"} />
          Follow
        </button>
        {showLimitToast && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#111111] border border-[#00ff88]/30 rounded-lg text-xs text-white whitespace-nowrap shadow-[0_0_12px_#00ff8844] z-50">
            Upgrade to Blipd Pro for unlimited follows
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1.5 font-semibold rounded-lg border border-[#00ff88] text-[#00ff88] transition-all hover:bg-[#00ff88]/10 ${
        isLarge ? "px-6 py-3 text-base w-full justify-center" : "px-3 py-1.5 text-xs"
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

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  );
}
