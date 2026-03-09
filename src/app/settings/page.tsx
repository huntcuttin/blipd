"use client";

import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";

export default function SettingsPage() {
  const { user, signOut } = useAuth();

  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

      {user ? (
        <div className="space-y-4">
          {/* Account section */}
          <div className="bg-[#111111] rounded-xl border border-[#222222] p-4">
            <h2 className="text-[10px] font-bold text-[#666666] tracking-wider mb-3">
              ACCOUNT
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">Email</p>
                <p className="text-[#666666] text-xs mt-0.5">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={signOut}
            className="w-full p-4 bg-[#111111] rounded-xl border border-[#222222] text-left text-[#ff6874] text-sm font-medium hover:border-[#ff6874]/30 transition-all"
          >
            Sign out
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center py-16 px-4">
          <p className="text-[#666666] text-sm mb-4">Sign in to manage your settings</p>
          <Link
            href="/login"
            className="px-6 py-3 rounded-xl bg-[#00ff88] text-[#0a0a0a] font-semibold text-sm hover:shadow-[0_0_16px_#00ff8855] transition-all"
          >
            Sign in
          </Link>
        </div>
      )}
    </div>
  );
}
