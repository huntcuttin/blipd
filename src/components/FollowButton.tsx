"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useFollow } from "@/lib/FollowContext";
import { PlusIcon, CheckIcon } from "@/components/icons";

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

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push("/login");
      return;
    }
    toggleFollowGame(gameId);
    if (navigator.vibrate) navigator.vibrate(10);
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
