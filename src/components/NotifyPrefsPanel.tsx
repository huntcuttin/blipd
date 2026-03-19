"use client";

import type { NotifyPrefs } from "@/lib/types";

type PrefGroup = {
  keys: (keyof NotifyPrefs)[];
  label: string;
};

const PREF_GROUPS: PrefGroup[] = [
  { keys: ["sales", "allTimeLow"], label: "Price alerts" },
  { keys: ["releases"], label: "Release alerts" },
  { keys: ["announcements"], label: "DLC & updates" },
];

export default function NotifyPrefsPanel({
  prefs,
  onChange,
  only,
}: {
  prefs: NotifyPrefs;
  onChange: (key: keyof NotifyPrefs, value: boolean) => void;
  only?: string[];
}) {
  const groups = only
    ? PREF_GROUPS.filter((g) => only.includes(g.label))
    : PREF_GROUPS;

  return (
    <div className="space-y-1">
      {groups.map((group) => {
        const isOn = group.keys.every((k) => prefs[k]);
        return (
          <button
            key={group.label}
            role="switch"
            aria-checked={isOn}
            aria-label={`${group.label} notifications`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const newValue = !isOn;
              group.keys.forEach((k) => onChange(k, newValue));
            }}
            className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg hover:bg-[#1a1a1a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00ff88] transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-sm text-white">{group.label}</span>
            </div>
            <div
              aria-hidden="true"
              className={`w-9 h-5 rounded-full transition-all relative ${
                isOn ? "bg-[#00ff88]" : "bg-[#333333]"
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                  isOn ? "left-[18px]" : "left-0.5"
                }`}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
