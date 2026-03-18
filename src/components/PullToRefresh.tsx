"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const THRESHOLD = 80;

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const isPulling = useRef(false);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY > 0 || refreshing) return;
    startY.current = e.touches[0].clientY;
    isPulling.current = true;
  }, [refreshing]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling.current) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff <= 0) {
      setPullDistance(0);
      return;
    }
    const dampened = Math.min(diff * 0.4, THRESHOLD * 1.5);
    setPullDistance(dampened);
    if (dampened > 10) e.preventDefault();
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(THRESHOLD * 0.4);
      router.refresh();
      // Give the refresh a moment to process
      setTimeout(() => {
        setRefreshing(false);
        setPullDistance(0);
      }, 1000);
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, router]);

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
            className={`w-7 h-7 rounded-full bg-[#111111] border border-[#333333] flex items-center justify-center shadow-lg ${
              refreshing ? "animate-spin" : ""
            }`}
            style={{ opacity: Math.min(pullDistance / 30, 1) }}
          >
            <div
              className="w-4 h-4 border-2 border-[#00ff88] border-t-transparent rounded-full"
              style={{
                transform: refreshing ? undefined : `rotate(${pullDistance * 4}deg)`,
              }}
            />
          </div>
        </div>
      )}
      {children}
    </>
  );
}
