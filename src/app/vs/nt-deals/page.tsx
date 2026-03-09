import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blippd vs NT Deals — Nintendo eShop Price Alerts Compared",
  description:
    "Honest comparison of Blippd and NT Deals for Nintendo Switch price alerts. See how features, pricing, and reliability stack up.",
  openGraph: {
    title: "Blippd vs NT Deals — Nintendo eShop Price Alerts Compared",
    description:
      "Honest comparison of Blippd and NT Deals for Nintendo Switch price alerts.",
    type: "website",
    siteName: "Blippd",
  },
};

interface Feature {
  name: string;
  blippd: string | boolean;
  ntDeals: string | boolean;
  note?: string;
}

const features: Feature[] = [
  { name: "Price drop alerts", blippd: true, ntDeals: true },
  { name: "All-time low alerts", blippd: true, ntDeals: true },
  { name: "Sale started alerts", blippd: true, ntDeals: true },
  { name: "Release day alerts", blippd: true, ntDeals: false },
  { name: "Email notifications", blippd: true, ntDeals: true },
  { name: "Push notifications", blippd: "Coming soon", ntDeals: true },
  { name: "Named sale detection", blippd: "Coming soon", ntDeals: false, note: "Blippd detects named events like Mar10 Day and groups alerts intelligently" },
  { name: "Switch 2 catalog", blippd: true, ntDeals: false, note: "NT Deals Switch 2 support has been broken since launch" },
  { name: "Price history", blippd: "Building", ntDeals: "9 years" },
  { name: "Desired price threshold", blippd: false, ntDeals: "Premium only" },
  { name: "Follow limit (free)", blippd: "Unlimited", ntDeals: "Unlimited" },
  { name: "Ad-free experience", blippd: true, ntDeals: false, note: "NT Deals shows aggressive ads triggered by search" },
  { name: "iOS app", blippd: "Coming soon", ntDeals: true },
  { name: "Android app", blippd: "Coming soon", ntDeals: false, note: "NT Deals promised Android in 2021, never delivered" },
  { name: "Free tier price", blippd: "Free", ntDeals: "Free (with ads)" },
  { name: "Premium price", blippd: "$3/mo", ntDeals: "$4.99/mo" },
  { name: "Support response", blippd: "Active", ntDeals: "No response", note: "Multiple reports of unanswered support emails" },
];

function StatusCell({ value }: { value: string | boolean }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#00ff88]/15">
        <svg className="w-4 h-4 text-[#00ff88]" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#ff6874]/10">
        <svg className="w-4 h-4 text-[#ff6874]" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </span>
    );
  }
  return <span className="text-[#cccccc] text-xs font-medium">{value}</span>;
}

export default function VsNtDealsPage() {
  return (
    <div className="px-4 pb-28 max-w-2xl mx-auto">
      {/* Header */}
      <div className="py-6">
        <h1 className="text-2xl font-bold text-white leading-tight">
          Blippd vs NT Deals
        </h1>
        <p className="text-[#888888] text-sm mt-2 leading-relaxed">
          An honest comparison. We built Blippd because we wanted something better
          for tracking Nintendo eShop prices — here&apos;s how the two stack up.
        </p>
      </div>

      {/* Comparison table */}
      <div className="rounded-xl border border-[#222222] overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_80px_80px] bg-[#111111] border-b border-[#222222]">
          <div className="px-4 py-3 text-[#666666] text-xs font-medium">Feature</div>
          <div className="px-2 py-3 text-center">
            <span className="text-[#00ff88] text-xs font-bold">Blippd</span>
          </div>
          <div className="px-2 py-3 text-center">
            <span className="text-[#888888] text-xs font-bold">NT Deals</span>
          </div>
        </div>

        {/* Rows */}
        {features.map((f, i) => (
          <div key={f.name}>
            <div className={`grid grid-cols-[1fr_80px_80px] ${i % 2 === 0 ? "bg-[#0a0a0a]" : "bg-[#0e0e0e]"}`}>
              <div className="px-4 py-3">
                <span className="text-white text-sm">{f.name}</span>
                {f.note && (
                  <p className="text-[#666666] text-[11px] mt-0.5 leading-snug">{f.note}</p>
                )}
              </div>
              <div className="px-2 py-3 flex items-center justify-center">
                <StatusCell value={f.blippd} />
              </div>
              <div className="px-2 py-3 flex items-center justify-center">
                <StatusCell value={f.ntDeals} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom section */}
      <div className="mt-8 space-y-6">
        <div className="bg-[#111111] rounded-xl border border-[#222222] p-5">
          <h2 className="text-base font-bold text-white mb-2">Where NT Deals wins</h2>
          <p className="text-[#888888] text-sm leading-relaxed">
            NT Deals has nearly a decade of price history data and working push notifications on iOS.
            If historical price depth is your top priority, they have more data today.
            We&apos;re building our own history and will get there — but we won&apos;t pretend we&apos;re there yet.
          </p>
        </div>

        <div className="bg-[#111111] rounded-xl border border-[#222222] p-5">
          <h2 className="text-base font-bold text-white mb-2">Where Blippd wins</h2>
          <ul className="text-[#888888] text-sm leading-relaxed space-y-2">
            <li>
              <span className="text-white font-medium">Switch 2 support.</span>{" "}
              NT Deals has had broken Switch 2 catalog support since the console launched.
              Blippd tracks Switch 2 games from day one.
            </li>
            <li>
              <span className="text-white font-medium">No ads, ever.</span>{" "}
              NT Deals shows ads triggered by search — you have to pay to escape them.
              Blippd is ad-free for everyone.
            </li>
            <li>
              <span className="text-white font-medium">Smart sale alerts.</span>{" "}
              When a named sale like Mar10 Day drops, Blippd sends one grouped notification instead
              of spamming you with dozens of individual alerts.
            </li>
            <li>
              <span className="text-white font-medium">Active development.</span>{" "}
              Blippd ships updates weekly. NT Deals hasn&apos;t shipped meaningful updates in years.
            </li>
          </ul>
        </div>

        <div className="text-center py-4">
          <p className="text-[#666666] text-xs">
            Last updated March 2026. We keep this page honest — if something changes, we update it.
          </p>
        </div>
      </div>
    </div>
  );
}
