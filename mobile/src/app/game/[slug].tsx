import { View, Text, ScrollView, Pressable, StyleSheet, Linking as RNLinking, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import FollowButton from "@/components/FollowButton";
import AlertCard from "@/components/AlertCard";
import { useFollow } from "@/contexts/FollowContext";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getGameBySlug, getAlertsForGame, getFranchiseByName } from "@/lib/queries";
import { formatPrice, formatShortDate, formatLongDate, isPlaceholderDate } from "@/lib/format";
import { colors, radius } from "@/theme";

export default function GameDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { isFollowingGame } = useFollow();

  const { data: game, loading } = useSupabaseQuery(
    (sb) => getGameBySlug(sb, slug),
    [slug]
  );

  const { data: alerts } = useSupabaseQuery(
    (sb) => (game ? getAlertsForGame(sb, game.id) : Promise.resolve([])),
    [game?.id]
  );

  const { data: franchise } = useSupabaseQuery(
    (sb) => (game?.franchise ? getFranchiseByName(sb, game.franchise) : Promise.resolve(null)),
    [game?.franchise]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator color={colors.accent} style={styles.loader} />
      </SafeAreaView>
    );
  }

  if (!game) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Game not found</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backLink}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const placeholderDate = isPlaceholderDate(game.releaseDate);
  const gameAlerts = alerts ?? [];

  const eshopUrl = game.nsuid
    ? `https://www.nintendo.com/us/store/products/${game.nsuid}`
    : "https://www.nintendo.com/us/store/";

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      {/* Hero cover */}
      <View style={styles.hero}>
        <Image source={{ uri: game.coverArt }} style={styles.heroCover} contentFit="cover" transition={200} />
        <View style={styles.heroOverlay} />

        {/* Back button */}
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
            <Path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </Svg>
        </Pressable>

        {/* Title overlay */}
        <View style={styles.heroInfo}>
          <Text style={styles.heroTitle} numberOfLines={2}>{game.title}</Text>
          <View style={styles.heroMeta}>
            {game.publisher && <Text style={styles.heroPublisher}>{game.publisher}</Text>}
            {game.metacriticScore !== null && (
              <View style={[styles.metacriticBadge, {
                backgroundColor: game.metacriticScore >= 85 ? "rgba(0, 206, 122, 0.2)"
                  : game.metacriticScore >= 70 ? "rgba(255, 189, 63, 0.2)"
                  : "rgba(255, 104, 116, 0.2)",
              }]}>
                <Text style={[styles.metacriticText, {
                  color: game.metacriticScore >= 85 ? colors.green
                    : game.metacriticScore >= 70 ? colors.yellow
                    : colors.red,
                }]}>
                  {game.metacriticScore}
                </Text>
              </View>
            )}
            {franchise && (
              <Pressable
                onPress={() => router.push(`/franchise/${encodeURIComponent(franchise.name)}` as never)}
                style={styles.franchiseBadge}
              >
                <Text style={styles.franchiseText}>{franchise.name}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      <View style={styles.body}>
        {/* Price section */}
        <View style={styles.priceSection}>
          <View style={styles.priceRow}>
            <Text style={styles.currentPrice}>
              {game.currentPrice === 0 && game.originalPrice === 0 ? "Free" : formatPrice(game.currentPrice)}
            </Text>
            {game.isOnSale && (
              <>
                <Text style={styles.originalPrice}>{formatPrice(game.originalPrice)}</Text>
                {game.discount != null && (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountText}>-{game.discount}%</Text>
                  </View>
                )}
              </>
            )}
          </View>
          {game.isAllTimeLow && (
            <View style={styles.atlBanner}>
              <Text style={styles.atlBannerText}>ALL TIME LOW PRICE</Text>
            </View>
          )}
          {game.isOnSale && game.saleEndDate && (
            <Text style={styles.saleEndText}>Ends {formatShortDate(game.saleEndDate)}</Text>
          )}
          <Text style={styles.releaseInfo}>
            {placeholderDate
              ? "Release date TBD"
              : game.releaseStatus === "released"
              ? `Released ${formatLongDate(game.releaseDate)}`
              : game.releaseStatus === "out_today"
              ? "Released today"
              : `Releasing ${formatLongDate(game.releaseDate)}`}
          </Text>
        </View>

        {/* Follow button */}
        <View style={styles.followSection}>
          <FollowButton gameId={game.id} size="large" />
        </View>

        {/* eShop link */}
        <Pressable onPress={() => RNLinking.openURL(eshopUrl)} style={styles.eshopLink}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth={1.5}>
            <Path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </Svg>
          <Text style={styles.eshopText}>View on Nintendo eShop</Text>
        </Pressable>

        {/* Recent alerts */}
        <View style={styles.alertsSection}>
          <Text style={styles.sectionTitle}>Recent Alerts</Text>
          {gameAlerts.length > 0 ? (
            <View style={styles.alertList}>
              {gameAlerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No alerts yet for this game</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loader: {
    marginTop: 80,
  },
  notFound: {
    alignItems: "center",
    paddingTop: 80,
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
    height: 224,
    backgroundColor: colors.cardHover,
    overflow: "hidden",
  },
  heroCover: {
    width: "100%",
    height: "100%",
    opacity: 0.6,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 10, 10, 0.4)",
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
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 28,
  },
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  heroPublisher: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  metacriticBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  metacriticText: {
    fontSize: 10,
    fontWeight: "700",
  },
  franchiseBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  franchiseText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "500",
  },
  body: {
    paddingHorizontal: 16,
  },
  priceSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  currentPrice: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: "700",
  },
  originalPrice: {
    color: colors.textSecondary,
    fontSize: 18,
    textDecorationLine: "line-through",
  },
  discountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.accentDim,
  },
  discountText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  atlBanner: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: "rgba(255, 215, 0, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.2)",
    alignSelf: "flex-start",
  },
  atlBannerText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  saleEndText: {
    color: colors.red,
    fontSize: 14,
    fontWeight: "500",
    marginTop: 4,
  },
  releaseInfo: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 12,
  },
  followSection: {
    paddingVertical: 16,
  },
  eshopLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eshopText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "500",
  },
  alertsSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 16,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 12,
  },
  alertList: {
    gap: 8,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
