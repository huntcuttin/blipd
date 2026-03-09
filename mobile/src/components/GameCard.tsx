import { memo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { colors, radius } from "@/theme";
import { formatPrice, isPlaceholderDate } from "@/lib/format";
import type { Game } from "@/lib/types";
import FollowButton from "./FollowButton";

export default memo(function GameCard({ game, showHype }: { game: Game; showHype?: boolean }) {
  const router = useRouter();
  const daysUntilRelease = getDaysUntil(game.releaseDate);
  const releaseLabel = getReleaseLabel(game, daysUntilRelease);
  const saleEndLabel = game.isOnSale && game.saleEndDate ? getSaleEndLabel(game.saleEndDate) : null;

  return (
    <Pressable onPress={() => router.push(`/game/${game.slug}` as never)} style={styles.container}>
      {/* Cover art */}
      <Image
        source={{ uri: game.coverArt }}
        style={styles.cover}
        contentFit="cover"
        transition={200}
      />

      {/* Info */}
      <View style={styles.info}>
        <View>
          <Text style={styles.title} numberOfLines={2}>{game.title}</Text>
          <View style={styles.publisherRow}>
            <Text style={styles.publisher} numberOfLines={1}>{game.publisher}</Text>
            {game.metacriticScore !== null && (
              <Text style={[styles.metacritic, {
                color: game.metacriticScore >= 75 ? colors.green
                  : game.metacriticScore >= 50 ? colors.yellow
                  : colors.red,
              }]}>
                {" "}· {game.metacriticScore}
              </Text>
            )}
          </View>
        </View>

        {/* Price row */}
        <View style={styles.priceRow}>
          {game.isOnSale ? (
            <>
              <Text style={styles.salePrice}>{formatPrice(game.currentPrice)}</Text>
              <Text style={styles.originalPrice}>{formatPrice(game.originalPrice)}</Text>
              {game.discount != null && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>-{game.discount}%</Text>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.normalPrice}>
              {game.currentPrice === 0 && game.originalPrice === 0
                ? "Free"
                : game.currentPrice > 0
                ? formatPrice(game.currentPrice)
                : game.originalPrice > 0
                ? formatPrice(game.originalPrice)
                : ""}
            </Text>
          )}
        </View>

        {/* Badges row */}
        <View style={styles.badgeRow}>
          {game.isAllTimeLow && (
            <View style={styles.atlBadge}>
              <Text style={styles.atlText}>ALL TIME LOW</Text>
            </View>
          )}
          {game.switch2Nsuid && !game.isAllTimeLow && (
            <View style={styles.switch2Badge}>
              <Text style={styles.switch2Text}>Switch 2</Text>
            </View>
          )}
          {saleEndLabel && (
            <Text style={styles.saleEndText}>{saleEndLabel}</Text>
          )}
          {showHype && game.igdbHype != null && game.igdbHype > 0 && (
            <View style={styles.hypeBadge}>
              <Text style={styles.hypeText}>{game.igdbHype} hype</Text>
            </View>
          )}
          {releaseLabel && (
            <Text style={styles.releaseLabel}>{releaseLabel}</Text>
          )}
        </View>
      </View>

      {/* Follow button */}
      <View style={styles.followContainer}>
        <FollowButton gameId={game.id} />
      </View>
    </Pressable>
  );
});

function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getSaleEndLabel(dateStr: string): string | null {
  const days = getDaysUntil(dateStr);
  if (days <= 0) return "Ends today";
  if (days === 1) return "Ends tomorrow";
  if (days <= 14) return `Ends in ${days} days`;
  return null;
}

function getReleaseLabel(game: Game, daysUntil: number): string | null {
  if (game.releaseStatus === "out_today") return "Out Now";
  if (game.releaseStatus === "upcoming") {
    if (!game.releaseDate || isPlaceholderDate(game.releaseDate)) return "TBA";
    if (daysUntil === 0) return "Releases today";
    if (daysUntil === 1) return "Out tomorrow";
    if (daysUntil <= 7) return `Out in ${daysUntil} days`;
    const d = new Date(game.releaseDate);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  }
  return null;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cover: {
    width: 110,
    aspectRatio: 16 / 10,
    borderRadius: radius.sm,
    backgroundColor: colors.cardHover,
  },
  info: {
    flex: 1,
    justifyContent: "space-between",
  },
  title: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  publisherRow: {
    flexDirection: "row",
    marginTop: 2,
  },
  publisher: {
    color: colors.textDim,
    fontSize: 11,
    flexShrink: 1,
  },
  metacritic: {
    fontSize: 11,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  salePrice: {
    color: colors.accent,
    fontWeight: "700",
    fontSize: 14,
  },
  originalPrice: {
    color: colors.textDim,
    fontSize: 11,
    textDecorationLine: "line-through",
  },
  discountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(0, 204, 110, 0.2)",
  },
  discountText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  normalPrice: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: 14,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    flexWrap: "wrap",
  },
  atlBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(255, 215, 0, 0.15)",
  },
  atlText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  switch2Badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(0, 170, 255, 0.15)",
  },
  switch2Text: {
    color: colors.blue,
    fontSize: 10,
    fontWeight: "700",
  },
  saleEndText: {
    color: colors.red,
    fontSize: 10,
    fontWeight: "500",
  },
  hypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(255, 107, 53, 0.15)",
  },
  hypeText: {
    color: colors.orange,
    fontSize: 10,
    fontWeight: "700",
  },
  releaseLabel: {
    color: colors.blue,
    fontSize: 10,
    fontWeight: "500",
  },
  followContainer: {
    justifyContent: "flex-start",
    paddingTop: 4,
  },
});
