import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/nintendo/admin-client";
import { batchGetRatings } from "@/lib/igdb";

export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_SIZE = 40;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
    return NextResponse.json({ ok: true, skipped: true, reason: "IGDB credentials not configured" });
  }

  try {
    const supabase = createAdminClient();

    // Fetch released games that don't have a metacritic_score yet
    const { data: games, error } = await supabase
      .from("games")
      .select("id, title, igdb_id, metacritic_score")
      .eq("release_status", "released")
      .eq("is_suppressed", false)
      .is("metacritic_score", null)
      .gt("original_price", 0)
      .order("updated_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (error || !games) {
      console.error("Failed to fetch games for rating sync:", error?.message);
      return NextResponse.json({ ok: false, error: error?.message }, { status: 500 });
    }

    if (games.length === 0) {
      return NextResponse.json({ ok: true, checked: 0, updated: 0, message: "All released games have ratings" });
    }

    console.log(`Syncing ratings for ${games.length} released games...`);

    const results = await batchGetRatings(
      games.map((g) => ({ id: g.id, title: g.title, igdbId: g.igdb_id }))
    );

    let updated = 0;
    for (const [gameId, result] of Array.from(results.entries())) {
      const { error: updateError } = await supabase
        .from("games")
        .update({
          igdb_id: result.igdbId,
          metacritic_score: result.rating,
          updated_at: new Date().toISOString(),
        })
        .eq("id", gameId);

      if (updateError) {
        console.error(`  Failed to update rating for ${gameId}:`, updateError.message);
      } else {
        updated++;
      }
    }

    // For games with no IGDB rating, set metacritic_score to 0 so we don't re-check
    const unmatchedIds = games
      .filter((g) => !results.has(g.id))
      .map((g) => g.id);

    if (unmatchedIds.length > 0) {
      await supabase
        .from("games")
        .update({ metacritic_score: 0, updated_at: new Date().toISOString() })
        .in("id", unmatchedIds);
    }

    console.log(`Rating sync complete: ${games.length} checked, ${updated} updated with rating > 0`);

    return NextResponse.json({
      ok: true,
      checked: games.length,
      matched: results.size,
      updated,
      zeroed: unmatchedIds.length,
    });
  } catch (error) {
    console.error("Rating sync failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
