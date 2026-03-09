import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import AlertCard from "@/components/AlertCard";
import { useAuth } from "@/contexts/AuthContext";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getAlerts, markAlertRead, remindAlert } from "@/lib/queries";
import { createClient } from "@/lib/supabase";
import { colors, radius } from "@/theme";
import type { GameAlert, AlertType } from "@/lib/types";

type TimeGroup = "today" | "yesterday" | "this_week" | "earlier";

const GROUP_LABELS: Record<TimeGroup, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This Week",
  earlier: "Earlier",
};

export default function AlertsScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { data: fetchedAlerts, loading: alertsLoading } = useSupabaseQuery(
    (sb) => (authLoading ? Promise.resolve([]) : getAlerts(sb, user?.id)),
    [user?.id, authLoading]
  );

  const [localAlerts, setLocalAlerts] = useState<GameAlert[]>([]);

  useEffect(() => {
    if (fetchedAlerts) setLocalAlerts(fetchedAlerts);
  }, [fetchedAlerts]);

  const handleTap = async (id: string) => {
    setLocalAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
    if (user) {
      try {
        const supabase = createClient();
        await markAlertRead(supabase, user.id, id);
      } catch {
        setLocalAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: false } : a)));
      }
    }
  };

  const handleRemind = async (id: string) => {
    setLocalAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
    if (user) {
      try {
        const supabase = createClient();
        await remindAlert(supabase, user.id, id);
      } catch {
        setLocalAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: false } : a)));
      }
    }
  };

  const handleMarkAllRead = async () => {
    const unread = localAlerts.filter((a) => !a.read);
    if (unread.length === 0) return;
    const unreadIds = new Set(unread.map((a) => a.id));
    setLocalAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    if (user) {
      try {
        const supabase = createClient();
        await Promise.all(unread.map((a) => markAlertRead(supabase, user.id, a.id)));
      } catch {
        setLocalAlerts((prev) => prev.map((a) => (unreadIds.has(a.id) ? { ...a, read: false } : a)));
      }
    }
  };

  const alerts = localAlerts;
  const unreadCount = alerts.filter((a) => !a.read).length;

  const grouped: Record<TimeGroup, GameAlert[]> = {
    today: [],
    yesterday: [],
    this_week: [],
    earlier: [],
  };
  alerts.forEach((alert) => {
    grouped[alert.timestampGroup].push(alert);
  });

  const isEmpty = alerts.length === 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Alerts</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unreadCount} new</Text>
              </View>
            )}
          </View>
          {unreadCount > 0 && (
            <Pressable onPress={handleMarkAllRead}>
              <Text style={styles.markAllRead}>Mark all read</Text>
            </Pressable>
          )}
        </View>

        {alertsLoading ? (
          <ActivityIndicator color={colors.accent} style={styles.loader} />
        ) : isEmpty ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No alerts yet</Text>
            <Text style={styles.emptySubtext}>
              {user
                ? "Follow games and we'll let you know when prices drop."
                : "Sign in and follow games to get notified about price drops, sales, and new releases."}
            </Text>
            {!user && (
              <Pressable onPress={() => router.push("/login" as never)} style={styles.signInButton}>
                <Text style={styles.signInText}>Sign in to get alerts</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.alertGroups}>
            {(Object.keys(grouped) as TimeGroup[]).map((group) => {
              const groupAlerts = grouped[group];
              if (groupAlerts.length === 0) return null;
              return (
                <View key={group} style={styles.group}>
                  <Text style={styles.groupLabel}>{GROUP_LABELS[group]}</Text>
                  <View style={styles.alertList}>
                    {groupAlerts.map((alert) => (
                      <AlertCard key={alert.id} alert={alert} onTap={handleTap} onRemind={handleRemind} />
                    ))}
                  </View>
                </View>
              );
            })}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
  },
  unreadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.accentDim,
  },
  unreadText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  markAllRead: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "500",
  },
  alertGroups: {
    gap: 24,
  },
  group: {
    gap: 8,
  },
  groupLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  alertList: {
    gap: 8,
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
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptySubtext: {
    color: colors.textDim,
    fontSize: 14,
    textAlign: "center",
    maxWidth: 260,
  },
  signInButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  signInText: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: "600",
  },
});
