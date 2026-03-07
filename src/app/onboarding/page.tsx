"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { getUserProfile, setConsolePreference } from "@/lib/queries";
import type { ConsolePreference } from "@/lib/types";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    const supabase = createClient();
    getUserProfile(supabase, user.id).then(({ consolePreference }) => {
      if (consolePreference) {
        router.replace("/home");
      } else {
        setChecking(false);
      }
    });
  }, [user, authLoading, router]);

  async function handleSelect(preference: ConsolePreference) {
    if (!user || saving) return;
    setSaving(true);
    const supabase = createClient();
    await setConsolePreference(supabase, user.id, preference);
    router.replace("/home");
  }

  if (authLoading || checking) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="w-8 h-8 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-6">
      <h1 className="text-2xl font-bold text-white mb-2">Welcome to blipd</h1>
      <p className="text-[#666666] text-sm text-center mb-10">
        Which console do you play on?
      </p>

      <div className="flex flex-col gap-4 w-full max-w-[320px]">
        <button
          onClick={() => handleSelect("switch")}
          disabled={saving}
          className="flex items-center gap-4 p-5 bg-[#111111] rounded-2xl border border-[#222222] hover:border-[#00ff88]/50 transition-all active:scale-[0.98]"
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
          onClick={() => handleSelect("switch2")}
          disabled={saving}
          className="flex items-center gap-4 p-5 bg-[#111111] rounded-2xl border border-[#222222] hover:border-[#00ff88]/50 transition-all active:scale-[0.98]"
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
    </div>
  );
}
