import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/nintendo/admin-client";
import { fetchPrices } from "@/lib/nintendo/client";
import { generateReleaseAlert } from "@/lib/nintendo/alerts";
import { predictLaunchInstant, isWithinBurstWindow, isLiveOnEshop } from "@/lib/nintendo/launch-window";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Only games at least one user actually follows — no news feeds, no
  // curation, per the Bible Addendum.
  const { data: followRows, error: followError } = await supabase
    .from("user_game_follows")
    .select("game_id");
  if (followError) {
    return NextResponse.json({ ok: false, error: followError.message }, { status: 500 });
  }

  const followedIds = Array.from(new Set((followRows ?? []).map((f) => f.game_id)));
  if (followedIds.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, inWindow: 0, released: 0 });
  }

  const { data: candidates, error: candidatesError } = await supabase
    .from("games")
    .select("id, title, nsuid, publisher, release_date, has_physical_release")
    .in("id", followedIds)
    .eq("release_status", "upcoming")
    .not("nsuid", "is", null)
    .neq("release_date", "2099-12-31")
    .neq("release_date", "2020-01-01");

  if (candidatesError) {
    return NextResponse.json({ ok: false, error: candidatesError.message }, { status: 500 });
  }
  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, inWindow: 0, released: 0 });
  }

  const now = new Date();
  const inWindow = candidates.filter((g) => {
    const prediction = predictLaunchInstant({
      releaseDate: g.release_date,
      publisher: g.publisher,
      hasPhysicalRelease: g.has_physical_release,
    });
    return prediction && isWithinBurstWindow(prediction.at, now);
  });

  if (inWindow.length === 0) {
    return NextResponse.json({ ok: true, checked: candidates.length, inWindow: 0, released: 0 });
  }

  console.log(`  Launch burst: polling ${inWindow.length} followed upcoming game(s) within +-30min of predicted launch`);

  const nsuids = inWindow.map((g) => g.nsuid as string);
  const prices = await fetchPrices(nsuids);
  const priceByNsuid = new Map(prices.map((p) => [String(p.title_id), p]));

  let released = 0;
  for (const game of inWindow) {
    const priceInfo = priceByNsuid.get(game.nsuid as string);
    // Ground truth for "is this live", not the prediction — but a preorder
    // listing can carry a real regular_price while Nintendo's own
    // sales_status still reads "unreleased" (confirmed live against the
    // API), so price presence alone is up to ~30min too early here.
    if (!priceInfo || !isLiveOnEshop(priceInfo.sales_status) || !priceInfo.regular_price) continue;

    const regular = parseFloat(priceInfo.regular_price.raw_value);
    const discount = priceInfo.discount_price ? parseFloat(priceInfo.discount_price.raw_value) : null;
    if (isNaN(regular)) continue;
    const newPrice = discount != null && !isNaN(discount) ? discount : regular;

    const { error: updateError } = await supabase
      .from("games")
      .update({
        release_status: "released",
        current_price: newPrice,
        original_price: regular,
        updated_at: new Date().toISOString(),
      })
      .eq("id", game.id);
    if (updateError) {
      console.error(`  Launch burst: failed to update ${game.title}:`, updateError.message);
      continue;
    }

    if (await generateReleaseAlert(supabase, { id: game.id, title: game.title }, "out_now", newPrice)) {
      released++;
    }
  }

  return NextResponse.json({ ok: true, checked: candidates.length, inWindow: inWindow.length, released });
}
