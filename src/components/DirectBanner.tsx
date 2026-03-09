"use client";

import { useState, useEffect } from "react";

interface DirectInfo {
  active: boolean;
  title?: string;
  videoId?: string;
}

export default function DirectBanner() {
  const [direct, setDirect] = useState<DirectInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if user already dismissed this session
    const dismissedId = sessionStorage.getItem("direct_dismissed");

    async function checkDirect() {
      try {
        const res = await fetch("/api/directs/active");
        if (!res.ok) return;
        const data: DirectInfo = await res.json();
        if (data.active && data.videoId !== dismissedId) {
          setDirect(data);
        }
      } catch {
        // Fail silently — banner is non-critical
      }
    }

    checkDirect();
    // Re-check every 5 minutes
    const interval = setInterval(checkDirect, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!direct?.active || dismissed) return null;

  const youtubeUrl = `https://www.youtube.com/watch?v=${direct.videoId}`;

  return (
    <div className="mx-4 mb-3 rounded-xl bg-gradient-to-r from-[#e60012]/20 to-[#e60012]/5 border border-[#e60012]/30 p-3">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-[#e60012]/20 flex items-center justify-center">
          <svg className="w-4 h-4 text-[#e60012]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-bold leading-snug">
            {direct.title || "Nintendo Direct is LIVE"}
          </p>
          <p className="text-[#999999] text-xs mt-0.5">
            Price drops may follow — we&apos;re watching for deals
          </p>
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-[#e60012] text-xs font-medium hover:underline"
          >
            Watch on YouTube &rarr;
          </a>
        </div>
        <button
          onClick={() => {
            setDismissed(true);
            if (direct.videoId) {
              sessionStorage.setItem("direct_dismissed", direct.videoId);
            }
          }}
          aria-label="Dismiss"
          className="shrink-0 w-6 h-6 flex items-center justify-center text-[#666666] hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
