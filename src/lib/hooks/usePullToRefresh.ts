"use client";

import { useCallback, useRef, useState, useEffect } from "react";

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number; // px to pull before triggering (default: 80)
}

export function usePullToRefresh({ onRefresh, threshold = 80 }: PullToRefreshOptions) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const pulling_ = useRef(false);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
    pulling_.current = true;
  }, []);

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!pulling_.current) return;
      const diff = e.touches[0].clientY - startY.current;
      if (diff <= 0) {
        setPullDistance(0);
        setPulling(false);
        return;
      }
      // Dampen the pull
      const dampened = Math.min(diff * 0.4, threshold * 1.5);
      setPullDistance(dampened);
      setPulling(true);
      if (dampened > 10) e.preventDefault();
    },
    [threshold]
  );

  const onTouchEnd = useCallback(async () => {
    if (!pulling_.current) return;
    pulling_.current = false;
    if (pullDistance >= threshold) {
      setRefreshing(true);
      setPullDistance(threshold * 0.5);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPullDistance(0);
    setPulling(false);
  }, [pullDistance, threshold, onRefresh]);

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

  return { pulling, refreshing, pullDistance };
}
