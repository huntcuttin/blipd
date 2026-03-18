"use client";

import { useState } from "react";
import Link from "next/link";
import FollowButton from "@/components/FollowButton";
import AlertCard from "@/components/AlertCard";
import NotifyPrefsPanel from "@/components/NotifyPrefsPanel";
import TargetPriceInput from "@/components/TargetPriceInput";
import QueryError from "@/components/QueryError";
import GameCoverImage from "@/components/GameCoverImage";
import { useFollow } from "@/lib/FollowContext";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getGameBySlug, getAlertsForGame, getFranchiseByName, getGameFollowerCount } from "@/lib/queries";
import { formatPrice, formatShortDate, formatLongDate, isPlaceholderDate, isYearOnlyDate } from "@/lib/format";
import type { NotifyPrefs } from "@/lib/types";

export default function GameDetailClient({ slug }: { slug: string }) {
  const { isFollowingFranchise, isFollowingGame, isOwningGame, toggleOwnGame, getGamePrefs, updateGamePrefs } = useFollow();
  const [justAdded, setJustAdded] = useState(false);
  const [showCopied, setShowCopied] = useState(false);

  const { data: game, loading: gameLoading, error: gameError } = useSupabaseQuery(
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

  const { data: followerCount } = useSupabaseQuery(
    (sb) => (game ? getGameFollowerCount(sb, game.id) : Promise.resolve(0)),
    [game?.id]
  );

  if (gameLoading) {
    return (
      <div className="px-4 py-20 text-center">
        <div className="w-8 h-8 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (gameError) {
    return <QueryError subject="game" />;
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

  const handleLibraryToggle = () => {
    const wasOwned = isOwningGame(game!.id);
    toggleOwnGame(game!.id);
    if (!wasOwned) {
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 700);
    }
  };

  const followingFranchise = franchise ? isFollowingFranchise(franchise.id) : false;
  const placeholderDate = isPlaceholderDate(game.releaseDate);
  const priceHistory = game.priceHistory;
  const maxPrice = priceHistory.length > 0 ? Math.max(...priceHistory.map((p) => p.price)) : 0;
  const minPrice = priceHistory.length > 0 ? Math.min(...priceHistory.map((p) => p.price)) : 0;
  const gameAlerts = alerts ?? [];

  return (
    <main className="pb-4">
      {/* Header with cover art */}
      <div className="relative h-56 bg-[#1a1a1a] overflow-hidden">
        <GameCoverImage
          src={game.coverArt}
          alt={game.title}
          className="w-full h-full object-cover object-center opacity-60 bg-[#1a1a1a]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />

        {/* Back button */}
        <Link
          href="/home"
          aria-label="Back to Home"
          className="absolute left-2 w-11 h-11 flex items-center justify-center rounded-full bg-[#0a0a0a]/60 backdrop-blur-sm text-white"
          style={{ top: 'calc(8px + env(safe-area-inset-top, 0px))' }}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
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
          <h1 className="text-2xl font-bold text-white leading-tight line-clamp-2">
            {game.title}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            {game.publisher && <span className="text-[#888888] text-sm">{game.publisher}</span>}
            {(followerCount ?? 0) > 0 && (
              <span className="text-[#555555] text-xs">
                {followerCount} watching
              </span>
            )}
            {game.metacriticScore !== null && (
              <span
                aria-label={`Critic rating: ${game.metacriticScore}`}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold leading-none ${
                  game.metacriticScore >= 85 ? "bg-[#00ce7a]/20 text-[#00ce7a]"
                  : game.metacriticScore >= 70 ? "bg-[#ffbd3f]/20 text-[#ffbd3f]"
                  : "bg-[#ff6874]/20 text-[#ff6874]"
                }`}
              >
                {game.metacriticScore}%
              </span>
            )}
            {franchise && (
              <Link
                href={`/franchise/${encodeURIComponent(franchise.name)}`}
                className={`px-3 py-2 rounded-full text-xs font-medium transition-all ${
                  followingFranchise
                    ? "bg-[#00ff88]/15 text-[#00ff88] shadow-[0_0_8px_#00ff8844]"
                    : "bg-[#222222] text-[#888888] hover:text-white"
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
              {game.currentPrice === 0 && game.originalPrice === 0 ? "Free" : formatPrice(game.currentPrice)}
            </span>
            {game.isOnSale && (
              <>
                <span className="text-lg text-[#888888] line-through">
                  {formatPrice(game.originalPrice)}
                </span>
                {game.discount != null && (
                  <span className="px-2 py-1 rounded-full bg-[#00ff88]/15 text-[#00ff88] text-sm font-bold">
                    -{game.discount}%
                  </span>
                )}
              </>
            )}
            {game.isOnSale && game.saleEndDate && (
              <span className="text-[#ff6874] text-sm font-medium ml-1">
                Sale ends {formatShortDate(game.saleEndDate)}
              </span>
            )}
          </div>
          {game.isAllTimeLow && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/20">
              <svg className="w-4 h-4 text-[#FFD700]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6 9 12.75l4.286-4.286a11.948 11.948 0 0 1 4.306 6.43l.776 2.898m0 0 3.182-5.511m-3.182 5.51-5.511-3.181" />
              </svg>
              <span className="text-[#FFD700] text-xs font-bold tracking-wide">ALL TIME LOW PRICE</span>
            </div>
          )}
          {/* Switch 2 / Upgrade Pack editions */}
          {(game.switch2Nsuid || game.upgradePackPrice != null) && (
            <div className="mt-3 space-y-1.5">
              {game.switch2Nsuid && (
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded-full bg-[#00aaff]/15 text-[#00aaff] text-[10px] font-bold">
                    Switch 2
                  </span>
                  <span className="text-[#999999] text-xs">Edition available</span>
                </div>
              )}
              {game.upgradePackPrice != null && (
                <div className="flex items-center gap-2">
                  <span className="text-[#999999] text-xs">
                    Upgrade Pack: <span className="text-white font-medium">{formatPrice(game.upgradePackPrice)}</span>
                  </span>
                </div>
              )}
            </div>
          )}
          <p className="text-[#888888] text-xs mt-3">
            {placeholderDate
              ? "Release date TBD"
              : game.releaseStatus === "released"
              ? `Released ${formatLongDate(game.releaseDate)}`
              : game.releaseStatus === "out_today"
              ? "Released today"
              : isYearOnlyDate(game.releaseDate)
              ? `Releasing in ${new Date(game.releaseDate + "T12:00:00").getFullYear()}`
              : `Releasing ${formatLongDate(game.releaseDate)}`}
          </p>
          {game.releaseStatus === "upcoming" && !placeholderDate && !isYearOnlyDate(game.releaseDate) && (
            <a
              href={`/games/${game.slug}/release-time`}
              className="inline-block mt-1.5 text-[#00ff88] text-xs font-medium hover:underline"
            >
              What time does it launch? →
            </a>
          )}
        </div>

        {/* Sticky follow + own buttons */}
        <div className="sticky z-10 py-4 bg-[#0a0a0a]" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
          <div className="flex gap-2">
            <div className="flex-1">
              <FollowButton gameId={game.id} size="large" />
            </div>
            <button
              onClick={handleLibraryToggle}
              aria-pressed={isOwningGame(game.id)}
              className={`shrink-0 px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-300 ${
                justAdded
                  ? "scale-110 bg-[#003322] border-[#00ff88]/60 text-[#00ff88]"
                  : isOwningGame(game.id)
                  ? "bg-[#1a0f3a] border-[#7c3aed]/40 text-[#a78bfa]"
                  : "bg-[#111111] border-[#222222] text-[#666666] hover:border-[#444444] hover:text-white"
              }`}
            >
              {justAdded ? "🎮 Added!" : isOwningGame(game.id) ? "✓ In Library" : "Add to Library"}
            </button>
          </div>
        </div>

        {/* Notification preferences */}
        {isFollowingGame(game.id) && (
          <div className="pb-3 border-b border-[#222222]">
            <h2 className="text-xs font-bold text-[#666666] tracking-wider mb-2">NOTIFY ME ABOUT</h2>
            <NotifyPrefsPanel
              prefs={getGamePrefs(game.id)}
              onChange={(key: keyof NotifyPrefs, value: boolean) => updateGamePrefs(game.id, { [key]: value })}
            />
          </div>
        )}

        {/* Target price */}
        <TargetPriceInput
          gameId={game.id}
          currentPrice={game.currentPrice}
          originalPrice={game.originalPrice}
        />

        {/* eShop link + Share */}
        <div className="flex gap-2 py-3">
          <a
            href={game.nsuid
              ? `https://www.nintendo.com/us/store/products/${game.nsuid}`
              : "https://www.nintendo.com/us/store/"
            }
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#111111] border border-[#222222] text-[#999999] text-sm font-medium hover:border-[#333333] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            eShop
          </a>
          <button
            onClick={async () => {
              const url = `https://www.blippd.app/game/${game.slug}`;
              const text = game.isOnSale
                ? `${game.title} is ${game.discount}% off — ${formatPrice(game.currentPrice)} on Nintendo eShop`
                : `${game.title} on Nintendo eShop — ${formatPrice(game.currentPrice)}`;
              if (navigator.share) {
                try { await navigator.share({ title: text, url }); } catch { /* cancelled */ }
              } else {
                await navigator.clipboard.writeText(url);
                setShowCopied(true);
                setTimeout(() => setShowCopied(false), 2000);
              }
            }}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#111111] border border-[#222222] text-[#999999] text-sm font-medium hover:border-[#333333] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
            </svg>
            {showCopied ? "Copied!" : "Share"}
          </button>
        </div>

        {/* Price history — only shown when enough data points exist */}
        {priceHistory.length >= 3 && (
          <div className="py-4 border-t border-[#222222]">
            <h2 className="text-sm font-bold text-white mb-3">Price History</h2>
            <div className="relative" role="img" aria-label={`Price history chart: current price ${formatPrice(game.currentPrice)}, lowest ${formatPrice(minPrice)}, highest ${formatPrice(maxPrice)}`}>
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-5 flex flex-col justify-between text-[9px] text-[#777777] w-8">
                <span>${maxPrice.toFixed(0)}</span>
                {maxPrice !== minPrice && <span>${minPrice.toFixed(0)}</span>}
              </div>
              {/* Chart */}
              <div className="ml-9">
                <div className="flex items-end gap-2 h-24">
                  {priceHistory.map((point, i) => {
                    const height = maxPrice > 0 ? (point.price / maxPrice) * 100 : 0;
                    const isLatest = i === priceHistory.length - 1;
                    return (
                      <div
                        key={point.date}
                        className="flex-1 flex flex-col items-center gap-1"
                      >
                        <span
                          className={`text-[9px] font-medium ${
                            isLatest ? "text-[#00ff88]" : "text-[#777777]"
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
                      </div>
                    );
                  })}
                </div>
                {/* X-axis labels */}
                <div className="flex gap-2 mt-1">
                  {priceHistory.map((point) => (
                    <div key={point.date} className="flex-1 text-center">
                      <span className="text-[8px] text-[#777777]">{point.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Last price drop */}
        {(() => {
          const lastSaleAlert = gameAlerts.find((a) =>
            a.type === "sale_started" || a.type === "price_drop" || a.type === "all_time_low"
          );
          if (!lastSaleAlert) return null;
          const daysAgo = Math.floor(
            (Date.now() - new Date(lastSaleAlert.createdAt).getTime()) / (1000 * 60 * 60 * 24)
          );
          const label = daysAgo === 0 ? "today" : daysAgo === 1 ? "yesterday" : `${daysAgo} days ago`;
          return (
            <div className="py-3 border-t border-[#222222]">
              <p className="text-[#555555] text-xs">
                Last price drop: <span className="text-[#888888] font-medium">{label}</span>
              </p>
            </div>
          );
        })()}

        {/* Recent alerts */}
        <div className="py-4 border-t border-[#222222]">
          <h2 className="text-sm font-bold text-white mb-3">
            Recent Alerts
          </h2>
          {gameAlerts.length > 0 ? (
            <div className="space-y-2">
              {gameAlerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          ) : (
            <p className="text-[#777777] text-xs">No alerts yet for this game</p>
          )}
        </div>
      </div>
    </main>
  );
}
