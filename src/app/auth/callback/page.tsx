"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getUserProfile } from "@/lib/queries";
import RadarSpinner from "@/components/RadarSpinner";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    async function redirectAfterAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/onboarding"); return; }
      const { onboardingCompleted } = await getUserProfile(supabase, user.id);
      router.replace(onboardingCompleted ? "/home" : "/onboarding");
    }

    const hash = window.location.hash;
    const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    // Supabase redirects expired/already-used/invalid links back here as
    // ?error=...&error_code=otp_expired (or the same in the hash fragment)
    // instead of a code/token — this was previously swallowed silently by
    // falling through to a bare /login redirect with no explanation.
    const errorCode = params.get("error_code") ?? hashParams.get("error_code") ?? params.get("error") ?? hashParams.get("error");
    if (errorCode) {
      router.replace(`/login?error=${encodeURIComponent(errorCode)}`);
      return;
    }

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          console.error("Auth callback error:", error.message);
          router.replace("/login?error=auth_failed");
        } else {
          redirectAfterAuth();
        }
      });
    } else if (hash) {
      // Handle implicit flow (token in hash) — Supabase client auto-detects this
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN") {
          subscription.unsubscribe();
          redirectAfterAuth();
        }
      });

      // Timeout fallback — most commonly hit when the link is opened in an
      // email app's in-app browser (Gmail/Outlook), which loses the PKCE
      // verifier stored on the tab that originally requested the link.
      const timeout = setTimeout(() => {
        subscription.unsubscribe();
        router.replace("/login?error=link_expired");
      }, 5000);

      return () => {
        clearTimeout(timeout);
        subscription.unsubscribe();
      };
    } else {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="text-center">
        <RadarSpinner size={32} className="mx-auto mb-4" />
        <p className="text-[#666666] text-sm">Signing you in...</p>
      </div>
    </div>
  );
}
