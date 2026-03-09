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
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
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

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, consolePreference, signInWithMagicLink, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
