"use client";

import { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import type { NotifyPrefs } from "@/lib/types";
import { DEFAULT_NOTIFY_PREFS } from "@/lib/types";
import {
  getUserGameFollows,
  getUserFranchiseFollows,
  followGame as dbFollowGame,
  unfollowGame as dbUnfollowGame,
  followFranchise as dbFollowFranchise,
  unfollowFranchise as dbUnfollowFranchise,
  updateGameFollowPrefs as dbUpdateGamePrefs,
  updateFranchiseFollowPrefs as dbUpdateFranchisePrefs,
} from "@/lib/queries";

interface FollowContextType {
  followedGameIds: Set<string>;
  followedFranchiseIds: Set<string>;
  toggleFollowGame: (gameId: string) => void;
  toggleFollowFranchise: (franchiseId: string) => void;
  isFollowingGame: (gameId: string) => boolean;
  isFollowingFranchise: (franchiseId: string) => boolean;
  getGamePrefs: (gameId: string) => NotifyPrefs;
  getFranchisePrefs: (franchiseId: string) => NotifyPrefs;
  updateGamePrefs: (gameId: string, prefs: Partial<NotifyPrefs>) => void;
  updateFranchisePrefs: (franchiseId: string, prefs: Partial<NotifyPrefs>) => void;
  loading: boolean;
}

const FollowContext = createContext<FollowContextType | null>(null);

export function FollowProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [followedGameIds, setFollowedGameIds] = useState<Set<string>>(new Set());
  const [followedFranchiseIds, setFollowedFranchiseIds] = useState<Set<string>>(new Set());
  const [gamePrefsMap, setGamePrefsMap] = useState<Map<string, NotifyPrefs>>(new Map());
  const [franchisePrefsMap, setFranchisePrefsMap] = useState<Map<string, NotifyPrefs>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setFollowedGameIds(new Set());
      setFollowedFranchiseIds(new Set());
      setGamePrefsMap(new Map());
      setFranchisePrefsMap(new Map());
      return;
    }

    const supabase = createClient();
    setLoading(true);
    Promise.all([
      getUserGameFollows(supabase, user.id),
      getUserFranchiseFollows(supabase, user.id),
    ])
      .then(([gameFollows, franchiseFollows]) => {
        setFollowedGameIds(new Set(gameFollows.map((f) => f.gameId)));
        const gPrefs = new Map<string, NotifyPrefs>();
        for (const f of gameFollows) gPrefs.set(f.gameId, f.prefs);
        setGamePrefsMap(gPrefs);

        setFollowedFranchiseIds(new Set(franchiseFollows.map((f) => f.franchiseId)));
        const fPrefs = new Map<string, NotifyPrefs>();
        for (const f of franchiseFollows) fPrefs.set(f.franchiseId, f.prefs);
        setFranchisePrefsMap(fPrefs);
      })
      .catch((err) => {
        console.error("Failed to load follows:", err);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const toggleFollowGame = useCallback(
    (gameId: string): void => {
      const supabase = createClient();
      if (followedGameIds.has(gameId)) {
        const savedPrefs = gamePrefsMap.get(gameId) ?? { ...DEFAULT_NOTIFY_PREFS };
        setFollowedGameIds((prev) => { const next = new Set(prev); next.delete(gameId); return next; });
        setGamePrefsMap((prev) => { const next = new Map(prev); next.delete(gameId); return next; });
        if (user) {
          dbUnfollowGame(supabase, user.id, gameId).catch(() => {
            setFollowedGameIds((prev) => new Set(prev).add(gameId));
            setGamePrefsMap((prev) => new Map(prev).set(gameId, savedPrefs));
          });
        }
        return;
      }
      setFollowedGameIds((prev) => new Set(prev).add(gameId));
      setGamePrefsMap((prev) => new Map(prev).set(gameId, { ...DEFAULT_NOTIFY_PREFS }));
      if (user) {
        dbFollowGame(supabase, user.id, gameId).catch(() => {
          setFollowedGameIds((prev) => { const next = new Set(prev); next.delete(gameId); return next; });
          setGamePrefsMap((prev) => { const next = new Map(prev); next.delete(gameId); return next; });
        });
      }
    },
    [followedGameIds, gamePrefsMap, user]
  );

  const toggleFollowFranchise = useCallback(
    (franchiseId: string) => {
      const supabase = createClient();
      if (followedFranchiseIds.has(franchiseId)) {
        const savedPrefs = franchisePrefsMap.get(franchiseId) ?? { ...DEFAULT_NOTIFY_PREFS };
        setFollowedFranchiseIds((prev) => { const next = new Set(prev); next.delete(franchiseId); return next; });
        setFranchisePrefsMap((prev) => { const next = new Map(prev); next.delete(franchiseId); return next; });
        if (user) {
          dbUnfollowFranchise(supabase, user.id, franchiseId).catch(() => {
            setFollowedFranchiseIds((prev) => new Set(prev).add(franchiseId));
            setFranchisePrefsMap((prev) => new Map(prev).set(franchiseId, savedPrefs));
          });
        }
      } else {
        setFollowedFranchiseIds((prev) => new Set(prev).add(franchiseId));
        setFranchisePrefsMap((prev) => new Map(prev).set(franchiseId, { ...DEFAULT_NOTIFY_PREFS }));
        if (user) {
          dbFollowFranchise(supabase, user.id, franchiseId).catch(() => {
            setFollowedFranchiseIds((prev) => { const next = new Set(prev); next.delete(franchiseId); return next; });
            setFranchisePrefsMap((prev) => { const next = new Map(prev); next.delete(franchiseId); return next; });
          });
        }
      }
    },
    [followedFranchiseIds, franchisePrefsMap, user]
  );

  const isFollowingGame = useCallback(
    (gameId: string) => followedGameIds.has(gameId),
    [followedGameIds]
  );

  const isFollowingFranchise = useCallback(
    (franchiseId: string) => followedFranchiseIds.has(franchiseId),
    [followedFranchiseIds]
  );

  const getGamePrefs = useCallback(
    (gameId: string) => gamePrefsMap.get(gameId) ?? { ...DEFAULT_NOTIFY_PREFS },
    [gamePrefsMap]
  );

  const getFranchisePrefs = useCallback(
    (franchiseId: string) => franchisePrefsMap.get(franchiseId) ?? { ...DEFAULT_NOTIFY_PREFS },
    [franchisePrefsMap]
  );

  const updateGamePrefs = useCallback(
    (gameId: string, prefs: Partial<NotifyPrefs>) => {
      setGamePrefsMap((prev) => {
        const next = new Map(prev);
        const current = prev.get(gameId) ?? { ...DEFAULT_NOTIFY_PREFS };
        next.set(gameId, { ...current, ...prefs });
        return next;
      });
      if (user) {
        const supabase = createClient();
        dbUpdateGamePrefs(supabase, user.id, gameId, prefs).catch((err) =>
          console.error("Failed to update game prefs:", err)
        );
      }
    },
    [user]
  );

  const updateFranchisePrefs = useCallback(
    (franchiseId: string, prefs: Partial<NotifyPrefs>) => {
      setFranchisePrefsMap((prev) => {
        const next = new Map(prev);
        const current = prev.get(franchiseId) ?? { ...DEFAULT_NOTIFY_PREFS };
        next.set(franchiseId, { ...current, ...prefs });
        return next;
      });
      if (user) {
        const supabase = createClient();
        dbUpdateFranchisePrefs(supabase, user.id, franchiseId, prefs).catch((err) =>
          console.error("Failed to update franchise prefs:", err)
        );
      }
    },
    [user]
  );

  const value = useMemo(() => ({
    followedGameIds,
    followedFranchiseIds,
    toggleFollowGame,
    toggleFollowFranchise,
    isFollowingGame,
    isFollowingFranchise,
    getGamePrefs,
    getFranchisePrefs,
    updateGamePrefs,
    updateFranchisePrefs,
    loading,
  }), [
    followedGameIds, followedFranchiseIds, toggleFollowGame, toggleFollowFranchise,
    isFollowingGame, isFollowingFranchise, getGamePrefs, getFranchisePrefs,
    updateGamePrefs, updateFranchisePrefs, loading,
  ]);

  return (
    <FollowContext.Provider value={value}>
      {children}
    </FollowContext.Provider>
  );
}

export function useFollow() {
  const ctx = useContext(FollowContext);
  if (!ctx) throw new Error("useFollow must be used within FollowProvider");
  return ctx;
}
