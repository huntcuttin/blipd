"use client";

import { useAuth } from "@/lib/AuthContext";
import { useFollow } from "@/lib/FollowContext";
import Link from "next/link";
import { useState, useEffect } from "react";
import { requestPushPermission } from "@/components/ServiceWorkerRegistration";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { followedGameIds, followedFranchiseIds } = useFollow();
  const [pushState, setPushState] = useState<"default" | "granted" | "denied" | "unsupported">("default");
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) { setPushState("unsupported"); return; }
    setPushState(Notification.permission as "default" | "granted" | "denied");
  }, []);

  const gameCount = followedGameIds.size;
  const franchiseCount = followedFranchiseIds.size;

  return (
    <div className="px-4 py-6 pb-28">
      <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

      {user ? (
        <div className="space-y-4">
          {/* Account section */}
          <div className="bg-[#111111] rounded-xl border border-[#222222] p-4">
            <h2 className="text-[10px] font-bold text-[#666666] tracking-wider mb-3">
              ACCOUNT
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">Email</p>
                <p className="text-[#666666] text-xs mt-0.5">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Following summary */}
          <div className="bg-[#111111] rounded-xl border border-[#222222] p-4">
            <h2 className="text-[10px] font-bold text-[#666666] tracking-wider mb-3">
              FOLLOWING
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0a0a0a] rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-white">{gameCount}</p>
                <p className="text-[#666666] text-xs mt-0.5">
                  game{gameCount !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="bg-[#0a0a0a] rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-white">{franchiseCount}</p>
                <p className="text-[#666666] text-xs mt-0.5">
                  franchise{franchiseCount !== 1 ? "s" : ""}
                </p>
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
        <div className="flex flex-col items-center py-8 px-4">
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
      <div className="mt-6 bg-[#111111] rounded-xl border border-[#222222] p-4">
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
