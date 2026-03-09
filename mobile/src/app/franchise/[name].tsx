import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import GameCard from "@/components/GameCard";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getFranchiseByName, getGamesByFranchise } from "@/lib/queries";
import { colors, radius } from "@/theme";

export default function FranchiseDetailScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const decodedName = decodeURIComponent(name);

  const { data: franchise, loading } = useSupabaseQuery(
    (sb) => getFranchiseByName(sb, decodedName),
    [decodedName]
  );

  const { data: games } = useSupabaseQuery(
    (sb) => getGamesByFranchise(sb, decodedName),
    [decodedName]
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!franchise) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Franchise not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backLink}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const allGames = games ?? [];
  const onSale = allGames.filter((g) => g.isOnSale);
  const notOnSale = allGames.filter((g) => !g.isOnSale);

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      {/* Hero */}
      <View style={styles.hero}>
        {franchise.logo ? (
          <Image source={{ uri: franchise.logo }} style={styles.heroBg} contentFit="cover" />
        ) : (
          <View style={styles.heroPlaceholder} />
        )}
        <View style={styles.heroOverlay} />

        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
            <Path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </Svg>
        </Pressable>

        <View style={styles.heroInfo}>
          {franchise.logo ? (
            <Image source={{ uri: franchise.logo }} style={styles.franchiseLogo} contentFit="cover" />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoText}>{franchise.name.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.franchiseMeta}>
            <Text style={styles.franchiseName}>{franchise.name}</Text>
            <Text style={styles.franchiseCount}>
              {franchise.gameCount} games
              {onSale.length > 0 && (
                <Text style={styles.onSaleCount}> · {onSale.length} on sale</Text>
              )}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        {/* On Sale */}
        {onSale.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitleGreen}>ON SALE</Text>
            <View style={styles.gameList}>
              {onSale.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </View>
          </View>
        )}

        {/* All Games */}
        {notOnSale.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ALL GAMES</Text>
            <View style={styles.gameList}>
              {notOnSale.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </View>
          </View>
        )}

        {allGames.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No games found</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  notFoundText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  backLink: {
    color: colors.accent,
    fontSize: 14,
    marginTop: 12,
  },
  hero: {
    height: 192,
    backgroundColor: colors.cardHover,
    overflow: "hidden",
  },
  heroBg: {
    width: "100%",
    height: "100%",
    opacity: 0.4,
  },
  heroPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.cardHover,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 10, 10, 0.5)",
  },
  backButton: {
    position: "absolute",
    top: 52,
    left: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(10, 10, 10, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroInfo: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  franchiseLogo: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.cardHover,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  logoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.cardHover,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: "700",
  },
  franchiseMeta: {
    flex: 1,
  },
  franchiseName: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 28,
  },
  franchiseCount: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 2,
  },
  onSaleCount: {
    color: colors.accent,
  },
  body: {
    paddingHorizontal: 16,
  },
  section: {
    paddingTop: 16,
  },
  sectionTitleGreen: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
  },
  gameList: {
    gap: 8,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
