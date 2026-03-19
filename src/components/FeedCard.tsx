"use client";

import Link from "next/link";
import type { FeedItem } from "@/lib/types";

export default function FeedCard({ item }: { item: FeedItem }) {
  switch (item.type) {
    case "direct":
      return <DirectCard item={item} />;
    case "trailer":
      return <TrailerCard item={item} />;
    case "sale_event":
      return <SaleEventCard item={item} />;
    default:
      return null;
  }
}

function DirectCard({ item }: { item: FeedItem }) {
  const youtubeUrl = item.videoId
    ? `https://www.youtube.com/watch?v=${item.videoId}`
    : "#";

  return (
    <a
      href={youtubeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-[#e60012]/30 bg-[#e60012]/10 overflow-hidden hover:border-[#e60012]/60 transition-all"
    >
      {item.videoId && (
        <div className="relative aspect-video bg-[#1a1a1a]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`}
            alt={item.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-[#e60012]/90 flex items-center justify-center">
              <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 rounded-md bg-[#e60012]/20 text-[#e60012] text-[10px] font-bold uppercase">
            Direct
          </span>
          <span className="text-[10px] text-[#555555]">{formatTimeAgo(item.timestamp)}</span>
        </div>
        <h3 className="text-sm font-semibold text-white leading-snug">{item.title}</h3>
        <p className="text-[11px] text-[#888888] mt-0.5">{item.subtitle}</p>
      </div>
    </a>
  );
}

function TrailerCard({ item }: { item: FeedItem }) {
  const youtubeUrl = item.videoId
    ? `https://www.youtube.com/watch?v=${item.videoId}`
    : "#";

  return (
    <a
      href={youtubeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-[#222222] bg-[#111111] overflow-hidden hover:border-[#333333] transition-all"
    >
      {item.videoId && (
        <div className="relative aspect-video bg-[#0a0a0a]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`}
            alt={item.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
              <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 rounded-md bg-[#00ff88]/10 text-[#00ff88] text-[10px] font-bold uppercase">
            Trailer
          </span>
          {item.franchise && (
            <span className="text-[10px] text-[#666666]">{item.franchise}</span>
          )}
          <span className="text-[10px] text-[#555555] ml-auto">{formatTimeAgo(item.timestamp)}</span>
        </div>
        <h3 className="text-sm font-semibold text-white leading-snug">{item.title}</h3>
        {item.subtitle && (
          <p className="text-[11px] text-[#888888] mt-0.5">{item.subtitle}</p>
        )}
      </div>
    </a>
  );
}

function SaleEventCard({ item }: { item: FeedItem }) {
  return (
    <Link
      href={item.saleEvent ? `/sales?event=${item.saleEvent.id}` : "/sales"}
      className="block rounded-xl border border-[#ffaa00]/30 bg-[#ffaa00]/10 p-4 hover:border-[#ffaa00]/60 transition-all"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="px-2 py-0.5 rounded-md bg-[#ffaa00]/20 text-[#ffaa00] text-[10px] font-bold uppercase">
          Sale
        </span>
        <span className="text-[10px] text-[#555555]">{formatTimeAgo(item.timestamp)}</span>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">{item.title}</h3>
          <p className="text-[11px] text-[#ffaa00]/70 mt-0.5">{item.subtitle}</p>
        </div>
        <svg className="w-4 h-4 text-[#ffaa00]/50 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </Link>
  );
}

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) {
    // Future date (for upcoming games)
    const futureDays = Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
    if (futureDays === 0) return "Today";
    if (futureDays === 1) return "Tomorrow";
    if (futureDays <= 7) return `In ${futureDays} days`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
