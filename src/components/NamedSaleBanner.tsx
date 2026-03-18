"use client";

import Link from "next/link";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getActiveNamedSaleEvents } from "@/lib/queries";

export default function NamedSaleBanner() {
  const { data: saleEvents } = useSupabaseQuery(getActiveNamedSaleEvents);

  if (!saleEvents || saleEvents.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-3">
      {saleEvents.map((event) => (
        <Link
          key={event.id}
          href={`/sales?event=${event.id}`}
          className="flex-shrink-0 flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-[#ffaa00]/30 bg-[#ffaa00]/10 text-left hover:border-[#ffaa00]/60 transition-all"
        >
          <svg className="w-4 h-4 text-[#ffaa00]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
          </svg>
          <div>
            <div className="text-xs font-bold text-white leading-tight">{event.name}</div>
            <div className="text-[10px] text-[#ffaa00]/70 mt-0.5">
              {event.gamesCount} games on sale now
            </div>
          </div>
          <svg className="w-3.5 h-3.5 text-[#ffaa00]/50 ml-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      ))}
    </div>
  );
}
