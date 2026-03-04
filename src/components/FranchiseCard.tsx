"use client";

import { Franchise, getGamesByFranchise } from "@/lib/mockData";
import FranchiseFollowButton from "./FranchiseFollowButton";

export default function FranchiseCard({ franchise }: { franchise: Franchise }) {
  const games = getGamesByFranchise(franchise.name);
  const onSaleCount = games.filter((g) => g.isOnSale).length;

  return (
    <div className="shrink-0 w-[120px] flex flex-col items-center text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={franchise.logo}
        alt={franchise.name}
        className="w-16 h-16 rounded-2xl object-cover object-center bg-[#1a1a1a] shadow-lg"
      />
      <h3 className="font-semibold text-white text-xs mt-2 leading-tight truncate w-full">
        {franchise.name}
      </h3>
      <p className="text-[#666666] text-[10px] mt-0.5">
        {franchise.gameCount} games
        {onSaleCount > 0 && (
          <span className="text-[#00ff88]"> · {onSaleCount} on sale</span>
        )}
      </p>
      <div className="mt-2">
        <FranchiseFollowButton franchiseId={franchise.id} />
      </div>
    </div>
  );
}
