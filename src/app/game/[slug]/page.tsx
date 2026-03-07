"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import FollowButton from "@/components/FollowButton";
import AlertCard from "@/components/AlertCard";
import { useFollow } from "@/lib/FollowContext";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getGameBySlug, getAlertsForGame, getFranchiseByName } from "@/lib/queries";

export default function GameDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { isFollowingFranchise, isFollowingGame, getNotifyPrefs, updateNotifyPrefs } = useFollow();

  const { data: game, loading: gameLoading } = useSupabaseQuery(
    (sb) => getGameBySlug(sb, slug),
    [slug]
  );

  const { data: alerts } = useSupabaseQuery(
    (sb) => (game ? getAlertsForGame(sb, game.id) : Promise.resolve([])),
    [game?.id]
  );

  const { data: franchise } = useSupabaseQuery(
    (sb) => (game?.franchise ? getFranchiseByName(sb, game.franchise) : Promise.resolve(null)),
    [game?.franchise]
  );

  if (gameLoading) {
    return (
      <div className="px-4 py-20 text-center">
        <div className="w-8 h-8 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="px-4 py-20 text-center">
        <p className="text-[#666666] text-sm">Game not found</p>
        <Link
          href="/home"
          className="inline-block mt-4 text-sm text-[#00ff88] hover:underline"
        >
          &larr; Back to Home
        </Link>
      </div>
    );
  }

  const followingFranchise = franchise ? isFollowingFranchise(franchise.id) : false;
  const releaseDate = new Date(game.releaseDate);
  const maxPrice = Math.max(...game.priceHistory.map((p) => p.price));
  const gameAlerts = alerts ?? [];

  return (
    <div className="pb-4">
      {/* Header with cover art */}
      <div className="relative h-56 bg-[#1a1a1a] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={game.coverArt}
          alt={game.title}
          className="w-full h-full object-cover object-center opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />

        {/* Back button */}
        <Link
          href="/home"
          className="absolute top-4 left-4 w-8 h-8 flex items-center justify-center rounded-full bg-[#0a0a0a]/60 backdrop-blur-sm text-white"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5 8.25 12l7.5-7.5"
            />
          </svg>
        </Link>

        {/* Title overlay */}
        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="text-2xl font-bold text-white leading-tight">
            {game.title}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[#666666] text-sm">{game.publisher}</span>
            {game.metacriticScore !== null && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold leading-none ${
                game.metacriticScore >= 75 ? "bg-[#00ce7a]/20 text-[#00ce7a]"
                : game.metacriticScore >= 50 ? "bg-[#ffbd3f]/20 text-[#ffbd3f]"
                : "bg-[#ff6874]/20 text-[#ff6874]"
              }`}>
                {game.metacriticScore}
              </span>
            )}
            {franchise && (
              <Link
                href={`/franchise/${encodeURIComponent(franchise.name)}`}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                  followingFranchise
                    ? "bg-[#00ff88]/15 text-[#00ff88] shadow-[0_0_8px_#00ff8844]"
                    : "bg-[#222222] text-[#666666] hover:text-white"
                }`}
              >
                {franchise.name}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="px-4">
        {/* Price section */}
        <div className="py-4 border-b border-[#222222]">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-white">
              ${game.currentPrice.toFixed(2)}
            </span>
            {game.isOnSale && (
              <>
                <span className="text-lg text-[#666666] line-through">
                  ${game.originalPrice.toFixed(2)}
                </span>
                <span className="px-2 py-1 rounded-full bg-[#00ff88]/15 text-[#00ff88] text-sm font-bold">
                  -{game.discount}%
                </span>
              </>
            )}
          </div>
          {game.isAllTimeLow && (
            <div className="mt-2">
              <span className="px-2.5 py-1 rounded-full bg-[#FFD700]/15 text-[#FFD700] text-xs font-bold">
                ALL TIME LOW
              </span>
            </div>
          )}
          <p className="text-[#666666] text-xs mt-3">
            {game.releaseStatus === "released"
              ? `Released ${releaseDate.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}`
              : game.releaseStatus === "out_today"
              ? "Released today"
              : `Releasing ${releaseDate.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}`}
          </p>
        </div>

        {/* Follow button */}
        <div className="py-4">
          <FollowButton gameId={game.id} size="large" />
          {isFollowingGame(game.id) && (
            <NotificationPrefs gameId={game.id} getNotifyPrefs={getNotifyPrefs} updateNotifyPrefs={updateNotifyPrefs} />
          )}
        </div>

        {/* Price history */}
        <div className="py-4 border-t border-[#222222]">
          <h2 className="text-sm font-bold text-white mb-3">Price History</h2>
          <div className="flex items-end gap-2 h-24">
            {game.priceHistory.map((point, i) => {
              const height = maxPrice > 0 ? (point.price / maxPrice) * 100 : 0;
              const isLatest = i === game.priceHistory.length - 1;
              return (
                <div
                  key={point.date}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <span
                    className={`text-[9px] font-medium ${
                      isLatest ? "text-[#00ff88]" : "text-[#666666]"
                    }`}
                  >
                    ${point.price.toFixed(0)}
                  </span>
                  <div
                    className={`w-full rounded-t-sm transition-all ${
                      isLatest ? "bg-[#00ff88]" : "bg-[#333333]"
                    }`}
                    style={{ height: `${Math.max(height, 4)}%` }}
                  />
                  <span className="text-[8px] text-[#666666]">
                    {point.date}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent alerts */}
        {gameAlerts.length > 0 && (
          <div className="py-4 border-t border-[#222222]">
            <h2 className="text-sm font-bold text-white mb-3">
              Recent Alerts
            </h2>
            <div className="space-y-2">
              {gameAlerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationPrefs({
  gameId,
  getNotifyPrefs,
  updateNotifyPrefs,
}: {
  gameId: string;
  getNotifyPrefs: (id: string) => { notifyRelease: boolean; notifyPrice: boolean };
  updateNotifyPrefs: (id: string, prefs: { notifyRelease?: boolean; notifyPrice?: boolean }) => void;
}) {
  const prefs = getNotifyPrefs(gameId);

  return (
    <div className="mt-3 space-y-2">
      <button
        onClick={() => updateNotifyPrefs(gameId, { notifyRelease: !prefs.notifyRelease })}
        className="w-full flex items-center justify-between p-3 bg-[#111111] rounded-xl border border-[#222222]"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#666666]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
          <span className="text-sm text-white">Notify on release</span>
        </div>
        <div className={`w-9 h-5 rounded-full transition-colors ${prefs.notifyRelease ? "bg-[#00ff88]" : "bg-[#333333]"}`}>
          <div className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-transform ${prefs.notifyRelease ? "translate-x-[18px]" : "translate-x-0.5"}`} />
        </div>
      </button>
      <button
        onClick={() => updateNotifyPrefs(gameId, { notifyPrice: !prefs.notifyPrice })}
        className="w-full flex items-center justify-between p-3 bg-[#111111] rounded-xl border border-[#222222]"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#666666]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
          </svg>
          <span className="text-sm text-white">Notify on price drops & sales</span>
        </div>
        <div className={`w-9 h-5 rounded-full transition-colors ${prefs.notifyPrice ? "bg-[#00ff88]" : "bg-[#333333]"}`}>
          <div className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-transform ${prefs.notifyPrice ? "translate-x-[18px]" : "translate-x-0.5"}`} />
        </div>
      </button>
    </div>
  );
}
