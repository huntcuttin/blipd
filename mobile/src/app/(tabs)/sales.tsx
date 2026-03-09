import { useState, useEffect, useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GameCard from "@/components/GameCard";
import SearchBar from "@/components/SearchBar";
import { useFollow } from "@/contexts/FollowContext";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getGamesOnSale, searchGames } from "@/lib/queries";
import { createClient } from "@/lib/supabase";
import { colors, radius } from "@/theme";
import type { Game } from "@/lib/types";

const SORTS = ["Biggest Discount", "Lowest Price", "Ending Soon"] as const;
type SortMode = (typeof SORTS)[number];

function sortGames(games: Game[], mode: SortMode): Game[] {
  const sorted = [...games];
  switch (mode) {
    case "Biggest Discount":
      return sorted.sort((a, b) => b.discount - a.discount);
    case "Lowest Price":
      return sorted.sort((a, b) => a.currentPrice - b.currentPrice);
    case "Ending Soon":
      return sorted.sort((a, b) => {
        const aEnd = a.saleEndDate || "9999-12-31";
        const bEnd = b.saleEndDate || "9999-12-31";
        return aEnd.localeCompare(bEnd);
      });
  }
}

export default function SalesScreen() {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Game[] | null>(null);
  const [sort, setSort] = useState<SortMode>("Biggest Discount");
  const { followedGameIds } = useFollow();

  const { data: games, loading: gamesLoading } = useSupabaseQuery(getGamesOnSale);

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

  const allGames = games ?? [];
  const isReleased = (g: Game) => g.releaseStatus === "released" || g.releaseStatus === "out_today";
  const sortedSales = useMemo(() => sortGames(allGames.filter(isReleased), sort), [allGames, sort]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Sales</Text>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search deals..." />
        </View>

        {searchResults ? (
          <View style={styles.gameList}>
            <Text style={styles.resultCount}>
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
            </Text>
            {searchResults.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </View>
        ) : gamesLoading ? (
          <ActivityIndicator color={colors.accent} style={styles.loader} />
        ) : (
          <>
            {/* Sort pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortRow}>
              {SORTS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setSort(s)}
                  style={[styles.sortPill, sort === s && styles.sortPillActive]}
                >
                  <Text style={[styles.sortText, sort === s && styles.sortTextActive]}>{s}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.gameList}>
              {sortedSales.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
              {sortedSales.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No sales right now</Text>
                </View>
              )}
            </View>
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
    paddingVertical: 16,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
  },
  searchRow: {
    marginBottom: 12,
  },
  sortRow: {
    marginBottom: 12,
  },
  sortPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.cardHover,
    marginRight: 8,
  },
  sortPillActive: {
    backgroundColor: colors.accentDim,
  },
  sortText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "500",
  },
  sortTextActive: {
    color: colors.accent,
  },
  gameList: {
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
  },
  emptyTitle: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
