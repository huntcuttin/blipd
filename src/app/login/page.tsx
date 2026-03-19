"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import { useAuth } from "@/lib/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const { user, loading, signInWithMagicLink, signInWithGoogle, signInWithApple } = useAuth();
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) router.replace("/home");
  }, [user, loading, router]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const { error } = await signInWithMagicLink(email.trim());
      if (error) {
        setError(error.message);
      } else {
        setSent(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    const { error } = await signInWithGoogle();
    if (error) setError(error.message);
  };

  const handleApple = async () => {
    setError("");
    const { error } = await signInWithApple();
    if (error) setError(error.message);
  };

  // Don't render form while checking auth
  if (loading || user) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#0a0a0a] -mb-20 relative">
      {/* Back button */}
      <Link
        href="/home"
        aria-label="Back to home"
        className="absolute top-4 left-4 w-11 h-11 flex items-center justify-center rounded-full bg-[#111111] border border-[#222222] text-white hover:border-[#333333] transition-all"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
      </Link>

      {/* Logo */}
      <div className="mb-8">
        <Logo size={64} />
      </div>

      {/* Tagline */}
      <h1 className="text-2xl font-bold text-white mb-2 text-center">
        Never miss a Nintendo drop.
      </h1>

      {!sent ? (
        <div className="w-full max-w-sm mt-8">
          {/* OAuth buttons */}
          <div className="space-y-3">
            <button
              onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-white text-[#1f1f1f] font-semibold text-sm transition-all hover:bg-gray-100 active:scale-[0.98]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>

            <button
              onClick={handleApple}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-[#111111] border border-[#333333] text-white font-semibold text-sm transition-all hover:bg-[#1a1a1a] active:scale-[0.98]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              Continue with Apple
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-[#222222]" />
            <span className="text-[#555555] text-xs">or</span>
            <div className="flex-1 h-px bg-[#222222]" />
          </div>

          {/* Email magic link */}
          {!showEmail ? (
            <button
              onClick={() => setShowEmail(true)}
              className="w-full py-3.5 rounded-xl border border-[#333333] text-white font-semibold text-sm transition-all hover:border-[#444444] hover:bg-[#111111] active:scale-[0.98]"
            >
              Continue with email
            </button>
          ) : (
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <div>
                <label htmlFor="login-email" className="sr-only">Email address</label>
                <input
                  id="login-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  aria-describedby={error ? "login-error" : undefined}
                  className="w-full px-4 py-3.5 rounded-xl bg-[#111111] border border-[#222222] text-white placeholder:text-[#666666] focus:outline-none focus:border-[#00ff88] focus:shadow-[0_0_12px_#00ff8844] transition-all text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-[#00ff88] text-[#0a0a0a] font-semibold text-sm transition-all shadow-[0_0_12px_#00ff88,0_0_24px_#00ff8844] hover:shadow-[0_0_16px_#00ff88,0_0_32px_#00ff8844] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Sending..." : "Send Magic Link"}
              </button>
            </form>
          )}

          {error && (
            <p id="login-error" role="alert" className="text-red-400 text-xs text-center mt-3">{error}</p>
          )}

          <p className="text-[#555555] text-xs text-center mt-5">
            Free forever. No password needed.
          </p>

          {/* Value props */}
          <div className="mt-8 space-y-3">
            <ValueProp text="Price drop alerts" />
            <ValueProp text="Release day notifications" />
            <ValueProp text="All-time low tracking" />
          </div>
        </div>
      ) : (
        <div className="text-center mt-8 w-full max-w-sm" role="status" aria-live="polite">
          <div className="w-16 h-16 rounded-full bg-[#00ff88]/10 flex items-center justify-center mx-auto mb-4 shadow-[0_0_12px_#00ff8844]">
            <svg
              className="w-8 h-8 text-[#00ff88]"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
          <p className="text-[#666666] text-sm">
            We sent a magic link to{" "}
            <span className="text-white font-medium">{email}</span>
          </p>
          <button
            onClick={() => setSent(false)}
            className="mt-6 text-sm text-[#00ff88] hover:underline transition-colors py-2"
          >
            Use a different email
          </button>
        </div>
      )}
    </div>
  );
}

function ValueProp({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <svg
        className="w-5 h-5 text-[#00ff88] shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m4.5 12.75 6 6 9-13.5"
        />
      </svg>
      <span className="text-white/80 text-sm">{text}</span>
    </div>
  );
}
