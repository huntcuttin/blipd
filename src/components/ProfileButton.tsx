"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const HIDE_ON = ["/login", "/onboarding", "/profile", "/home"];

export default function ProfileButton() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (HIDE_ON.includes(pathname) || !user) return null;

  const initial = user.email?.[0]?.toUpperCase();

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="max-w-[430px] mx-auto flex justify-end p-3">
        <Link
          href="/profile"
          className="pointer-events-auto w-9 h-9 rounded-full bg-[#111111] border border-[#222222] flex items-center justify-center hover:border-[#333333] transition-colors"
          aria-label="Profile"
        >
          <span className="text-white text-[13px] font-bold">{initial}</span>
        </Link>
      </div>
    </div>
  );
}
