"use client";

import { useState } from "react";

interface TrailerDetection {
  id: string;
  video_id: string;
  title: string;
  description: string | null;
  published_at: string;
  thumbnail_url: string | null;
  matched_game_id: string | null;
  matched_game_slug: string | null;
  matched_game_title: string | null;
  matched_franchise: string | null;
  confidence: number | null;
  claude_reasoning: string | null;
  status: "pending" | "auto_published" | "approved" | "rejected";
  alert_id: string | null;
  detected_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

const STATUS_COLORS: Record<TrailerDetection["status"], string> = {
  pending: "text-yellow-400 bg-yellow-400/10",
  auto_published: "text-green-400 bg-green-400/10",
  approved: "text-green-400 bg-green-400/10",
  rejected: "text-red-400 bg-red-400/10",
};

export default function TrailersClient({
  detections: initial,
}: {
  detections: TrailerDetection[];
}) {
  const [detections, setDetections] = useState(initial);
  const [loading, setLoading] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const pending = detections.filter((d) => d.status === "pending");
  const processed = detections.filter((d) => d.status !== "pending");

  async function handleAction(
    id: string,
    action: "approve" | "reject" | "reassign"
  ) {
    setLoading(id + action);
    try {
      const res = await fetch(`/api/admin/trailers/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, gameSlug: overrides[id] || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error ?? "Action failed");
        return;
      }
      setDetections((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                status: action === "reject" ? "rejected" : "approved",
              }
            : d
        )
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Trailer Queue</h1>
      <p className="text-[#888] text-sm mb-8">
        {pending.length} pending · {processed.length} processed
      </p>

      {pending.length === 0 && (
        <div className="text-[#555] text-center py-16">No pending trailers</div>
      )}

      <div className="space-y-6">
        {pending.map((d) => (
          <TrailerCard
            key={d.id}
            detection={d}
            override={overrides[d.id] ?? ""}
            onOverrideChange={(val) =>
              setOverrides((prev) => ({ ...prev, [d.id]: val }))
            }
            onAction={handleAction}
            loading={loading}
          />
        ))}
      </div>

      {processed.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mt-12 mb-4 text-[#666]">
            Processed
          </h2>
          <div className="space-y-4">
            {processed.map((d) => (
              <div
                key={d.id}
                className="bg-[#111] border border-[#222] rounded-xl p-4 flex items-center gap-4"
              >
                {d.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={d.thumbnail_url}
                    alt=""
                    className="w-20 h-12 object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.title}</p>
                  <p className="text-xs text-[#666]">
                    {d.matched_game_title ?? d.matched_franchise ?? "No match"}
                  </p>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded ${STATUS_COLORS[d.status]}`}
                >
                  {d.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TrailerCard({
  detection: d,
  override,
  onOverrideChange,
  onAction,
  loading,
}: {
  detection: TrailerDetection;
  override: string;
  onOverrideChange: (val: string) => void;
  onAction: (
    id: string,
    action: "approve" | "reject" | "reassign"
  ) => Promise<void>;
  loading: string | null;
}) {
  const confidence = d.confidence ?? 0;
  const confidencePct = Math.round(confidence * 100);
  const confidenceColor =
    confidence >= 0.85
      ? "text-green-400"
      : confidence >= 0.6
        ? "text-yellow-400"
        : "text-red-400";

  const hasGameInDB = !!d.matched_game_slug;
  const effectiveSlug = override || d.matched_game_slug;

  return (
    <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
      {/* YouTube embed */}
      <div className="relative pt-[56.25%] bg-black">
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube.com/embed/${d.video_id}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-white">{d.title}</h3>
          <p className="text-xs text-[#555] mt-0.5">
            {new Date(d.detected_at).toLocaleString()}
          </p>
        </div>

        {/* Claude match */}
        <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#666]">Claude match</span>
            <span className={`text-xs font-mono font-bold ${confidenceColor}`}>
              {confidencePct}% confidence
            </span>
          </div>
          <div className="text-sm">
            {d.matched_game_title && (
              <span className="text-white font-medium">
                {d.matched_game_title}
              </span>
            )}
            {d.matched_franchise && (
              <span className="text-[#888]">
                {d.matched_game_title ? " · " : ""}
                {d.matched_franchise} franchise
              </span>
            )}
            {!d.matched_game_title && !d.matched_franchise && (
              <span className="text-[#555]">No match</span>
            )}
          </div>
          {d.matched_game_slug && (
            <p className="text-xs text-[#555]">
              {hasGameInDB ? (
                <span className="text-green-400">✓ Found in DB: {d.matched_game_slug}</span>
              ) : (
                <span className="text-yellow-400">Not in DB</span>
              )}
            </p>
          )}
          {!hasGameInDB && d.matched_game_title && (
            <p className="text-xs text-yellow-400">Game not found in DB — use override below</p>
          )}
          {d.claude_reasoning && (
            <p className="text-xs text-[#666] italic">{d.claude_reasoning}</p>
          )}
        </div>

        {/* Game slug override */}
        <div>
          <label className="text-xs text-[#666] block mb-1">
            Game slug override (optional)
          </label>
          <input
            type="text"
            value={override}
            onChange={(e) => onOverrideChange(e.target.value)}
            placeholder={d.matched_game_slug ?? "e.g. the-legend-of-zelda-echoes-of-wisdom"}
            className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#00ff88]"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() =>
              onAction(d.id, effectiveSlug !== d.matched_game_slug ? "reassign" : "approve")
            }
            disabled={!effectiveSlug || loading !== null}
            className="flex-1 bg-[#00ff88] text-black text-sm font-semibold py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#00e67a] transition-colors"
          >
            {loading === d.id + "approve" || loading === d.id + "reassign"
              ? "Publishing…"
              : effectiveSlug
                ? "Approve & Notify"
                : "Need game slug"}
          </button>
          <button
            onClick={() => onAction(d.id, "reject")}
            disabled={loading !== null}
            className="px-4 bg-[#1a1a1a] border border-[#333] text-[#888] text-sm font-medium py-2 rounded-lg hover:border-red-500 hover:text-red-400 transition-colors disabled:opacity-40"
          >
            {loading === d.id + "reject" ? "…" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}
