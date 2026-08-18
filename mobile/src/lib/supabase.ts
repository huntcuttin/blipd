import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY");
}

// Singleton Supabase client for mobile
export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export function createClient() {
  return supabase;
}

// React Native does not stop timers the way a backgrounded browser tab does,
// so Supabase's token refresh has to be tied to foreground state explicitly.
// Without this, a session can go stale while the app sits in the background
// and the user lands on a signed-out screen on return. Standard RN pattern
// from Supabase's own docs.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
