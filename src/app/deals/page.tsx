import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/nintendo/admin-client";
import { formatPrice } from "@/lib/format";

export const revalidate = 300; // 5 min ISR

export const metadata: Metadata = {
  title: "Nintendo Switch Deals Today | Blippd",
  description:
    "Every Nintendo Switch game on sale right now. See the biggest discounts, all-time low prices, and deals ending soon on the eShop.",
  openGraph: {
    title: "Nintendo Switch Deals Today | Blippd",
    description:
      "Every Nintendo Switch game on sale right now. Biggest discounts, all-time lows, and deals ending soon.",
    type: "website",
    siteName: "Blippd",
  },
};

interface DealRow {
  slug: string;
  title: string;
  publisher: string;
  cover_art: string;
  current_price: number;
  original_price: number;
  discount: number;
  is_all_time_low: boolean;
  sale_end_date: string | null;
}

async function getDeals(): Promise<DealRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("games")
    .select("slug, title, publisher, cover_art, current_price, original_price, discount, is_all_time_low, sale_end_date")
    .eq("is_on_sale", true)
    .eq("is_suppressed", false)
    .order("discount", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

function getSaleEndLabel(dateStr: string): string | null {
  const target = new Date(dateStr);
  const now = new Date();
  const days = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Ends today";
  if (days === 1) return "Ends tomorrow";
  if (days <= 14) return `Ends in ${days} days`;
  return null;
}

export default async function DealsPage() {
  const deals = await getDeals();
  const allTimeLows = deals.filter((d) => d.is_all_time_low);
  const totalSavings = deals.reduce(
    (sum, d) => sum + Math.max(0, Number(d.original_price) - Number(d.current_price)),
    0
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Nintendo Switch Deals Today",
    numberOfItems: deals.length,
    itemListElement: deals.slice(0, 50).map((d, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: d.title,
        image: d.cover_art || undefined,
        offers: {
          "@type": "Offer",
          price: d.current_price,
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          url: `https://www.blippd.app/game/${d.slug}`,
        },
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="px-4 py-6 pb-8">
        <h1 className="text-2xl font-bold text-white mb-1">
          Nintendo Switch Deals
        </h1>
        <p className="text-[#666666] text-sm mb-6">
          {deals.length} games on sale &middot; Up to ${totalSavings.toFixed(0)} in savings
        </p>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="bg-[#111111] rounded-xl border border-[#222222] p-3 text-center">
            <p className="text-xl font-bold text-white">{deals.length}</p>
            <p className="text-[#555555] text-[10px] mt-0.5">On Sale</p>
          </div>
          <div className="bg-[#111111] rounded-xl border border-[#FFD700]/20 p-3 text-center">
            <p className="text-xl font-bold text-[#FFD700]">{allTimeLows.length}</p>
            <p className="text-[#555555] text-[10px] mt-0.5">All-Time Lows</p>
          </div>
          <div className="bg-[#111111] rounded-xl border border-[#00ff88]/20 p-3 text-center">
            <p className="text-xl font-bold text-[#00ff88]">
              {deals.length > 0 ? Math.max(...deals.map((d) => d.discount)) : 0}%
            </p>
            <p className="text-[#555555] text-[10px] mt-0.5">Max Discount</p>
          </div>
        </div>

        {/* All-time lows section */}
        {allTimeLows.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-bold text-[#FFD700] tracking-wider mb-3">
              ALL-TIME LOW PRICES
            </h2>
            <div className="space-y-2">
              {allTimeLows.slice(0, 10).map((d) => (
                <DealCard key={d.slug} deal={d} />
              ))}
            </div>
          </section>
        )}

        {/* All deals */}
        <section>
          <h2 className="text-xs font-bold text-[#666666] tracking-wider mb-3">
            ALL DEALS ({deals.length})
          </h2>
          <div className="space-y-2">
            {deals.map((d) => (
              <DealCard key={d.slug} deal={d} />
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="mt-8 text-center">
          <p className="text-[#555555] text-sm mb-3">
            Get notified when prices drop
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-[#00ff88] text-[#0a0a0a] rounded-xl text-sm font-bold"
          >
            Sign up free
          </Link>
        </div>
      </div>
    </>
  );
}

function DealCard({ deal }: { deal: DealRow }) {
  const saleLabel = deal.sale_end_date ? getSaleEndLabel(deal.sale_end_date) : null;
  return (
    <Link href={`/game/${deal.slug}`} className="block">
      <div className="flex gap-3 p-3 bg-[#111111] rounded-xl border border-[#222222] hover:border-[#333333] transition-colors">
        {deal.cover_art && (
          <img
            src={deal.cover_art}
            alt=""
            className="w-[80px] aspect-[16/10] rounded-lg bg-[#1a1a1a] object-cover shrink-0"
            loading="lazy"
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-sm leading-snug line-clamp-1">
            {deal.title}
          </h3>
          <p className="text-[#555555] text-[11px] mt-0.5 truncate">{deal.publisher}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="font-mono text-[#00ff88] font-bold text-sm">
              {formatPrice(Number(deal.current_price))}
            </span>
            <span className="font-mono text-[#555555] text-[11px] line-through">
              {formatPrice(Number(deal.original_price))}
            </span>
            <span className="font-mono px-1.5 py-0.5 rounded-md bg-[#00cc6e]/20 text-[#00ff88] text-[11px] font-bold">
              -{deal.discount}%
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            {deal.is_all_time_low && (
              <span className="px-2 py-0.5 rounded-md bg-[#FFD700]/15 text-[#FFD700] text-[10px] font-bold">
                ALL TIME LOW
              </span>
            )}
            {saleLabel && (
              <span className="text-[#ff6874] text-[10px] font-medium">{saleLabel}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
