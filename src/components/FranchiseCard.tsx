"use client";

import { Franchise, getGamesByFranchise } from "@/lib/mockData";
import FranchiseFollowButton from "./FranchiseFollowButton";

export default function FranchiseCard({ franchise }: { franchise: Franchise }) {
  const games = getGamesByFranchise(franchise.name);
  const onSaleCount = games.filter((g) => g.isOnSale).length;

  return (
    <div className="flex items-center justify-between p-4 bg-[#111111] rounded-xl border border-[#222222]">
      <div className="min-w-0 flex-1 mr-3">
        <h3 className="font-semibold text-white text-sm truncate">
          {franchise.name}
        </h3>
        <p className="text-[#666666] text-xs mt-0.5">
          {franchise.gameCount} games
          {onSaleCount > 0 && (
            <span className="text-[#00ff88]"> · {onSaleCount} on sale</span>
          )}
        </p>
      </div>
      <div className="shrink-0">
        <FranchiseFollowButton franchiseId={franchise.id} />
      </div>
    </div>
  );
}
