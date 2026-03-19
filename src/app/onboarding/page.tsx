"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { getUserProfile, setConsolePreference, getPopularGames, markGameOwned, setRetroFollows } from "@/lib/queries";
import type { ConsolePreference, Game } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import GameCoverImage from "@/components/GameCoverImage";
import Logo from "@/components/Logo";

type Step = "console" | "retro" | "games" | "done";

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

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<Step>("console");
  const [saving, setSaving] = useState(false);
  const [selectedConsole, setSelectedConsole] = useState<ConsolePreference | null>(null);

  // Retro console state
  const [selectedRetro, setSelectedRetro] = useState<Set<string>>(new Set());

  // Game picker state
  const [popularGames, setPopularGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [selectedGameIds, setSelectedGameIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    const supabase = createClient();
    getUserProfile(supabase, user.id)
      .then(({ consolePreference, onboardingCompleted }) => {
        if (onboardingCompleted) {
          router.replace("/home");
        } else if (consolePreference) {
          setSelectedConsole(consolePreference);
          setStep("retro");
          setChecking(false);
        } else {
          setChecking(false);
        }
      })
      .catch(() => {
        setChecking(false);
      });
  }, [user, authLoading, router]);

  // Load popular games when entering the games step
  useEffect(() => {
    if (step !== "games") return;
    setLoadingGames(true);
    const supabase = createClient();
    getPopularGames(supabase).then((games) => {
      setPopularGames(games);
      setLoadingGames(false);
    }).catch(() => setLoadingGames(false));
  }, [step]);

  async function handleConsoleSelect(preference: ConsolePreference) {
    if (!user || saving) return;
    setSaving(true);
    try {
      const supabase = createClient();
      await setConsolePreference(supabase, user.id, preference);
      setSelectedConsole(preference);
      setStep("retro");
    } catch {
      // stay on step
    } finally {
      setSaving(false);
    }
  }

  const toggleRetroConsole = useCallback((consoleId: string) => {
    setSelectedRetro((prev) => {
      const next = new Set(prev);
      if (next.has(consoleId)) next.delete(consoleId);
      else next.add(consoleId);
      return next;
    });
  }, []);

  async function handleRetroNext() {
    if (!user) return;
    setSaving(true);
    try {
      if (selectedRetro.size > 0) {
        const supabase = createClient();
        await setRetroFollows(supabase, user.id, Array.from(selectedRetro));
      }
    } catch {
      // continue anyway
    } finally {
      setSaving(false);
      setStep("games");
    }
  }

  const toggleGame = useCallback((gameId: string) => {
    setSelectedGameIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) {
        next.delete(gameId);
      } else if (next.size < 5) {
        next.add(gameId);
      }
      return next;
    });
  }, []);

  async function handleFinish() {
    if (!user || saving) return;
    setSaving(true);
    try {
      const supabase = createClient();
      // Save owned games
      const promises = Array.from(selectedGameIds).map((gameId) =>
        markGameOwned(supabase, user.id, gameId)
      );
      await Promise.allSettled(promises);
      // Mark onboarding complete
      await supabase
        .from("user_profiles")
        .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      setStep("done");
      // Brief pause on the done screen then redirect
      setTimeout(() => router.replace("/home"), 1500);
    } catch {
      // still redirect on error
      router.replace("/home");
    }
  }

  async function handleSkip() {
    if (!user) return;
    setSaving(true);
    try {
      const supabase = createClient();
      await supabase
        .from("user_profiles")
        .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
    } catch {
      // continue anyway
    }
    router.replace("/home");
  }

  if (authLoading || checking) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="w-8 h-8 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const stepIndex = step === "console" ? 0 : step === "retro" ? 1 : step === "games" ? 2 : 3;

  return (
    <div className="flex flex-col items-center min-h-[80vh] px-6 pt-12 pb-24">
      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i === stepIndex ? "bg-[#00ff88]" : i < stepIndex ? "bg-[#00ff88]/40" : "bg-[#333333]"
            }`}
          />
        ))}
      </div>

      {step === "console" && (
        <ConsoleStep saving={saving} onSelect={handleConsoleSelect} />
      )}

      {step === "retro" && (
        <RetroConsoleStep
          selected={selectedRetro}
          onToggle={toggleRetroConsole}
          onNext={handleRetroNext}
          onSkip={() => setStep("games")}
          saving={saving}
        />
      )}

      {step === "games" && (
        <GamePickerStep
          games={popularGames}
          loading={loadingGames}
          selectedIds={selectedGameIds}
          onToggle={toggleGame}
          onFinish={handleFinish}
          onSkip={handleSkip}
          saving={saving}
          consoleName={selectedConsole === "switch2" ? "Switch 2" : "Switch"}
        />
      )}

      {step === "done" && <DoneStep />}
    </div>
  );
}

// ── Step 1: Console selection ───────────────────────────────────

function ConsoleStep({ saving, onSelect }: { saving: boolean; onSelect: (p: ConsolePreference) => void }) {
  return (
    <>
      <Logo size={48} />
      <h1 className="text-2xl font-bold text-white mt-5 mb-2">Welcome to Blippd</h1>
      <p className="text-[#666666] text-sm text-center mb-10">
        Which console do you play on?
      </p>

      <div className="flex flex-col gap-4 w-full max-w-[320px]">
        <button
          onClick={() => onSelect("switch")}
          disabled={saving}
          className="flex items-center gap-4 p-5 bg-[#111111] rounded-2xl border border-[#222222] hover:border-[#444444] transition-all active:scale-[0.98]"
        >
          <div className="w-12 h-12 rounded-xl bg-[#ff4444]/15 flex items-center justify-center shrink-0">
            <svg className="w-7 h-7 text-[#ff4444]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.5 2C5.01 2 3 4.01 3 6.5v11C3 19.99 5.01 22 7.5 22H11V2H7.5zM7 14.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
              <path d="M16.5 2H13v20h3.5c2.49 0 4.5-2.01 4.5-4.5v-11C21 4.01 18.99 2 16.5 2zM17 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
            </svg>
          </div>
          <div className="text-left">
            <h2 className="text-white font-semibold text-lg">Nintendo Switch</h2>
            <p className="text-[#666666] text-xs mt-0.5">Original / OLED / Lite</p>
          </div>
        </button>

        <button
          onClick={() => onSelect("switch2")}
          disabled={saving}
          className="flex items-center gap-4 p-5 bg-[#111111] rounded-2xl border border-[#222222] hover:border-[#444444] transition-all active:scale-[0.98]"
        >
          <div className="w-12 h-12 rounded-xl bg-[#00aaff]/15 flex items-center justify-center shrink-0">
            <svg className="w-7 h-7 text-[#00aaff]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.5 2C5.01 2 3 4.01 3 6.5v11C3 19.99 5.01 22 7.5 22H11V2H7.5zM7 14.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
              <path d="M16.5 2H13v20h3.5c2.49 0 4.5-2.01 4.5-4.5v-11C21 4.01 18.99 2 16.5 2zM17 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
            </svg>
          </div>
          <div className="text-left">
            <h2 className="text-white font-semibold text-lg">Nintendo Switch 2</h2>
            <p className="text-[#666666] text-xs mt-0.5">Next-gen console</p>
          </div>
        </button>
      </div>
    </>
  );
}

// ── Step 2: Retro console selection ─────────────────────────────

function RetroConsoleStep({
  selected,
  onToggle,
  onNext,
  onSkip,
  saving,
}: {
  selected: Set<string>;
  onToggle: (id: string) => void;
  onNext: () => void;
  onSkip: () => void;
  saving: boolean;
}) {
  return (
    <>
      <h1 className="text-2xl font-bold text-white mb-2 text-center">
        Classic consoles
      </h1>
      <p className="text-[#666666] text-sm text-center mb-8 max-w-xs">
        Get notified when classic games drop on the eShop
      </p>

      <div className="grid grid-cols-4 gap-3 w-full max-w-md">
        {RETRO_CONSOLES.map((c) => {
          const active = selected.has(c.id);
          return (
            <button
              key={c.id}
              onClick={() => onToggle(c.id)}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all active:scale-[0.97] ${
                active
                  ? "border-[#ffaa00] bg-[#ffaa00]/10"
                  : "border-[#222222] hover:border-[#333333]"
              }`}
            >
              <span className={`text-sm font-bold ${active ? "text-[#ffaa00]" : "text-[#888888]"}`}>
                {c.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="w-full max-w-md mt-8 space-y-3">
        <button
          onClick={onNext}
          disabled={saving}
          className="w-full py-3.5 rounded-xl bg-[#00ff88] text-[#0a0a0a] font-semibold text-sm transition-all shadow-[0_0_12px_#00ff88,0_0_24px_#00ff8844] hover:shadow-[0_0_16px_#00ff88,0_0_32px_#00ff8844] disabled:opacity-50 active:scale-[0.98]"
        >
          {saving ? "Saving..." : selected.size > 0 ? `Continue with ${selected.size} console${selected.size !== 1 ? "s" : ""}` : "Continue"}
        </button>
        <button
          onClick={onSkip}
          disabled={saving}
          className="w-full py-3 text-[#666666] text-sm hover:text-white transition-colors"
        >
          Skip
        </button>
      </div>
    </>
  );
}

