"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useFollow } from "@/lib/FollowContext";
import { PlusIcon, CheckIcon } from "@/components/icons";

export default function FranchiseFollowButton({
  franchiseId,
  size = "default",
}: {
  franchiseId: string;
  size?: "default" | "large";
}) {
  const { user } = useAuth();
  const { isFollowingFranchise, toggleFollowFranchise } = useFollow();
  const router = useRouter();
  const following = isFollowingFranchise(franchiseId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push("/login");
      return;
    }
    toggleFollowFranchise(franchiseId);
  };

  const isLarge = size === "large";

  if (following) {
    return (
      <button
        onClick={handleClick}
        className={`flex items-center gap-1.5 font-semibold rounded-lg bg-[#1a1a1a] text-white border border-[#333333] transition-all ${
          isLarge ? "px-6 py-3 text-base w-full justify-center" : "px-3 py-1.5 text-xs"
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
      className={`flex items-center gap-1.5 font-semibold rounded-lg border border-[#333333] text-[#888888] transition-all hover:border-[#00ff88] hover:text-[#00ff88] ${
        isLarge ? "px-6 py-3 text-base w-full justify-center" : "px-3 py-1.5 text-xs"
      }`}
    >
      <PlusIcon className={isLarge ? "w-5 h-5" : "w-3.5 h-3.5"} />
      Follow
    </button>
  );
}

