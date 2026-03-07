"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import {
  getUserGameFollows,
  getUserFranchiseFollows,
  followGame as dbFollowGame,
  unfollowGame as dbUnfollowGame,
  followFranchise as dbFollowFranchise,
  unfollowFranchise as dbUnfollowFranchise,
  updateFollowPreferences as dbUpdatePrefs,
} from "@/lib/queries";

export interface NotifyPrefs {
  notifyRelease: boolean;
  notifyPrice: boolean;
}

interface FollowContextType {
  followedGameIds: Set<string>;
  followedFranchiseIds: Set<string>;
  toggleFollowGame: (gameId: string) => { blocked?: "limit_reached" } | void;
  toggleFollowFranchise: (franchiseId: string) => void;
  isFollowingGame: (gameId: string) => boolean;
  isFollowingFranchise: (franchiseId: string) => boolean;
  getNotifyPrefs: (gameId: string) => NotifyPrefs;
  updateNotifyPrefs: (gameId: string, prefs: Partial<NotifyPrefs>) => void;
  followCount: number;
  loading: boolean;
}

const FollowContext = createContext<FollowContextType | null>(null);

export function FollowProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [followedGameIds, setFollowedGameIds] = useState<Set<string>>(new Set());
  const [followedFranchiseIds, setFollowedFranchiseIds] = useState<Set<string>>(new Set());
  const [notifyPrefsMap, setNotifyPrefsMap] = useState<Map<string, NotifyPrefs>>(new Map());
  const [loading, setLoading] = useState(false);

  // Load follows from Supabase when user logs in
  useEffect(() => {
    if (!user) {
      setFollowedGameIds(new Set());
      setFollowedFranchiseIds(new Set());
      setNotifyPrefsMap(new Map());
      return;
    }

    const supabase = createClient();
    setLoading(true);
    Promise.all([
      getUserGameFollows(supabase, user.id),
      getUserFranchiseFollows(supabase, user.id),
    ])
      .then(([gameFollows, franchiseIds]) => {
        setFollowedGameIds(new Set(gameFollows.map((f) => f.gameId)));
        const prefsMap = new Map<string, NotifyPrefs>();
        for (const f of gameFollows) {
          prefsMap.set(f.gameId, { notifyRelease: f.notifyRelease, notifyPrice: f.notifyPrice });
        }
        setNotifyPrefsMap(prefsMap);
        setFollowedFranchiseIds(new Set(franchiseIds));
      })
      .finally(() => setLoading(false));
  }, [user]);

  const followCount = followedGameIds.size;

  const FREE_FOLLOW_LIMIT = 5;

  const toggleFollowGame = useCallback(
    (gameId: string): { blocked?: "limit_reached" } | void => {
      const supabase = createClient();
      if (followedGameIds.has(gameId)) {
        setFollowedGameIds((prev) => {
          const next = new Set(prev);
          next.delete(gameId);
          return next;
        });
        if (user) dbUnfollowGame(supabase, user.id, gameId);
        return;
      }
      // Enforce free tier follow cap
      if (followedGameIds.size >= FREE_FOLLOW_LIMIT) {
        return { blocked: "limit_reached" };
      }
      setFollowedGameIds((prev) => new Set(prev).add(gameId));
      setNotifyPrefsMap((prev) => {
        const next = new Map(prev);
        next.set(gameId, { notifyRelease: true, notifyPrice: true });
        return next;
      });
      if (user) dbFollowGame(supabase, user.id, gameId);
    },
    [followedGameIds, user]
  );

  const toggleFollowFranchise = useCallback(
    (franchiseId: string) => {
      const supabase = createClient();
      if (followedFranchiseIds.has(franchiseId)) {
        setFollowedFranchiseIds((prev) => {
          const next = new Set(prev);
          next.delete(franchiseId);
          return next;
        });
        if (user) dbUnfollowFranchise(supabase, user.id, franchiseId);
      } else {
        setFollowedFranchiseIds((prev) => new Set(prev).add(franchiseId));
        if (user) dbFollowFranchise(supabase, user.id, franchiseId);
      }
    },
    [followedFranchiseIds, user]
  );

  const isFollowingGame = useCallback(
    (gameId: string) => followedGameIds.has(gameId),
    [followedGameIds]
  );

  const isFollowingFranchise = useCallback(
    (franchiseId: string) => followedFranchiseIds.has(franchiseId),
    [followedFranchiseIds]
  );

  const getNotifyPrefs = useCallback(
    (gameId: string): NotifyPrefs =>
      notifyPrefsMap.get(gameId) ?? { notifyRelease: true, notifyPrice: true },
    [notifyPrefsMap]
  );

  const updateNotifyPrefs = useCallback(
    (gameId: string, prefs: Partial<NotifyPrefs>) => {
      setNotifyPrefsMap((prev) => {
        const next = new Map(prev);
        const current = prev.get(gameId) ?? { notifyRelease: true, notifyPrice: true };
        next.set(gameId, { ...current, ...prefs });
        return next;
      });
      if (user) {
        const supabase = createClient();
        dbUpdatePrefs(supabase, user.id, gameId, prefs);
      }
    },
    [user]
  );

  return (
    <FollowContext.Provider
      value={{
        followedGameIds,
        followedFranchiseIds,
        toggleFollowGame,
        toggleFollowFranchise,
        isFollowingGame,
        isFollowingFranchise,
        getNotifyPrefs,
        updateNotifyPrefs,
        followCount,
        loading,
      }}
    >
      {children}
    </FollowContext.Provider>
  );
}

export function useFollow() {
  const ctx = useContext(FollowContext);
  if (!ctx) throw new Error("useFollow must be used within FollowProvider");
  return ctx;
}
