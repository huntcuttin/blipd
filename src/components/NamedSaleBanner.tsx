"use client";

import Link from "next/link";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getActiveNamedSaleEvents } from "@/lib/queries";

export default function NamedSaleBanner() {
  const { data: saleEvents } = useSupabaseQuery(getActiveNamedSaleEvents);

  if (!saleEvents || saleEvents.length === 0) return null;

  return (
    <div className="space-y-2 pb-3">
      {saleEvents.map((event) => (
        <Link
          key={event.id}
          href={`/sales?event=${event.id}`}
          className="block rounded-xl border border-[#ffaa00]/30 bg-gradient-to-r from-[#ffaa00]/15 to-[#ff8800]/10 p-4 hover:border-[#ffaa00]/60 transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-[#ffaa00]/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-[#ffaa00]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white leading-tight truncate">{event.name}</h3>
                <p className="text-[11px] text-[#ffaa00] mt-0.5 font-medium">
                  {event.gamesCount} games on sale · Browse deals →
                </p>
              </div>
            </div>
            <svg className="w-4 h-4 text-[#ffaa00]/50 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </Link>
      ))}
    </div>
  );
}
