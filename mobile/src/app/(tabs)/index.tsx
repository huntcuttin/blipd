import { useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import GameCard from "@/components/GameCard";
import SearchBar from "@/components/SearchBar";
import { useAuth } from "@/contexts/AuthContext";
import { useFollow } from "@/contexts/FollowContext";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getTrendingGames, getGamesByIds, searchGames } from "@/lib/queries";
import { createClient } from "@/lib/supabase";
import { colors, radius } from "@/theme";
import type { Game } from "@/lib/types";

const TABS = ["Discover", "My Games"] as const;
type Tab = (typeof TABS)[number];

export default function HomeScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("Discover");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Game[] | null>(null);
  const { user } = useAuth();
  const { followedGameIds } = useFollow();
  const { data: trendingData, loading: trendingLoading } = useSupabaseQuery(getTrendingGames);

  const followedIds = useMemo(() => Array.from(followedGameIds), [followedGameIds]);
  const { data: followedGamesData } = useSupabaseQuery(
    (sb) => getGamesByIds(sb, followedIds),
    [followedIds.join(",")]
  );

  useEffect(() => {
    if (!search) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const supabase = createClient();
        const results = await searchGames(supabase, search);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const trendingGames = useMemo(() => {
    return (trendingData ?? []).slice(0, 40);
  }, [trendingData]);

  const followedGames = followedGamesData ?? [];

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>blippd</Text>
          <View style={styles.headerRight}>
            {!user && (
              <Pressable onPress={() => router.push("/login" as never)} style={styles.signInButton}>
                <Text style={styles.signInText}>Sign in</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search games..." />
        </View>

        {searchResults ? (
          <View style={styles.results}>
            <Text style={styles.resultCount}>
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
            </Text>
            {searchResults.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
            {searchResults.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No results for "{search}"</Text>
                <Text style={styles.emptySubtext}>Check your spelling or try a different search</Text>
              </View>
            )}
          </View>
        ) : (
          <>
            {/* Tab bar */}
            <View style={styles.tabBar}>
              {TABS.map((tab) => {
                const isActive = activeTab === tab;
                const count = tab === "My Games" ? followedGames.length : 0;
                return (
                  <Pressable key={tab} onPress={() => setActiveTab(tab)} style={[styles.tab, isActive && styles.activeTab]}>
                    <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                      {tab}
                      {count > 0 && (
                        <Text style={isActive ? styles.tabCountActive : styles.tabCount}> {count}</Text>
                      )}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {activeTab === "Discover" ? (
              trendingLoading ? (
                <ActivityIndicator color={colors.accent} style={styles.loader} />
              ) : (
                <View style={styles.gameList}>
                  {trendingGames.map((game) => (
                    <GameCard key={game.id} game={game} />
                  ))}
                </View>
              )
            ) : (
              <View style={styles.gameList}>
                {followedGames.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No games followed yet</Text>
                    <Text style={styles.emptySubtext}>Follow games to track prices and get alerts</Text>
                  </View>
                ) : (
                  followedGames.map((game) => (
                    <GameCard key={game.id} game={game} />
                  ))
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  logo: {
    color: colors.accent,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  signInButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  signInText: {
    color: colors.bg,
    fontSize: 12,
    fontWeight: "600",
  },
  searchRow: {
    marginBottom: 12,
  },
  tabBar: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    alignItems: "center",
  },
  activeTab: {
    backgroundColor: colors.cardHover,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "500",
  },
  activeTabText: {
    color: colors.textPrimary,
  },
  tabCountActive: {
    color: colors.accent,
  },
  tabCount: {
    color: colors.textDim,
  },
  gameList: {
    gap: 8,
  },
  results: {
    gap: 8,
  },
  resultCount: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  loader: {
    marginTop: 40,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptySubtext: {
    color: colors.textDim,
    fontSize: 14,
    textAlign: "center",
    maxWidth: 260,
  },
});
