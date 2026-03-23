"use client";

import { useState, useEffect } from "react";
import FollowButton from "@/components/FollowButton";

interface Props {
  releaseDate: string;
  gameId: string;
  gameTitle: string;
}

const TIMEZONES = [
  { label: "Pacific (PT)", zone: "America/Los_Angeles" },
  { label: "Mountain (MT)", zone: "America/Denver" },
  { label: "Central (CT)", zone: "America/Chicago" },
  { label: "Eastern (ET)", zone: "America/New_York" },
  { label: "UK (GMT/BST)", zone: "Europe/London" },
  { label: "Central EU (CET)", zone: "Europe/Berlin" },
  { label: "Japan (JST)", zone: "Asia/Tokyo" },
  { label: "Australia (AEST)", zone: "Australia/Sydney" },
];

function formatInTimezone(date: Date, zone: string): string {
  return date.toLocaleString("en-US", {
    timeZone: zone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function detectUserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // If user's timezone matches one of our presets, use it
    const match = TIMEZONES.find((t) => t.zone === tz);
    if (match) return match.zone;
    // Otherwise default to PT (most US Nintendo players)
    return "America/Los_Angeles";
  } catch {
    return "America/Los_Angeles";
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function ReleaseTimeClient({ releaseDate, gameId, gameTitle: _gameTitle }: Props) {
  const [countdownParts, setCountdownParts] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  const [selectedZone, setSelectedZone] = useState("America/Los_Angeles");
  const [localTime, setLocalTime] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Assume digital-only (9:00 AM PT) as default launch time
  // PT = UTC-8 (PST) or UTC-7 (PDT). Use 17:00 UTC as reasonable estimate.
  const launchUTC = new Date(releaseDate + "T17:00:00Z");

  useEffect(() => {
    setSelectedZone(detectUserTimezone());
    setMounted(true);
  }, []);

  // Update local time display when zone changes
  useEffect(() => {
    if (!mounted) return;
    setLocalTime(formatInTimezone(launchUTC, selectedZone));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedZone, mounted, releaseDate]);

  // Countdown tick
  useEffect(() => {
    function updateCountdown() {
      const now = Date.now();
      const diff = launchUTC.getTime() - now;

      if (diff <= 0) {
        setCountdownParts(null);
        return;
      }

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdownParts({ d, h, m, s });

    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [releaseDate]);

  return (
    <div className="mt-4 space-y-4">
      {/* Countdown boxes */}
      {countdownParts && (
        <div className="flex gap-2 justify-center">
          <CountdownBox value={countdownParts.d} label="days" />
          <CountdownBox value={countdownParts.h} label="hrs" />
          <CountdownBox value={countdownParts.m} label="min" />
          <CountdownBox value={countdownParts.s} label="sec" />
        </div>
      )}

      {/* Timezone converter */}
      <div className="bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[#888888] text-xs font-medium">Your timezone</span>
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="bg-[#111111] border border-[#222222] rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-[#00ff88]/50"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.zone} value={tz.zone}>{tz.label}</option>
            ))}
          </select>
        </div>
        {localTime && (
          <p className="text-white text-lg font-bold">{localTime}</p>
        )}

        {/* Quick zone reference */}
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <p className="text-[#555555] text-[10px] font-bold tracking-wider mb-2">ALL TIMEZONES</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {TIMEZONES.map((tz) => (
              <div key={tz.zone} className="flex items-center justify-between">
                <span className="text-[#666666] text-[11px]">{tz.label}</span>
                <span className={`text-[11px] font-medium ${tz.zone === selectedZone ? "text-[#00ff88]" : "text-[#888888]"}`}>
                  {mounted ? launchUTC.toLocaleString("en-US", {
                    timeZone: tz.zone,
                    hour: "numeric",
                    minute: "2-digit",
                    month: "short",
                    day: "numeric",
                  }) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Inline follow CTA */}
      <div className="flex items-center gap-3 bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] p-4">
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium">Get notified when it launches</p>
          <p className="text-[#555555] text-xs mt-0.5">Real-time alert, not an estimate</p>
        </div>
        <div className="shrink-0">
          <FollowButton gameId={gameId} />
        </div>
      </div>

      <p className="text-[#444444] text-[11px] leading-relaxed text-center">
        Times estimated from the most common eShop pattern (9:00 AM PT for digital-only).
        Actual launch may vary. Follow for a real-time alert.
      </p>
    </div>
  );
}

function CountdownBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl w-16 py-2.5 text-center">
      <p className="text-white text-xl font-bold font-mono leading-none">
        {String(value).padStart(2, "0")}
      </p>
      <p className="text-[#555555] text-[10px] mt-1">{label}</p>
    </div>
  );
}
