"use client";

import type { NotifyPrefs } from "@/lib/types";

const PREF_OPTIONS: { key: keyof NotifyPrefs; label: string }[] = [
  { key: "announcements", label: "Announcements" },
  { key: "sales", label: "Sales & Price Drops" },
  { key: "allTimeLow", label: "All Time Lows" },
  { key: "releases", label: "Releases" },
];

export default function NotifyPrefsPanel({
  prefs,
  onChange,
}: {
  prefs: NotifyPrefs;
  onChange: (key: keyof NotifyPrefs, value: boolean) => void;
}) {
  return (
    <div className="space-y-1">
      {PREF_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          role="switch"
          aria-checked={prefs[opt.key]}
          aria-label={`${opt.label} notifications`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onChange(opt.key, !prefs[opt.key]);
          }}
          className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg hover:bg-[#1a1a1a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00ff88] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-sm text-white">{opt.label}</span>
          </div>
          <div
            aria-hidden="true"
            className={`w-9 h-5 rounded-full transition-all relative ${
              prefs[opt.key]
                ? "bg-[#00ff88]"
                : "bg-[#333333]"
            }`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                prefs[opt.key] ? "left-[18px]" : "left-0.5"
              }`}
            />
          </div>
        </button>
      ))}
    </div>
  );
}
