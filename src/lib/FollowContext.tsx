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
} from "@/lib/queries";

const MAX_FREE_FOLLOWS = 5;

interface FollowContextType {
  followedGameIds: Set<string>;
  followedFranchiseIds: Set<string>;
  toggleFollowGame: (gameId: string) => boolean;
  toggleFollowFranchise: (franchiseId: string) => void;
  isFollowingGame: (gameId: string) => boolean;
  isFollowingFranchise: (franchiseId: string) => boolean;
  isAtLimit: boolean;
  followCount: number;
  loading: boolean;
}

const FollowContext = createContext<FollowContextType | null>(null);

export function FollowProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [followedGameIds, setFollowedGameIds] = useState<Set<string>>(new Set());
  const [followedFranchiseIds, setFollowedFranchiseIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Load follows from Supabase when user logs in
  useEffect(() => {
    if (!user) {
      setFollowedGameIds(new Set());
      setFollowedFranchiseIds(new Set());
      return;
    }

    const supabase = createClient();
    setLoading(true);
    Promise.all([
      getUserGameFollows(supabase, user.id),
      getUserFranchiseFollows(supabase, user.id),
    ])
      .then(([gameIds, franchiseIds]) => {
        setFollowedGameIds(new Set(gameIds));
        setFollowedFranchiseIds(new Set(franchiseIds));
      })
      .finally(() => setLoading(false));
  }, [user]);

  const followCount = followedGameIds.size;
  const isAtLimit = followCount >= MAX_FREE_FOLLOWS;

  const toggleFollowGame = useCallback(
    (gameId: string): boolean => {
      const supabase = createClient();
      if (followedGameIds.has(gameId)) {
        setFollowedGameIds((prev) => {
          const next = new Set(prev);
          next.delete(gameId);
          return next;
        });
        if (user) dbUnfollowGame(supabase, user.id, gameId);
        return true;
      }
      if (followedGameIds.size >= MAX_FREE_FOLLOWS) return false;
      setFollowedGameIds((prev) => new Set(prev).add(gameId));
      if (user) dbFollowGame(supabase, user.id, gameId);
      return true;
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

  return (
    <FollowContext.Provider
      value={{
        followedGameIds,
        followedFranchiseIds,
        toggleFollowGame,
        toggleFollowFranchise,
        isFollowingGame,
        isFollowingFranchise,
        isAtLimit,
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
