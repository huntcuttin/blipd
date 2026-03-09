import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/nintendo/admin-client";
import { batchGetReleaseDates } from "@/lib/igdb";
import { computeReleaseStatus } from "@/lib/nintendo/transform";

export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH_SIZE = 50;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    // Get games with placeholder release dates
    const { data: games, error } = await supabase
      .from("games")
      .select("id, title, release_date")
      .or("release_date.eq.2099-12-31,release_date.eq.2020-01-01")
      .order("title")
      .limit(BATCH_SIZE);

    if (error || !games) {
      console.error("Failed to fetch games:", error?.message);
      return NextResponse.json({ ok: false, error: error?.message }, { status: 500 });
    }

    if (games.length === 0) {
      return NextResponse.json({ ok: true, checked: 0, updated: 0, message: "No games need release dates" });
    }

    console.log(`Syncing release dates for ${games.length} games...`);

    const results = await batchGetReleaseDates(games);

    let updated = 0;
    for (const [gameId, result] of Array.from(results.entries())) {
      const releaseStatus = computeReleaseStatus(result.releaseDate);

      const { error: updateError } = await supabase
        .from("games")
        .update({
          release_date: result.releaseDate,
          release_status: releaseStatus,
          release_date_source: "igdb",
          updated_at: new Date().toISOString(),
        })
        .eq("id", gameId);

      if (updateError) {
        console.error(`  Failed to update ${gameId}:`, updateError.message);
      } else {
        updated++;
      }
    }

    console.log(`Release date sync complete: ${games.length} checked, ${updated} updated`);

    return NextResponse.json({
      ok: true,
      checked: games.length,
      matched: results.size,
      updated,
    });
  } catch (error) {
    console.error("Release date sync failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
