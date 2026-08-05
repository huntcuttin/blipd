"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import RadarSpinner from "@/components/RadarSpinner";

const THRESHOLD = 80;

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const startX = useRef(0);
  const isPulling = useRef(false);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY > 0 || refreshing) return;
    startY.current = e.touches[0].clientY;
    startX.current = e.touches[0].clientX;
    isPulling.current = true;
  }, [refreshing]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling.current) return;
    const diffY = e.touches[0].clientY - startY.current;
    const diffX = e.touches[0].clientX - startX.current;
    // A horizontal-scroll carousel (All-Time-Lows, franchise rows, ...) can
    // pick up a touch that starts at scrollY 0 too — bail out entirely once
    // the gesture reads as sideways rather than a downward pull, instead of
    // fighting it with preventDefault based on vertical delta alone.
    if (Math.abs(diffX) > Math.abs(diffY)) {
      isPulling.current = false;
      setPullDistance(0);
      return;
    }
    if (diffY <= 0) {
      setPullDistance(0);
      return;
    }
    const dampened = Math.min(diffY * 0.4, THRESHOLD * 1.5);
    setPullDistance(dampened);
    if (dampened > 10) e.preventDefault();
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(THRESHOLD * 0.4);
      // router.refresh() only re-fetches server-rendered data — every page
      // here loads its actual visible data client-side via Supabase queries
      // in useEffect, so refresh() alone was a no-op from the user's POV. A
      // full reload is heavier but is the only thing that genuinely
      // refreshes what pull-to-refresh promises, given no shared client-side
      // query-invalidation mechanism exists across pages.
      window.location.reload();
    } else {
      setPullDistance(0);
    }
  }, [pullDistance]);

  useEffect(() => {
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  const showIndicator = pullDistance > 0 || refreshing;

  return (
    <>
      {showIndicator && (
        <div
          className="fixed left-0 right-0 flex items-center justify-center z-[100] pointer-events-none"
          style={{ top: `calc(env(safe-area-inset-top, 0px) + ${pullDistance}px)` }}
        >
          <div
            className="w-7 h-7 rounded-full bg-[#111111] border border-[#333333] flex items-center justify-center shadow-lg"
            style={{ opacity: Math.min(pullDistance / 30, 1) }}
          >
            {refreshing ? (
              // Actually loading — the branded mark, not the drag preview below.
              <RadarSpinner size={16} />
            ) : (
              // Pre-threshold preview: rotates with how far the user has
              // pulled (not a loading state), so it keeps its own manually
              // driven arc rather than the spinner's fixed sweep.
              <div
                className="w-4 h-4 border-2 border-[#00ff88] border-t-transparent rounded-full"
                style={{ transform: `rotate(${pullDistance * 4}deg)` }}
              />
            )}
          </div>
        </div>
      )}
      {children}
    </>
  );
}
