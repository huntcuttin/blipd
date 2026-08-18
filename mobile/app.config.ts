import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Blippd",
  slug: "blippd",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "dark",
  scheme: "blippd",
  ios: {
    supportsTablet: false,
    bundleIdentifier: "app.blippd.mobile",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#0a0a0a",
    },
    package: "app.blippd.mobile",
  },
  // NOTE: `splash` stopped being a top-level ExpoConfig key in SDK 55. The
  // scaffold only ever set a background color, so it is dropped rather than
  // pulling in expo-splash-screen for a default. Real splash assets are a
  // Phase 3 (design parity) task.
  plugins: [["expo-router", { root: "./src/app" }]],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
