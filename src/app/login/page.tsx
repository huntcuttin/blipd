"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) setSent(true);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#0a0a0a] -mb-20 relative">
      {/* Back button */}
      <Link
        href="/browse"
        className="absolute top-4 left-4 w-8 h-8 flex items-center justify-center rounded-full bg-[#111111] border border-[#222222] text-white hover:border-[#00ff88]/30 transition-all"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-3.5 rounded-xl bg-[#111111] border border-[#222222] text-white placeholder:text-[#666666] focus:outline-none focus:border-[#00ff88] focus:shadow-[0_0_12px_#00ff8844] transition-all text-sm"
            />
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-[#00ff88] text-[#0a0a0a] font-semibold text-sm transition-all shadow-[0_0_12px_#00ff88,0_0_24px_#00ff8844] hover:shadow-[0_0_16px_#00ff88,0_0_32px_#00ff8844]"
            >
              Send Magic Link
            </button>
          </form>
          <p className="text-[#666666] text-xs text-center mt-4">
            We&apos;ll email you a login link. No password needed.
          </p>

          {/* Value props */}
          <div className="mt-10 space-y-3">
            <ValueProp text="Price drop alerts" />
            <ValueProp text="Release day notifications" />
            <ValueProp text="All time low tracking" />
          </div>
        </div>
      ) : (
        <div className="text-center mt-8 w-full max-w-sm">
          <div className="w-16 h-16 rounded-full bg-[#00ff88]/10 flex items-center justify-center mx-auto mb-4 shadow-[0_0_12px_#00ff8844]">
            <svg
              className="w-8 h-8 text-[#00ff88]"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
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
            className="mt-6 text-sm text-[#00ff88] hover:underline transition-colors"
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
