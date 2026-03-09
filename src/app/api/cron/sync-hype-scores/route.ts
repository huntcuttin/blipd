import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/nintendo/admin-client";
import { batchGetHypeScores } from "@/lib/igdb";

export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH_SIZE = 40;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    // Fetch upcoming games that need hype scores (no igdb_hype yet, or stale)
    const { data: games, error } = await supabase
      .from("games")
      .select("id, title, igdb_id, igdb_hype")
      .in("release_status", ["upcoming", "out_today"])
      .eq("is_suppressed", false)
      .is("igdb_hype", null)
      .order("release_date", { ascending: true })
      .limit(BATCH_SIZE);

    if (error || !games) {
      console.error("Failed to fetch games for hype sync:", error?.message);
      return NextResponse.json({ ok: false, error: error?.message }, { status: 500 });
    }

    if (games.length === 0) {
      return NextResponse.json({ ok: true, checked: 0, updated: 0, message: "All upcoming games have hype scores" });
    }

    console.log(`Syncing hype scores for ${games.length} upcoming games...`);

    const results = await batchGetHypeScores(
      games.map((g) => ({ id: g.id, title: g.title, igdbId: g.igdb_id }))
    );

    let updated = 0;
    for (const [gameId, result] of Array.from(results.entries())) {
      const { error: updateError } = await supabase
        .from("games")
        .update({
          igdb_id: result.igdbId,
          igdb_hype: result.hypes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", gameId);

      if (updateError) {
        console.error(`  Failed to update hype for ${gameId}:`, updateError.message);
      } else {
        updated++;
      }
    }

    // For games with no IGDB match, set hype to 0 so we don't re-check them
    const unmatchedIds = games
      .filter((g) => !results.has(g.id))
      .map((g) => g.id);

    if (unmatchedIds.length > 0) {
      await supabase
        .from("games")
        .update({ igdb_hype: 0, updated_at: new Date().toISOString() })
        .in("id", unmatchedIds);
    }

    console.log(`Hype sync complete: ${games.length} checked, ${updated} updated with hype > 0`);

    return NextResponse.json({
      ok: true,
      checked: games.length,
      matched: results.size,
      updated,
      zeroed: unmatchedIds.length,
    });
  } catch (error) {
    console.error("Hype sync failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
