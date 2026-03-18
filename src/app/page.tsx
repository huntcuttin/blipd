import Link from "next/link";
import Logo from "@/components/Logo";
import { createAdminClient } from "@/lib/nintendo/admin-client";

export const revalidate = 300; // Revalidate every 5 minutes

async function getStats() {
  try {
    const supabase = createAdminClient();
    const [gamesRes, saleRes] = await Promise.all([
      supabase.from("games").select("id", { count: "exact", head: true }),
      supabase.from("games").select("id", { count: "exact", head: true }).eq("is_on_sale", true),
    ]);
    return {
      totalGames: gamesRes.count ?? 0,
      onSale: saleRes.count ?? 0,
    };
  } catch {
    return { totalGames: 2785, onSale: 205 };
  }
}

export default async function LandingPage() {
  const stats = await getStats();

  return (
    <div className="flex flex-col items-center justify-center min-h-[100svh] px-6 py-12 text-center">
      {/* Logo */}
      <div className="mb-8">
        <Logo size={56} showText={false} />
      </div>

      {/* Headline */}
      <h1 className="font-syne text-3xl font-bold text-white leading-tight mb-3">
        Never miss a<br />
        <span className="text-[#00ff88]">Nintendo deal.</span>
      </h1>

      <p className="text-[#888888] text-base max-w-[300px] mb-8 leading-relaxed">
        Track eShop prices, set your target price, and get alerted the moment games drop.
      </p>

      {/* Live stats */}
      <div className="flex gap-6 mb-10">
        <div>
          <p className="font-mono text-2xl font-bold text-white">{stats.totalGames.toLocaleString()}</p>
          <p className="text-[#666666] text-xs mt-0.5">games tracked</p>
        </div>
        <div className="w-px bg-[#222222]" />
        <div>
          <p className="font-mono text-2xl font-bold text-[#00ff88]">{stats.onSale.toLocaleString()}</p>
          <p className="text-[#666666] text-xs mt-0.5">on sale now</p>
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-3 w-full max-w-[280px]">
        <Link
          href="/login"
          className="w-full py-3.5 rounded-xl bg-[#00ff88] text-[#0a0a0a] font-semibold text-sm text-center hover:shadow-[0_0_20px_#00ff8855] transition-all active:scale-[0.98]"
        >
          Get started — it&apos;s free
        </Link>
        <Link
          href="/home"
          className="w-full py-3.5 rounded-xl bg-[#111111] border border-[#222222] text-[#888888] font-medium text-sm text-center hover:border-[#333333] hover:text-white transition-all"
        >
          Browse deals
        </Link>
      </div>

      {/* Trust signals */}
      <div className="mt-10 space-y-2">
        <div className="flex items-center justify-center gap-4 text-[#555555] text-xs">
          <span>Free forever</span>
          <span className="text-[#333333]">·</span>
          <span>No ads</span>
          <span className="text-[#333333]">·</span>
          <span>No paywall</span>
        </div>
        <p className="text-[#333333] text-[11px]">
          Price alerts for Nintendo Switch &amp; Switch 2
        </p>
      </div>
    </div>
  );
}
