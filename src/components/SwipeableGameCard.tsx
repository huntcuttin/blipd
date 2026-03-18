"use client";

import { useRef, useState } from "react";
import GameCard from "./GameCard";
import { useFollow } from "@/lib/FollowContext";
import type { Game } from "@/lib/types";

const THRESHOLD = 72;
const MAX_DRAG = 100;

export default function SwipeableGameCard({ game }: { game: Game }) {
  const { toggleOwnGame, isOwningGame } = useFollow();
  const isOwned = isOwningGame(game.id);

  const cardRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const currentOffset = useRef(0);
  const dragging = useRef(false);
  const [triggered, setTriggered] = useState(false);

  // Already owned — plain card, no swipe
  if (isOwned) return <GameCard game={game} />;

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    dragging.current = false;
    currentOffset.current = 0;
    if (cardRef.current) cardRef.current.style.transition = "none";
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const dx = startX.current - e.touches[0].clientX;
    const dy = Math.abs(startY.current - e.touches[0].clientY);
    // If more vertical than horizontal, let the page scroll
    if (!dragging.current && dy > Math.abs(dx) * 0.8) return;
    dragging.current = true;
    const offset = dx > 0 ? -Math.min(dx, MAX_DRAG) : 0;
    currentOffset.current = offset;
    if (cardRef.current) {
      cardRef.current.style.transform = `translateX(${offset}px)`;
    }
  };

  const onTouchEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (cardRef.current) {
      cardRef.current.style.transition = "transform 0.25s ease";
      cardRef.current.style.transform = "translateX(0)";
    }
    if (currentOffset.current <= -THRESHOLD) {
      toggleOwnGame(game.id);
      setTriggered(true);
      setTimeout(() => setTriggered(false), 1200);
    }
    currentOffset.current = 0;
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Action zone revealed on left-swipe */}
      <div
        className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-0.5 bg-[#1a0f3a]"
        style={{ width: MAX_DRAG }}
        aria-hidden="true"
      >
        {triggered ? (
          <span className="text-[#a78bfa] text-[11px] font-bold">Added!</span>
        ) : (
          <>
            <span className="text-[#a78bfa] text-[10px] font-bold tracking-wide">LIBRARY</span>
          </>
        )}
      </div>

      {/* Card slides left to reveal action */}
      <div
        ref={cardRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <GameCard game={game} />
      </div>
    </div>
  );
}
