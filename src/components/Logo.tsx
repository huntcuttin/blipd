export default function Logo({
  size = 32,
  showText = true,
  className = "",
}: {
  size?: number;
  showText?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-[0_0_8px_#00ff88]"
      >
        {/* Outer circle */}
        <circle cx="24" cy="24" r="22" stroke="#00ff88" strokeWidth="2" fill="none" />
        {/* Inner circle */}
        <circle cx="24" cy="24" r="12" stroke="#00ff88" strokeWidth="2" fill="none" />
        {/* Center dot */}
        <circle cx="24" cy="24" r="4" fill="#00ff88" />
        {/* Crosshair lines */}
        <line x1="24" y1="2" x2="24" y2="10" stroke="#00ff88" strokeWidth="2" />
        <line x1="24" y1="38" x2="24" y2="46" stroke="#00ff88" strokeWidth="2" />
        <line x1="2" y1="24" x2="10" y2="24" stroke="#00ff88" strokeWidth="2" />
        <line x1="38" y1="24" x2="46" y2="24" stroke="#00ff88" strokeWidth="2" />
      </svg>
      {showText && (
        <span
          className="font-bold text-white tracking-tight"
          style={{ fontSize: size * 0.65 }}
        >
          blipd
        </span>
      )}
    </div>
  );
}
