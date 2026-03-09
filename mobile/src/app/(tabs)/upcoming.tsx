import { useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GameCard from "@/components/GameCard";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getUpcomingGames } from "@/lib/queries";
import { colors } from "@/theme";

export default function UpcomingScreen() {
  const { data: games, loading } = useSupabaseQuery(getUpcomingGames);

  const upcomingGames = useMemo(() => games ?? [], [games]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Upcoming</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={styles.loader} />
        ) : upcomingGames.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No upcoming games</Text>
          </View>
        ) : (
          <View style={styles.gameList}>
            {upcomingGames.map((game) => (
              <GameCard key={game.id} game={game} showHype />
            ))}
          </View>
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
  gameList: {
    gap: 8,
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
