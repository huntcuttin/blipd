import { NextResponse } from "next/server";
import { dispatchRecentAlerts } from "@/lib/notifications/dispatch";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // A 15-min lookback silently drops an alert forever if this cron is
    // ever down/erroring for longer than that (no schema change available
    // right now to track per-alert dispatch completion directly -- see
    // CLAUDE.md's audit Phase 1 #11 note). 3 hours is a generous safety
    // net against a real outage while staying cheap to rescan even on a
    // busy sale day; dispatchRecentAlerts' existing alreadySentPairs check
    // makes re-fetching already-delivered alerts safe either way.
    const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const dispatched = await dispatchRecentAlerts(since);
    return NextResponse.json({ ok: true, dispatched });
  } catch (error) {
    console.error("Notification dispatch failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
