"use client";

import { useState, useRef, useEffect } from "react";
import { useFollow } from "@/lib/FollowContext";
import { formatPrice } from "@/lib/format";

export default function TargetPriceInput({
  gameId,
  currentPrice,
  originalPrice,
}: {
  gameId: string;
  currentPrice: number;
  originalPrice: number;
}) {
  const { getTargetPrice, setTargetPrice, isFollowingGame } = useFollow();
  const targetPrice = getTargetPrice(gameId);
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  if (!isFollowingGame(gameId)) return null;

  const handleSave = () => {
    const val = parseFloat(inputValue);
    if (!isNaN(val) && val > 0 && val < originalPrice) {
      setTargetPrice(gameId, Math.round(val * 100) / 100);
      if (navigator.vibrate) navigator.vibrate(10);
    }
    setEditing(false);
  };

  const handleClear = () => {
    setTargetPrice(gameId, null);
    setEditing(false);
  };

  const handleStartEdit = () => {
    setInputValue(targetPrice ? targetPrice.toFixed(2) : "");
    setEditing(true);
  };

  // Progress toward target
  const progress = targetPrice && currentPrice > targetPrice
    ? Math.min(((originalPrice - currentPrice) / (originalPrice - targetPrice)) * 100, 100)
    : targetPrice && currentPrice <= targetPrice
    ? 100
    : 0;

  const hitTarget = targetPrice !== null && currentPrice <= targetPrice;

  return (
    <div className="py-3 border-b border-[#222222]">
      <h2 className="text-xs font-bold text-[#666666] tracking-wider mb-2">TARGET PRICE</h2>

      {editing ? (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666] text-sm">$</span>
            <input
              ref={inputRef}
              type="number"
              step="0.01"
              min="0.01"
              max={originalPrice}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setEditing(false);
              }}
              placeholder={`Under ${formatPrice(originalPrice)}`}
              className="w-full pl-7 pr-3 py-2.5 rounded-lg bg-[#111111] border border-[#333333] text-white text-sm font-mono focus:border-[#00ff88] focus:outline-none transition-colors"
            />
          </div>
          <button
            onClick={handleSave}
            className="px-4 py-2.5 rounded-lg bg-[#00ff88] text-[#0a0a0a] text-xs font-bold"
          >
            Set
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-3 py-2.5 rounded-lg bg-[#1a1a1a] text-[#666666] text-xs font-medium"
          >
            Cancel
          </button>
        </div>
      ) : targetPrice !== null ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {hitTarget ? (
                <span className="text-[#00ff88] text-sm font-bold">
                  Target hit! {formatPrice(currentPrice)} ≤ {formatPrice(targetPrice)}
                </span>
              ) : (
                <span className="text-white text-sm">
                  Alert me at <span className="font-mono font-bold text-[#00ff88]">{formatPrice(targetPrice)}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleStartEdit}
                className="text-[#666666] text-xs hover:text-white transition-colors"
              >
                Edit
              </button>
              <span className="text-[#333333]">·</span>
              <button
                onClick={handleClear}
                className="text-[#666666] text-xs hover:text-[#ff6874] transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
          {!hitTarget && (
            <div className="relative h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-[#00ff88] rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          {!hitTarget && progress > 0 && (
            <p className="text-[#555555] text-[10px] mt-1">
              {Math.round(progress)}% of the way there
            </p>
          )}
        </div>
      ) : (
        <button
          onClick={handleStartEdit}
          className="flex items-center gap-2 w-full py-2.5 px-3 rounded-lg bg-[#111111] border border-[#222222] hover:border-[#333333] transition-colors text-left"
        >
          <svg className="w-4 h-4 text-[#555555]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <span className="text-[#666666] text-sm">Set a target price — we&apos;ll alert you</span>
        </button>
      )}
    </div>
  );
}
