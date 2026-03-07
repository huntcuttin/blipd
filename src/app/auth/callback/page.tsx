"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // The PKCE verifier is in localStorage — only the browser client can exchange it
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          console.error("Auth callback error:", error.message);
          router.replace("/login");
        } else {
          router.replace("/onboarding");
        }
      });
    } else if (hash) {
      // Handle implicit flow (token in hash) — Supabase client auto-detects this
      // Just wait for onAuthStateChange to fire, then redirect
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN") {
          subscription.unsubscribe();
          router.replace("/onboarding");
        }
      });
      // Timeout fallback
      setTimeout(() => {
        subscription.unsubscribe();
        router.replace("/onboarding");
      }, 5000);
    } else {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#666666] text-sm">Signing you in...</p>
      </div>
    </div>
  );
}
