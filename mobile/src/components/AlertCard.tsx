import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { colors, radius } from "@/theme";
import type { GameAlert, AlertType } from "@/lib/types";

const alertConfig: Record<AlertType, { emoji: string; label: string; color: string; bg: string }> = {
  price_drop: { emoji: "🟢", label: "PRICE DROP", color: colors.accent, bg: "rgba(0, 255, 136, 0.15)" },
  all_time_low: { emoji: "🔥", label: "ALL TIME LOW", color: colors.gold, bg: "rgba(255, 215, 0, 0.15)" },
  out_now: { emoji: "🎮", label: "OUT NOW", color: colors.cyan, bg: "rgba(0, 191, 255, 0.15)" },
  sale_started: { emoji: "🏷️", label: "SALE STARTED", color: colors.pink, bg: "rgba(255, 105, 180, 0.15)" },
  sale_ending: { emoji: "⏰", label: "SALE ENDING", color: colors.red, bg: "rgba(255, 104, 116, 0.15)" },
  release_today: { emoji: "📅", label: "RELEASE TODAY", color: colors.orange, bg: "rgba(255, 165, 0, 0.15)" },
  announced: { emoji: "📣", label: "ANNOUNCED", color: colors.purple, bg: "rgba(155, 89, 182, 0.15)" },
  switch2_edition_announced: { emoji: "🎮", label: "SWITCH 2", color: colors.blue, bg: "rgba(0, 170, 255, 0.15)" },
};

export default function AlertCard({
  alert,
  onTap,
  onRemind,
}: {
  alert: GameAlert;
  onTap?: (id: string) => void;
  onRemind?: (id: string) => void;
}) {
  const router = useRouter();
  const config = alertConfig[alert.type] ?? { emoji: "📢", label: alert.type.toUpperCase(), color: colors.textSecondary, bg: "rgba(136, 136, 136, 0.15)" };
  const [reminded, setReminded] = useState(false);

  const handlePress = () => {
    if (!alert.read) onTap?.(alert.id);
    if (alert.gameSlug) {
      router.push(`/game/${alert.gameSlug}` as never);
    }
  };

  const handleRemind = () => {
    setReminded(true);
    onRemind?.(alert.id);
  };

  return (
    <Pressable onPress={handlePress} style={[styles.container, alert.read ? styles.readContainer : styles.unreadContainer]}>
      {/* Unread dot */}
      <View style={styles.dotContainer}>
        {!alert.read ? <View style={styles.dot} /> : <View style={styles.dotPlaceholder} />}
      </View>

      {/* Cover art */}
      {alert.gameCoverArt ? (
        <Image source={{ uri: alert.gameCoverArt }} style={styles.cover} contentFit="cover" transition={200} />
      ) : null}

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.badgeRow}>
          <View style={[styles.typeBadge, { backgroundColor: config.bg }]}>
            <Text style={[styles.typeText, { color: config.color }]}>
              {config.emoji} {config.label}
            </Text>
          </View>
          <Text style={styles.timestamp}>{alert.timestamp}</Text>
        </View>

        <Text style={[styles.headline, alert.read && styles.readText]} numberOfLines={2}>
          {alert.headline}
        </Text>
        <Text style={styles.subtext} numberOfLines={1}>{alert.subtext}</Text>

        {!alert.read && onRemind && !reminded && (
          <Pressable onPress={handleRemind}>
            <Text style={styles.remindText}>Remind me in a few days</Text>
          </Pressable>
        )}
        {reminded && <Text style={styles.reminderSet}>Reminder set</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  unreadContainer: {
    backgroundColor: colors.card,
    borderColor: "rgba(0, 255, 136, 0.2)",
  },
  readContainer: {
    backgroundColor: "rgba(17, 17, 17, 0.6)",
    borderColor: colors.cardHover,
    opacity: 0.6,
  },
  dotContainer: {
    justifyContent: "flex-start",
    paddingTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  dotPlaceholder: {
    width: 8,
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.cardHover,
  },
  content: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  typeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  timestamp: {
    color: colors.textDim,
    fontSize: 10,
    marginLeft: "auto",
  },
  headline: {
    color: colors.textPrimary,
    fontWeight: "600",
    fontSize: 14,
    lineHeight: 18,
  },
  readText: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  subtext: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 2,
  },
  remindText: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 6,
    paddingVertical: 4,
  },
  reminderSet: {
    color: colors.accent,
    fontSize: 10,
    marginTop: 6,
  },
});
