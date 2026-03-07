"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getAlerts } from "@/lib/queries";

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { data: alerts } = useSupabaseQuery(
    (sb) => getAlerts(sb, user?.id),
    [user?.id]
  );

  const unreadCount = (alerts ?? []).filter((a) => !a.read).length;

  const tabs = [
    { href: "/home", label: "Home", icon: HomeIcon },
    { href: "/sales", label: "Sales", icon: TagIcon },
    { href: "/alerts", label: "Alerts", icon: BellIcon, badge: unreadCount },
  ];

  // Hide nav on login page
  if (pathname === "/login" || pathname === "/onboarding") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#111111]/95 backdrop-blur-md border-t border-[#222222]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="max-w-[430px] mx-auto flex justify-around items-center h-16">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-col items-center gap-1 px-4 py-2 transition-all ${
                isActive ? "text-[#00ff88]" : "text-[#444444]"
              }`}
            >
              <div className="relative">
                <tab.icon
                  className={`w-6 h-6 ${isActive ? "drop-shadow-[0_0_8px_#00ff88]" : ""}`}
                />
                {typeof tab.badge === "number" && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[#00ff88] text-[#0a0a0a] text-[10px] font-bold px-1">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-medium ${
                  isActive ? "drop-shadow-[0_0_6px_#00ff88]" : ""
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <div className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#00ff88] rounded-full shadow-[0_0_8px_#00ff88]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ── Icons ──────────────────────────────────────────────────────

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function TagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  );
}
