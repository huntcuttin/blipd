interface RadarSpinnerProps {
  /** Pixel size of the whole mark (ring + dot). Matches the old ring spinner's w/h. */
  size?: number;
  className?: string;
}

// Branded stand-in for the generic green ring spinner (border-2
// border-[#00ff88] border-t-transparent rounded-full animate-spin) used
// across loading states. Echoes RadarIcon's own ring + center dot instead
// of a bare arc, so "loading" reads as "watching" everywhere it appears.
// All animation lives in globals.css (.radar-spinner*) — this file is just
// markup, no inline keyframes, so every instance shares one definition.
export default function RadarSpinner({ size = 32, className = "" }: RadarSpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`radar-spinner ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="radar-spinner__ring" aria-hidden="true" />
      <span className="radar-spinner__sweep" aria-hidden="true" />
      <span className="radar-spinner__dot" aria-hidden="true" />
    </div>
  );
}
