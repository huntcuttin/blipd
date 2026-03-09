import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { colors, radius } from "@/theme";

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    const { error } = await signInWithMagicLink(email.trim());
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        {/* Back button */}
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Cancel</Text>
        </Pressable>

        <View style={styles.content}>
          <Text style={styles.logo}>blippd</Text>

          {sent ? (
            <View style={styles.sentContainer}>
              <Text style={styles.sentTitle}>Check your email</Text>
              <Text style={styles.sentSubtext}>
                We sent a magic link to {email}. Tap the link to sign in.
              </Text>
              <Pressable onPress={() => { setSent(false); setEmail(""); }} style={styles.tryAgainButton}>
                <Text style={styles.tryAgainText}>Use a different email</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.title}>Sign in with email</Text>
              <Text style={styles.subtitle}>No password needed — we'll send you a magic link</Text>

              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.textDark}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
              />

              {error && <Text style={styles.error}>{error}</Text>}

              <Pressable
                onPress={handleSubmit}
                disabled={loading || !email.trim()}
                style={[styles.submitButton, (!email.trim() || loading) && styles.submitButtonDisabled]}
              >
                <Text style={styles.submitText}>
                  {loading ? "Sending..." : "Send magic link"}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
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
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: "flex-start",
  },
  backText: {
    color: colors.accent,
    fontSize: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    marginTop: -60,
  },
  logo: {
    color: colors.accent,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 32,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: colors.textPrimary,
    fontSize: 16,
    marginBottom: 12,
  },
  error: {
    color: colors.red,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 8,
  },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  submitButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  submitText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: "600",
  },
  sentContainer: {
    alignItems: "center",
  },
  sentTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12,
  },
  sentSubtext: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  tryAgainButton: {
    paddingVertical: 12,
  },
  tryAgainText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "500",
  },
});
