"use client";

import { useState, useEffect } from "react";

interface Props {
  releaseDate: string;
  gameTitle: string;
}

export default function ReleaseTimeClient({ releaseDate, gameTitle }: Props) {
  const [countdown, setCountdown] = useState<string | null>(null);
  const [localTime, setLocalTime] = useState<string | null>(null);

  useEffect(() => {
    // Assume digital-only (9:00 AM PT) as default launch time
    // PT = UTC-8 (PST) or UTC-7 (PDT)
    // Use a fixed 9:00 AM PT → 17:00 UTC (PST) or 16:00 UTC (PDT)
    // For simplicity, use 17:00 UTC as a reasonable estimate
    const launchUTC = new Date(releaseDate + "T17:00:00Z");

    // Show local time
    setLocalTime(
      launchUTC.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })
    );

    function updateCountdown() {
      const now = Date.now();
      const diff = launchUTC.getTime() - now;

      if (diff <= 0) {
        setCountdown(null);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const parts: string[] = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0 || days > 0) parts.push(`${hours}h`);
      parts.push(`${minutes}m`);
      if (days === 0) parts.push(`${seconds}s`);

      setCountdown(parts.join(" "));
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [releaseDate, gameTitle]);

  return (
    <div className="mt-3 space-y-2">
      {/* Countdown */}
      {countdown && (
        <div className="flex items-center gap-2">
          <span className="text-[#666666] text-xs">Countdown:</span>
          <span className="text-[#00ff88] text-sm font-mono font-bold">{countdown}</span>
        </div>
      )}

      {/* Local time */}
      {localTime && (
        <div className="flex items-center gap-2">
          <span className="text-[#666666] text-xs">Your timezone:</span>
          <span className="text-white text-sm">{localTime}</span>
        </div>
      )}

      <p className="text-[#555555] text-[11px] leading-relaxed mt-2">
        Estimated based on the most common eShop launch pattern (9:00 AM PT for digital-only titles).
        Actual time may vary — follow on Blippd for a real-time alert.
      </p>
    </div>
  );
}
