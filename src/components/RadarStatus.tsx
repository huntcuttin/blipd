"use client";

import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { getLastPriceCheckTimestamp } from "@/lib/queries";
import { formatFreshness } from "@/lib/format";

/**
 * Ambient "the pipeline is alive" signal under Home's header -- the Bible's
 * own mandate ("users should never have to wonder if their alerts are
 * working") made visible on the one screen a returning user actually looks
 * at first. Freshness is pipeline-global (getLastPriceCheckTimestamp reads
 * max(last_price_check) across the whole catalog), never per-game -- a
 * per-game staleness readout would manufacture doubt the pipeline doesn't
 * actually have.
 */
export default function RadarStatus({ watchingCount }: { watchingCount: number }) {
  const { data: lastChecked } = useSupabaseQuery(getLastPriceCheckTimestamp);

  return (
    <div className="flex items-center gap-2 pb-3">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="home-radar-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff88]" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00ff88]" />
      </span>
      <p className="text-[11px] text-[#666666] font-medium">
        Watching {watchingCount} game{watchingCount === 1 ? "" : "s"} · {formatFreshness(lastChecked)}
      </p>
    </div>
  );
}
