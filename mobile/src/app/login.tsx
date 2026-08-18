import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { colors, radius } from "@/theme";

// Supabase project setting (Auth > mailer_otp_length), currently 8. Must match
// or the Sign in button never enables.
const CODE_LENGTH = 8;

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithMagicLink, verifyEmailCode } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

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

  const handleVerify = async () => {
    const entered = code.trim();
    if (entered.length < CODE_LENGTH || verifying) return;
    setVerifying(true);
    setError(null);
    const { error } = await verifyEmailCode(email.trim(), entered);
    setVerifying(false);
    if (error) {
      setError("That code did not work. Check it and try again, or send a new one.");
      setCode("");
    } else {
      // onAuthStateChange in AuthContext picks the session up from here.
      router.replace("/");
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
                We sent a {CODE_LENGTH}-digit code to {email}. Enter it below to sign in.
              </Text>

              <TextInput
                style={styles.codeInput}
                value={code}
                onChangeText={(t) => setCode(t.replace(/[^0-9]/g, "").slice(0, CODE_LENGTH))}
                placeholder={"0".repeat(CODE_LENGTH)}
                placeholderTextColor={colors.textDark}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                autoFocus
                returnKeyType="go"
                onSubmitEditing={handleVerify}
                maxLength={CODE_LENGTH}
              />

              {error && <Text style={styles.error}>{error}</Text>}

              <Pressable
                onPress={handleVerify}
                disabled={verifying || code.trim().length < CODE_LENGTH}
                style={[
                  styles.submitButton,
                  styles.verifyButton,
                  (verifying || code.trim().length < CODE_LENGTH) && styles.submitButtonDisabled,
                ]}
              >
                <Text style={styles.submitText}>{verifying ? "Signing in..." : "Sign in"}</Text>
              </Pressable>

              <Text style={styles.linkHint}>
                The email also has a link you can tap instead.
              </Text>

              <Pressable
                onPress={() => { setSent(false); setEmail(""); setCode(""); setError(null); }}
                style={styles.tryAgainButton}
              >
                <Text style={styles.tryAgainText}>Use a different email</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.title}>Sign in with email</Text>
              <Text style={styles.subtitle}>No password needed. We&apos;ll email you a code.</Text>

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
                  {loading ? "Sending..." : "Email me a code"}
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
  codeInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 8,
    textAlign: "center",
    marginBottom: 12,
    alignSelf: "stretch",
  },
  verifyButton: {
    alignSelf: "stretch",
  },
  linkHint: {
    color: colors.textDark,
    fontSize: 12,
    textAlign: "center",
    marginTop: 16,
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