// ── Step 3: Pick games you own ──────────────────────────────────

function GamePickerStep({
  games,
  loading,
  selectedIds,
  onToggle,
  onFinish,
  onSkip,
  saving,
  consoleName,
}: {
  games: Game[];
  loading: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onFinish: () => void;
  onSkip: () => void;
  saving: boolean;
  consoleName: string;
}) {
  return (
    <>
      <h1 className="text-2xl font-bold text-white mb-2 text-center">
        Games you own
      </h1>
      <p className="text-[#666666] text-sm text-center mb-1 max-w-xs">
        Tap up to 5 {consoleName} games you already own. This helps us suggest better deals.
      </p>
      <p className="text-[#555555] text-xs mb-6">
        {selectedIds.size}/5 selected
      </p>

      {loading ? (
        <div className="grid grid-cols-3 gap-3 w-full max-w-md">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[16/10] rounded-lg bg-[#1a1a1a]" />
              <div className="h-3 bg-[#1a1a1a] rounded mt-2 w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 w-full max-w-md overflow-y-auto max-h-[50vh] pr-1">
          {games.map((game) => {
            const selected = selectedIds.has(game.id);
            return (
              <button
                key={game.id}
                onClick={() => onToggle(game.id)}
                disabled={!selected && selectedIds.size >= 5}
                className={`text-left rounded-xl border-2 p-1.5 transition-all active:scale-[0.97] ${
                  selected
                    ? "border-[#00ff88] bg-[#00ff88]/5"
                    : selectedIds.size >= 5
                    ? "border-[#1a1a1a] opacity-40"
                    : "border-[#1a1a1a] hover:border-[#333333]"
                }`}
              >
                <div className="relative">
                  <GameCoverImage
                    src={game.coverArt}
                    alt={game.title}
                    className={`w-full aspect-[16/10] rounded-lg bg-[#1a1a1a] ${game.coverArt?.includes("igdb.com") ? "object-contain p-1" : "object-cover"}`}
                  />
                  {selected && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#00ff88] flex items-center justify-center">
                      <svg className="w-3 h-3 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </div>
                  )}
                </div>
                <p className="text-white text-[11px] font-medium mt-1.5 leading-tight line-clamp-2 px-0.5">
                  {game.title}
                </p>
                {game.currentPrice > 0 && (
                  <p className="text-[#555555] text-[10px] mt-0.5 px-0.5">
                    {formatPrice(game.currentPrice)}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Action buttons */}
      <div className="w-full max-w-md mt-6 space-y-3">
        <button
          onClick={onFinish}
          disabled={saving}
          className="w-full py-3.5 rounded-xl bg-[#00ff88] text-[#0a0a0a] font-semibold text-sm transition-all shadow-[0_0_12px_#00ff88,0_0_24px_#00ff8844] hover:shadow-[0_0_16px_#00ff88,0_0_32px_#00ff8844] disabled:opacity-50 active:scale-[0.98]"
        >
          {saving ? "Saving..." : selectedIds.size > 0 ? `Continue with ${selectedIds.size} game${selectedIds.size !== 1 ? "s" : ""}` : "Continue"}
        </button>
        <button
          onClick={onSkip}
          disabled={saving}
          className="w-full py-3 text-[#666666] text-sm hover:text-white transition-colors"
        >
          Skip for now
        </button>
      </div>
    </>
  );
}

// ── Step 4: Done ────────────────────────────────────────────────

function DoneStep() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 mt-12">
      <div className="w-16 h-16 rounded-full bg-[#00ff88]/10 flex items-center justify-center mb-4 shadow-[0_0_24px_#00ff8844]">
        <svg className="w-8 h-8 text-[#00ff88]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">You&apos;re all set</h1>
      <p className="text-[#666666] text-sm">Taking you to Blippd...</p>
    </div>
  );
}
