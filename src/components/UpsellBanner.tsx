import Link from "next/link";

export default function UpsellBanner({ variant = "inline" }: { variant?: "inline" | "top" }) {
  if (variant === "top") {
    return (
      <Link href="/login" className="block">
        <div className="px-4 py-3 bg-gradient-to-r from-[#00ff88]/10 to-[#00ff88]/5 border border-[#00ff88]/20 rounded-xl">
          <p className="text-sm font-medium text-[#00ff88]">
            Follow unlimited games with Blipd Pro →
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link href="/login" className="block">
      <div className="px-4 py-4 bg-gradient-to-r from-[#00ff88]/15 via-[#00ff88]/10 to-[#00ff88]/5 rounded-xl border border-[#00ff88]/20">
        <p className="text-sm font-semibold text-white">
          Follow unlimited games with Blipd Pro →
        </p>
        <p className="text-xs text-[#666666] mt-1">
          Unlimited alerts, franchise tracking, and more.
        </p>
      </div>
    </Link>
  );
}
