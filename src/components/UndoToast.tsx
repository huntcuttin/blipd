"use client";

export default function UndoToast({
  message,
  onUndo,
}: {
  message: string;
  onUndo: () => void;
}) {
  return (
    // White pill on the dark app -- the Spotify confirmation-toast pattern
    // (founder reference 2026-08-04). Maximum contrast makes the ephemeral
    // message read instantly without needing an icon or color coding.
    <div className="animate-toast-in fixed left-4 right-4 bottom-24 z-50 flex items-center justify-between gap-3 px-5 py-3.5 rounded-2xl bg-white shadow-[0_8px_32px_rgba(0,0,0,0.5)] max-w-[430px] mx-auto">
      <span className="text-sm font-medium text-[#0a0a0a]">{message}</span>
      <button
        onClick={onUndo}
        className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold text-[#0a0a0a] bg-black/5 hover:bg-black/10 active:scale-95 transition-all"
      >
        Undo
      </button>
    </div>
  );
}
