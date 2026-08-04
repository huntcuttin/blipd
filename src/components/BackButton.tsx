"use client";

import Link from "next/link";

type BackButtonVariant = "overlay" | "card";

interface BackButtonProps {
  /** Real navigation target. Omit and pass onClick instead for an in-page action (e.g. stepping back within a multi-step flow). */
  href?: string;
  onClick?: () => void;
  label: string;
  /** "overlay" sits on translucent hero art (game/franchise headers); "card" sits on a flat background (login, onboarding). */
  variant?: BackButtonVariant;
  className?: string;
}

const VARIANT_CLASSES: Record<BackButtonVariant, string> = {
  overlay: "bg-[#0a0a0a]/60 backdrop-blur-sm",
  card: "bg-[#111111] border border-[#222222] hover:border-[#333333] transition-all",
};

// Anchored past the status bar/notch via env(safe-area-inset-top) rather
// than a flat top offset, so the button never sits under OS chrome on
// notched phones regardless of which page renders it.
const POSITION_STYLE = { top: "calc(8px + env(safe-area-inset-top, 0px))" };

export default function BackButton({ href, onClick, label, variant = "card", className = "" }: BackButtonProps) {
  const classes = `absolute left-2 w-11 h-11 flex items-center justify-center rounded-full text-white ${VARIANT_CLASSES[variant]} ${className}`;

  const icon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  );

  if (href) {
    return (
      <Link href={href} aria-label={label} className={classes} style={POSITION_STYLE}>
        {icon}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-label={label} className={classes} style={POSITION_STYLE}>
      {icon}
    </button>
  );
}
