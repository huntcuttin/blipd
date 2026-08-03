"use client";

export default function UndoToast({
  message,
  onUndo,
}: {
  message: string;
  onUndo: () => void;
}) {
  return (
    <div className="fixed left-4 right-4 bottom-24 z-50 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#333333] shadow-lg max-w-[430px] mx-auto">
      <span className="text-sm text-white">{message}</span>
      <button
        onClick={onUndo}
        className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold text-[#00ff88] hover:bg-[#00ff88]/10 transition-colors"
      >
        Undo
      </button>
    </div>
  );
}
