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
    // Dispatch notifications for alerts created in the last 15 minutes
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
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
