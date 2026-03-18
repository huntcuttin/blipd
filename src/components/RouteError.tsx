"use client";

import { useEffect } from "react";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#111111] border border-[#222222] flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-[#ff6874]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-white mb-2">Something went wrong</h2>
      <p className="text-[#666666] text-sm mb-5 max-w-[240px]">
        Try refreshing, or head back and try again.
      </p>
      <button
        onClick={reset}
        className="px-5 py-2.5 rounded-xl bg-[#00ff88] text-[#0a0a0a] font-semibold text-sm hover:shadow-[0_0_12px_#00ff8855] transition-all"
      >
        Try again
      </button>
    </div>
  );
}
