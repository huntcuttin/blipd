import { Pressable, Text, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useFollow } from "@/contexts/FollowContext";
import { colors, radius } from "@/theme";

export default function FollowButton({
  gameId,
  size = "default",
}: {
  gameId: string;
  size?: "default" | "large";
}) {
  const { user } = useAuth();
  const { isFollowingGame, toggleFollowGame } = useFollow();
  const router = useRouter();
  const following = isFollowingGame(gameId);

  const handlePress = () => {
    if (!user) {
      router.push("/login" as never);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFollowGame(gameId);
  };

  const isLarge = size === "large";

  if (following) {
    return (
      <Pressable onPress={handlePress} style={[styles.button, styles.followingButton, isLarge && styles.largeButton]}>
        <Text style={[styles.followingText, isLarge && styles.largeText]}>Following</Text>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={handlePress} style={[styles.button, styles.unfollowedButton, isLarge && styles.largeButton]}>
      <Text style={[styles.unfollowedText, isLarge && styles.largeText]}>Follow</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  followingButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  unfollowedButton: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
  largeButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    width: "100%",
  },
  followingText: {
    color: colors.bg,
    fontWeight: "600",
    fontSize: 12,
  },
  unfollowedText: {
    color: colors.textSecondary,
    fontWeight: "500",
    fontSize: 12,
  },
  largeText: {
    fontSize: 16,
  },
});
