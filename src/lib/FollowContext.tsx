"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

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
}

const FollowContext = createContext<FollowContextType | null>(null);

export function FollowProvider({ children }: { children: ReactNode }) {
  const [followedGameIds, setFollowedGameIds] = useState<Set<string>>(new Set());
  const [followedFranchiseIds, setFollowedFranchiseIds] = useState<Set<string>>(new Set());

  const followCount = followedGameIds.size;
  const isAtLimit = followCount >= MAX_FREE_FOLLOWS;

  const toggleFollowGame = useCallback(
    (gameId: string): boolean => {
      if (followedGameIds.has(gameId)) {
        setFollowedGameIds((prev) => {
          const next = new Set(prev);
          next.delete(gameId);
          return next;
        });
        return true;
      }
      if (followedGameIds.size >= MAX_FREE_FOLLOWS) return false;
      setFollowedGameIds((prev) => new Set(prev).add(gameId));
      return true;
    },
    [followedGameIds]
  );

  const toggleFollowFranchise = useCallback((franchiseId: string) => {
    setFollowedFranchiseIds((prev) => {
      const next = new Set(prev);
      if (next.has(franchiseId)) {
        next.delete(franchiseId);
      } else {
        next.add(franchiseId);
      }
      return next;
    });
  }, []);

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
