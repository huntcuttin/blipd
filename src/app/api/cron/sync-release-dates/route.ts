import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/nintendo/admin-client";
import { batchGetReleaseDates } from "@/lib/igdb";
import { computeReleaseStatus } from "@/lib/nintendo/transform";

export const runtime = "nodejs";
export const maxDuration = 60;

// 500ms of deliberate rate-limit sleep between every IGDB call (see
// batchGetReleaseDates) means even a small batch adds up fast — 20 games
// was still landing close to whatever the real ~30s ceiling is here
// (cron-job.org logged a ~30002ms cutoff, well under both Vercel's 60s
// maxDuration and cron-job.org's own 90s requestTimeout for this job, so
// neither of those is the actual limit). 10 keeps real wall-clock time
// comfortably under that with margin.
const BATCH_SIZE = 10;
// Reserve a small slice of each batch for retrying rows IGDB has already
// failed to match at least once -- see the no-match marker below. Keeps
// them from ever fully starving (IGDB's catalog does grow, and this
// session's own normalizeForMatch/pickBestMatch fixes have already
// resolved stuck rows before), without letting them dominate a batch the
// way an unmarked alphabetical jam did twice already.
const RETRY_SLOTS = 2;

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

    // Get games with placeholder release dates. Confirmed live 2026-08-03:
    // 683 of 741 placeholder-dated rows are suppressed DLC/cosmetic items
    // (is_suppressed=true, see the DLC false-alert fix) that IGDB will never
    // match to a real game -- since this query orders alphabetically and
    // never advances past a row whose release_date never changes, those 683
    // permanently occupied every batch, and real games later in the
    // alphabet (WarioWare and others) never got their turn. Filtering out
    // suppressed rows here is the same fix already applied to
    // runReleaseStatusUpdate's pricedUpcoming query for the same reason.
    // A previously-attempted no-match is marked release_date_source =
    // "igdb-no-match" (see below) rather than left indistinguishable from a
    // never-tried row. Without that marker, an unmatchable row's
    // release_date never changes, so plain .order("title") re-fetches the
    // exact same alphabetical slice every run forever, permanently starving
    // every real game later in the alphabet -- confirmed live twice this
    // session (WarioWare and others stuck for ~5 months this way, then
    // Fire Emblem: Fortune's Weave the same day the first fix landed).
    // Most of each batch excludes marked rows so unattempted/real games
    // always get priority; a small reserved slice retries marked rows so
    // they aren't abandoned outright.
    const [freshResult, retryResult] = await Promise.all([
      supabase
        .from("games")
        .select("id, title, release_date")
        .or("release_date.eq.2099-12-31,release_date.eq.2020-01-01")
        .eq("is_suppressed", false)
        .neq("release_date_source", "igdb-no-match")
        .order("title")
        .limit(BATCH_SIZE - RETRY_SLOTS),
      supabase
        .from("games")
        .select("id, title, release_date")
        .or("release_date.eq.2099-12-31,release_date.eq.2020-01-01")
        .eq("is_suppressed", false)
        .eq("release_date_source", "igdb-no-match")
        .order("title")
        .limit(RETRY_SLOTS),
    ]);

    if (freshResult.error || retryResult.error) {
      const err = freshResult.error ?? retryResult.error;
      console.error("Failed to fetch games:", err?.message);
      return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
    }

    const games = [...(freshResult.data ?? []), ...(retryResult.data ?? [])];

    if (games.length === 0) {
      return NextResponse.json({ ok: true, checked: 0, updated: 0, message: "No games need release dates" });
    }

    console.log(`Syncing release dates for ${games.length} games...`);

    const { results, attemptedIds } = await batchGetReleaseDates(games);

    const now = new Date().toISOString();
    // Confirmed live 2026-08-03: a 2026-03-16 refactor changed this from
    // per-row .update() calls to a single batched .upsert(). Since games
    // has several NOT NULL, no-default columns (title, slug, publisher,
    // cover_art, current_price, original_price) that this payload never
    // included, Postgres rejects the INSERT side of every ON CONFLICT DO
    // UPDATE statement regardless of the rows already existing -- so this
    // has been silently failing on every single run for ~5 months, always
    // returning ok:true with updated:0 underneath. .update() only touches
    // the columns given, so it doesn't hit this constraint at all.
    let updated = 0;
    for (const [gameId, result] of Array.from(results.entries())) {
      const { error: updateError } = await supabase
        .from("games")
        .update({
          release_date: result.releaseDate,
          release_status: computeReleaseStatus(result.releaseDate),
          release_date_source: "igdb",
          updated_at: now,
        })
        .eq("id", gameId);
      if (updateError) {
        console.error(`Failed to update ${gameId}:`, updateError.message);
      } else {
        updated++;
      }
    }

    // Mark attempted-no-match rows so the next run's queries above
    // deprioritize them instead of re-fetching the exact same alphabetical
    // slice forever. release_date/release_status are left untouched -- this
    // only ever moves a row between the "fresh" and "retry" query buckets.
    // Only rows the breaker actually got to (attemptedIds) count as a real
    // no-match -- a game skipped because the breaker tripped mid-batch was
    // never checked at all and must keep full priority next run.
    const noMatchIds = Array.from(attemptedIds).filter((id) => !results.has(id));
    if (noMatchIds.length > 0) {
      const { error: markError } = await supabase
        .from("games")
        .update({ release_date_source: "igdb-no-match" })
        .in("id", noMatchIds);
      if (markError) console.error("Failed to mark no-match rows:", markError.message);
    }

    console.log(`Release date sync complete: ${games.length} checked, ${updated} updated, ${noMatchIds.length} marked no-match`);

    return NextResponse.json({
      ok: true,
      checked: games.length,
      matched: results.size,
      updated,
      noMatch: noMatchIds.length,
    });
  } catch (error) {
    console.error("Release date sync failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
