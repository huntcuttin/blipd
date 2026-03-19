"use client";

import { useAuth } from "@/lib/AuthContext";
import { useFollow } from "@/lib/FollowContext";
import Link from "next/link";
import { useState, useEffect } from "react";
import { requestPushPermission } from "@/components/ServiceWorkerRegistration";
import { createClient } from "@/lib/supabase/client";
import { setConsolePreference, getUserRetroFollows, toggleRetroFollow } from "@/lib/queries";
import type { ConsolePreference } from "@/lib/types";

const RETRO_CONSOLES = [
  { id: "nes", label: "NES" },
  { id: "snes", label: "SNES" },
  { id: "n64", label: "N64" },
  { id: "gb", label: "Game Boy" },
  { id: "gba", label: "GBA" },
  { id: "ds", label: "DS" },
  { id: "gamecube", label: "GameCube" },
  { id: "wii", label: "Wii" },
] as const;

export default function SettingsPage() {
  const { user, consolePreference, setConsolePreference: setAuthConsolePref, signOut } = useAuth();
  const { followedGameIds, followedFranchiseIds, ownedGameIds } = useFollow();
  const [pushState, setPushState] = useState<"default" | "granted" | "denied" | "unsupported">("default");
  const [pushLoading, setPushLoading] = useState(false);
  const [consolePref, setConsolePref] = useState<ConsolePreference | null>(consolePreference);
  const [consoleSaving, setConsoleSaving] = useState(false);
  const [retroFollows, setRetroFollows] = useState<Set<string>>(new Set());
  const [retroLoading, setRetroLoading] = useState<string | null>(null);

  useEffect(() => {
    setConsolePref(consolePreference);
  }, [consolePreference]);

  useEffect(() => {
    if (!("Notification" in window)) { setPushState("unsupported"); return; }
    setPushState(Notification.permission as "default" | "granted" | "denied");
  }, []);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    getUserRetroFollows(supabase, user.id)
      .then((consoles) => setRetroFollows(new Set(consoles)))
      .catch(() => {});
  }, [user]);

  async function handleConsoleChange(pref: ConsolePreference) {
    if (!user || consoleSaving || pref === consolePref) return;
    setConsoleSaving(true);
    const prev = consolePref;
    setConsolePref(pref);
    try {
      const supabase = createClient();
      await setConsolePreference(supabase, user.id, pref);
      setAuthConsolePref(pref);
    } catch {
      setConsolePref(prev);
    } finally {
      setConsoleSaving(false);
    }
  }

  async function handleRetroToggle(consoleId: string) {
    if (!user || retroLoading) return;
    setRetroLoading(consoleId);
    const prev = new Set(retroFollows);
    // Optimistic update
    const next = new Set(retroFollows);
    if (next.has(consoleId)) next.delete(consoleId);
    else next.add(consoleId);
    setRetroFollows(next);
    try {
      const supabase = createClient();
      await toggleRetroFollow(supabase, user.id, consoleId);
    } catch {
      setRetroFollows(prev);
    } finally {
      setRetroLoading(null);
    }
  }

  const gameCount = followedGameIds.size;
  const franchiseCount = followedFranchiseIds.size;
  const ownedCount = ownedGameIds.size;

  const authProvider = user?.app_metadata?.provider;
  const authLabel = authProvider === "google" ? "Google" : authProvider === "apple" ? "Apple" : "Email";

  return (
    <div className="px-4 py-6 min-h-[calc(100svh-80px)] flex flex-col">
      <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

      {user ? (
        <div className="space-y-4">
          {/* Account section */}
          <div className="bg-[#111111] rounded-xl border border-[#222222] p-4">
            <h2 className="text-[10px] font-bold text-[#666666] tracking-wider mb-3">
              ACCOUNT
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-medium">Email</p>
                  <p className="text-[#666666] text-xs mt-0.5">{user.email}</p>
                </div>
                <span className="px-2 py-1 rounded-full bg-[#222222] text-[#888888] text-[10px] font-medium">
                  {authLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Console preference */}
          <div className="bg-[#111111] rounded-xl border border-[#222222] p-4">
            <h2 className="text-[10px] font-bold text-[#666666] tracking-wider mb-3">
              MY CONSOLE
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => handleConsoleChange("switch")}
                disabled={consoleSaving}
                className={`flex-1 flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all active:scale-[0.98] ${
                  consolePref === "switch"
                    ? "border-[#ff4444]/40 bg-[#ff4444]/5"
                    : "border-[#222222] hover:border-[#333333]"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${consolePref === "switch" ? "bg-[#ff4444]/15" : "bg-[#1a1a1a]"}`}>
                  <svg className={`w-5 h-5 ${consolePref === "switch" ? "text-[#ff4444]" : "text-[#555555]"}`} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.5 2C5.01 2 3 4.01 3 6.5v11C3 19.99 5.01 22 7.5 22H11V2H7.5zM7 14.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
                    <path d="M16.5 2H13v20h3.5c2.49 0 4.5-2.01 4.5-4.5v-11C21 4.01 18.99 2 16.5 2zM17 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className={`text-sm font-semibold ${consolePref === "switch" ? "text-white" : "text-[#888888]"}`}>Switch</p>
                </div>
              </button>
              <button
                onClick={() => handleConsoleChange("switch2")}
                disabled={consoleSaving}
                className={`flex-1 flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all active:scale-[0.98] ${
                  consolePref === "switch2"
                    ? "border-[#00aaff]/40 bg-[#00aaff]/5"
                    : "border-[#222222] hover:border-[#333333]"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${consolePref === "switch2" ? "bg-[#00aaff]/15" : "bg-[#1a1a1a]"}`}>
                  <svg className={`w-5 h-5 ${consolePref === "switch2" ? "text-[#00aaff]" : "text-[#555555]"}`} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.5 2C5.01 2 3 4.01 3 6.5v11C3 19.99 5.01 22 7.5 22H11V2H7.5zM7 14.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
                    <path d="M16.5 2H13v20h3.5c2.49 0 4.5-2.01 4.5-4.5v-11C21 4.01 18.99 2 16.5 2zM17 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className={`text-sm font-semibold ${consolePref === "switch2" ? "text-white" : "text-[#888888]"}`}>Switch 2</p>
                </div>
              </button>
            </div>
          </div>

          {/* Retro consoles */}
          <div className="bg-[#111111] rounded-xl border border-[#222222] p-4">
            <h2 className="text-[10px] font-bold text-[#666666] tracking-wider mb-1">
              RETRO CONSOLES
            </h2>
            <p className="text-[#444444] text-[11px] mb-3">
              Get alerts when new classic games drop on the eShop
            </p>
            <div className="grid grid-cols-4 gap-2">
              {RETRO_CONSOLES.map((c) => {
                const active = retroFollows.has(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => handleRetroToggle(c.id)}
                    disabled={retroLoading === c.id}
                    className={`flex items-center justify-center py-2 px-1 rounded-lg border-2 transition-all active:scale-[0.97] text-xs font-bold ${
                      active
                        ? "border-[#ffaa00]/40 bg-[#ffaa00]/10 text-[#ffaa00]"
                        : "border-[#222222] text-[#666666] hover:border-[#333333]"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Following summary */}
          <div className="bg-[#111111] rounded-xl border border-[#222222] p-4">
            <h2 className="text-[10px] font-bold text-[#666666] tracking-wider mb-3">
              FOLLOWING
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#0a0a0a] rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-white">{gameCount}</p>
                <p className="text-[#666666] text-xs mt-0.5">watching</p>
              </div>
              <div className="bg-[#0a0a0a] rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-white">{franchiseCount}</p>
                <p className="text-[#666666] text-xs mt-0.5">franchise{franchiseCount !== 1 ? "s" : ""}</p>
              </div>
              <div className="bg-[#0a0a0a] rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-white">{ownedCount}</p>
                <p className="text-[#666666] text-xs mt-0.5">owned</p>
              </div>
            </div>
          </div>

          {/* Notifications info */}
          <div className="bg-[#111111] rounded-xl border border-[#222222] p-4">
            <h2 className="text-[10px] font-bold text-[#666666] tracking-wider mb-3">
              NOTIFICATIONS
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-medium">Email alerts</p>
                  <p className="text-[#666666] text-xs mt-0.5">
                    Price drops, sales, and releases
                  </p>
                </div>
                <span className="px-2 py-1 rounded-full bg-[#00ff88]/15 text-[#00ff88] text-[10px] font-bold">
                  ON
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-medium">Weekly digest</p>
                  <p className="text-[#666666] text-xs mt-0.5">
                    Weekly roundup of followed games on sale
                  </p>
                </div>
                <span className="px-2 py-1 rounded-full bg-[#00ff88]/15 text-[#00ff88] text-[10px] font-bold">
                  ON
                </span>
              </div>
              {/* Push notifications row */}
              {pushState !== "unsupported" && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">Push notifications</p>
                    <p className="text-[#666666] text-xs mt-0.5">
                      {pushState === "granted" ? "Instant alerts on this device" : pushState === "denied" ? "Blocked in browser settings" : "Get instant alerts on this device"}
                    </p>
                  </div>
                  {pushState === "granted" ? (
                    <span className="px-2 py-1 rounded-full bg-[#00ff88]/15 text-[#00ff88] text-[10px] font-bold">ON</span>
                  ) : pushState === "denied" ? (
                    <span className="px-2 py-1 rounded-full bg-[#ff6874]/15 text-[#ff6874] text-[10px] font-bold">BLOCKED</span>
                  ) : (
                    <button
                      onClick={async () => {
                        setPushLoading(true);
                        const ok = await requestPushPermission();
                        setPushState(ok ? "granted" : "denied");
                        setPushLoading(false);
                      }}
                      disabled={pushLoading}
                      className="px-3 py-1.5 rounded-lg bg-[#00ff88] text-[#0a0a0a] text-[11px] font-bold disabled:opacity-50"
                    >
                      {pushLoading ? "..." : "Enable"}
                    </button>
                  )}
                </div>
              )}
              <p className="text-[#444444] text-[11px]">
                Customize per-game alerts from each game&apos;s detail page.
              </p>
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={signOut}
            className="w-full p-4 bg-[#111111] rounded-xl border border-[#222222] text-left text-[#ff6874] text-sm font-medium hover:border-[#ff6874]/30 transition-all"
          >
            Sign out
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-8 px-4">
          <div className="w-14 h-14 rounded-2xl bg-[#111111] border border-[#222222] flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[#444444]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </div>
          <p className="text-white text-sm font-semibold mb-1">Sign in to manage settings</p>
          <p className="text-[#666666] text-xs mb-5 text-center max-w-[240px]">Track prices and get alerts for your favorite games</p>
          <Link
            href="/login"
            className="px-6 py-3 rounded-xl bg-[#00ff88] text-[#0a0a0a] font-semibold text-sm hover:shadow-[0_0_16px_#00ff8855] transition-all"
          >
            Sign in
          </Link>
        </div>
      )}

      {/* App info — always visible */}
      <div className="mt-auto bg-[#111111] rounded-xl border border-[#222222] p-4">
        <h2 className="text-[10px] font-bold text-[#666666] tracking-wider mb-3">
          ABOUT
        </h2>
        <div className="space-y-2">
          <Link
            href="/vs/nt-deals"
            className="flex items-center justify-between py-2 text-sm text-white hover:text-[#00ff88] transition-colors"
          >
            <span>Blippd vs NT Deals</span>
            <svg className="w-4 h-4 text-[#444444]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
          <Link
            href="/privacy"
            className="flex items-center justify-between py-2 text-sm text-white hover:text-[#00ff88] transition-colors"
          >
            <span>Privacy Policy</span>
            <svg className="w-4 h-4 text-[#444444]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
          <Link
            href="/terms"
            className="flex items-center justify-between py-2 text-sm text-white hover:text-[#00ff88] transition-colors"
          >
            <span>Terms of Service</span>
            <svg className="w-4 h-4 text-[#444444]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        </div>
        <p className="text-[#333333] text-[11px] mt-3 text-center">
          Blippd v1.5 &middot; Made with care by Westside Software
        </p>
      </div>
    </div>
  );
}
