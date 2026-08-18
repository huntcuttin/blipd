import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { createClient } from "@/lib/supabase";
import * as Linking from "expo-linking";
import type { User, Session } from "@supabase/supabase-js";
import type { ConsolePreference } from "@/lib/types";
import { getUserProfile } from "@/lib/queries";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  consolePreference: ConsolePreference | null;
  /** Sends a sign-in email containing both a magic link and a numeric code. */
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
  /** Completes sign-in with the code from that email. Primary mobile flow. */
  verifyEmailCode: (email: string, code: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [consolePreference, setConsolePreference] = useState<ConsolePreference | null>(null);
  const supabase = createClient();

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Handle deep link auth callback
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      if (!url.includes("auth-callback")) return;

      // Extract tokens from URL fragment
      const hashIndex = url.indexOf("#");
      if (hashIndex === -1) return;

      const hash = url.substring(hashIndex + 1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      }
    };

    // Handle URL that launched the app
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    // Handle URLs while app is running
    const subscription = Linking.addEventListener("url", handleDeepLink);
    return () => subscription.remove();
  }, [supabase]);

  // Load console preference when user changes
  useEffect(() => {
    if (!user) {
      setConsolePreference(null);
      return;
    }
    getUserProfile(supabase, user.id)
      .then(({ consolePreference: pref }) => {
        setConsolePreference(pref);
      })
      .catch((err) => {
        console.error("Failed to load user profile:", err);
      });
  }, [user, supabase]);

  const signInWithMagicLink = async (email: string) => {
    const redirectUrl = Linking.createURL("auth-callback");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    return { error: error as Error | null };
  };

  // Code entry is the primary mobile sign-in path, not the deep link. The
  // magic-link round trip has to survive leaving the app, an email client's
  // in-app browser, and a redirect back — the exact chain that produces the
  // PKCE "verifier lost" failure the web app has documented against itself.
  // Typing a code from the same email never leaves the app, so none of that
  // can happen. The deep-link handler above stays as a fallback for users who
  // tap the link anyway.
  const verifyEmailCode = async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, consolePreference, signInWithMagicLink, verifyEmailCode, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
