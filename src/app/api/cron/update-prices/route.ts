import { NextResponse } from "next/server";
import { runPriceUpdate, runReleaseStatusUpdate } from "@/lib/nintendo/ingest";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const priceResult = await runPriceUpdate();
    const releaseUpdates = await runReleaseStatusUpdate();
    return NextResponse.json({ ok: true, ...priceResult, releaseUpdates });
  } catch (error) {
    console.error("Price update failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
