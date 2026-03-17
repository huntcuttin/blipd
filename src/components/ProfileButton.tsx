"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const HIDE_ON = ["/login", "/onboarding", "/profile"];

export default function ProfileButton() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (HIDE_ON.includes(pathname)) return null;

  const initial = user?.email?.[0]?.toUpperCase();

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="max-w-[430px] mx-auto flex justify-end p-3">
        <Link
          href="/profile"
          className="pointer-events-auto w-9 h-9 rounded-full bg-[#111111] border border-[#222222] flex items-center justify-center hover:border-[#00ff88]/30 transition-colors"
          aria-label="Profile"
        >
          {initial ? (
            <span className="text-[#00ff88] text-[13px] font-bold">{initial}</span>
          ) : (
            <svg className="w-4 h-4 text-[#444444]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          )}
        </Link>
      </div>
    </div>
  );
}
