"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import GameCard, { GameCardSkeleton } from "@/components/GameCard";
import FeedCard from "@/components/FeedCard";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import {
  getRecentTrailers,
  getActiveDirects,
  getActiveNamedSaleEvents,
  getRecentReleases,
  getUpcomingGamesSoon,
  getDemoGames,
} from "@/lib/queries";
import type { FeedItem } from "@/lib/types";

type FeedFilter = "all" | "releases" | "trailers" | "sales";

const FILTERS: { label: string; value: FeedFilter }[] = [
  { label: "All", value: "all" },
  { label: "Releases", value: "releases" },
  { label: "Trailers", value: "trailers" },
  { label: "Sales", value: "sales" },
];

export default function FeedPage() {
  return (
    <Suspense fallback={<FeedLoading />}>
      <FeedContent />
    </Suspense>
  );
}

function FeedLoading() {
  return (
    <div className="px-4">
      <div className="flex items-center justify-between py-4">
        <h1 className="text-lg font-bold text-white">Feed</h1>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <GameCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function FeedContent() {
  const searchParams = useSearchParams();
  const initialFilter = (searchParams.get("filter") as FeedFilter) || "all";
  const [filter, setFilter] = useState<FeedFilter>(initialFilter);

  const { data: trailers } = useSupabaseQuery(getRecentTrailers);
  const { data: directs } = useSupabaseQuery(getActiveDirects);
  const { data: saleEvents } = useSupabaseQuery(getActiveNamedSaleEvents);
  const { data: recentReleases, loading: releasesLoading } = useSupabaseQuery(getRecentReleases);
  const { data: upcomingGames } = useSupabaseQuery(getUpcomingGamesSoon);
  const { data: demoGames } = useSupabaseQuery(getDemoGames);

  const feedItems = useMemo(() => {
    const items: FeedItem[] = [];

    // Directs
    for (const d of directs ?? []) {
      items.push({
        id: `direct-${d.id}`,
        type: "direct",
        timestamp: d.detectedAt,
        title: d.title || "Nintendo Direct",
        subtitle: "Watch live on YouTube",
        videoId: d.videoId,
      });
    }

    // Trailers
    for (const t of trailers ?? []) {
      items.push({
        id: `trailer-${t.id}`,
        type: "trailer",
        timestamp: t.publishedAt,
        title: t.title,
        subtitle: t.matchedGameTitle ? `Game: ${t.matchedGameTitle}` : "",
        imageUrl: t.thumbnailUrl ?? undefined,
        videoId: t.videoId,
        franchise: t.matchedFranchise ?? undefined,
      });
    }

    // Sale events
    for (const se of saleEvents ?? []) {
      items.push({
        id: `sale-${se.id}`,
        type: "sale_event",
        timestamp: se.detectedAt,
        title: se.name,
        subtitle: `${se.gamesCount} games on sale`,
        saleEvent: se,
      });
    }

    // New releases (last 14 days for feed)
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const recentOnly = (recentReleases ?? []).filter(
      (g) => new Date(g.releaseDate) >= twoWeeksAgo && g.coverArt && g.originalPrice > 0
    );
    for (const g of recentOnly.slice(0, 20)) {
      items.push({
        id: `release-${g.id}`,
        type: "new_release",
        timestamp: g.releaseDate,
        title: g.title,
        subtitle: g.publisher,
        game: g,
      });
    }

    // Coming soon (next 60 days)
    for (const g of (upcomingGames ?? []).slice(0, 20)) {
      items.push({
        id: `upcoming-${g.id}`,
        type: "coming_soon",
        timestamp: g.releaseDate,
        title: g.title,
        subtitle: g.publisher,
        game: g,
      });
    }

    // Demos
    const demoIds = new Set(items.filter((i) => i.game).map((i) => i.game!.id));
    for (const g of (demoGames ?? []).filter((d) => !demoIds.has(d.id)).slice(0, 10)) {
      items.push({
        id: `demo-${g.id}`,
        type: "demo",
        timestamp: g.releaseDate,
        title: g.title,
        subtitle: "Free demo available",
        game: g,
      });
    }

    return items;
  }, [trailers, directs, saleEvents, recentReleases, upcomingGames, demoGames]);

  const filtered = useMemo(() => {
    let items = feedItems;
    switch (filter) {
      case "releases":
        items = feedItems.filter((i) => ["new_release", "coming_soon", "demo"].includes(i.type));
        break;
      case "trailers":
        items = feedItems.filter((i) => ["trailer", "direct"].includes(i.type));
        break;
      case "sales":
        items = feedItems.filter((i) => i.type === "sale_event");
        break;
    }

    // Sort: directs and sale events first (time-sensitive), then by timestamp desc
    // For upcoming games, use release date as-is (future dates sort after past dates naturally)
    return items.sort((a, b) => {
      // Directs always on top
      if (a.type === "direct" && b.type !== "direct") return -1;
      if (b.type === "direct" && a.type !== "direct") return 1;

      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      const now = Date.now();

      // Past items: most recent first
      // Future items: soonest first, after past items
      const isPastA = dateA <= now;
      const isPastB = dateB <= now;

      if (isPastA && isPastB) return dateB - dateA;
      if (isPastA && !isPastB) return -1;
      if (!isPastA && isPastB) return 1;
      return dateA - dateB;
    });
  }, [feedItems, filter]);

  const loading = releasesLoading;

  return (
    <div className="px-4">
      {/* Header */}
      <div className="flex items-center justify-between py-4">
        <h1 className="text-lg font-bold text-white">Feed</h1>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-4" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-2.5 rounded-full text-xs font-medium transition-all ${
              filter === f.value
                ? "bg-[#00ff88]/15 text-[#00ff88]"
                : "bg-[#1a1a1a] text-[#666666] hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <GameCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyFeed filter={filter} />
      ) : (
        <div className="space-y-3 pb-4">
          {filtered.map((item) => (
            <FeedItemRenderer key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedItemRenderer({ item }: { item: FeedItem }) {
  // Game-based items use GameCard with a badge
  if (item.game) {
    return (
      <div className="relative">
        <GameCard game={item.game} />
        <FeedBadge type={item.type} />
      </div>
    );
  }

  // Non-game items (trailers, directs, sale events) use FeedCard
  return <FeedCard item={item} />;
}

function FeedBadge({ type }: { type: FeedItem["type"] }) {
  const badges: Record<string, { label: string; color: string }> = {
    new_release: { label: "NEW", color: "bg-[#00ff88]/15 text-[#00ff88]" },
    coming_soon: { label: "SOON", color: "bg-[#3b82f6]/15 text-[#3b82f6]" },
    demo: { label: "DEMO", color: "bg-[#a855f7]/15 text-[#a855f7]" },
  };
  const config = badges[type];

  if (!config) return null;

  return (
    <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold ${config.color}`}>
      {config.label}
    </span>
  );
}

function EmptyFeed({ filter }: { filter: FeedFilter }) {
  const messages: Record<FeedFilter, { title: string; desc: string }> = {
    all: { title: "Nothing yet", desc: "Check back soon for news, trailers, and deals" },
    releases: { title: "No releases", desc: "No recent or upcoming releases to show" },
    trailers: { title: "No trailers", desc: "No recent game trailers detected" },
    sales: { title: "No active sales", desc: "No named sale events right now" },
  };

  const { title, desc } = messages[filter];

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-14 h-14 rounded-2xl bg-[#111111] border border-[#222222] flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-[#444444]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
        </svg>
      </div>
      <h2 className="text-base font-semibold text-white mb-1">{title}</h2>
      <p className="text-[#555555] text-sm text-center max-w-[260px]">{desc}</p>
    </div>
  );
}
