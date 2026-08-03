import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/nintendo/admin-client";
import { fetchPrices } from "@/lib/nintendo/client";
import { generateReleaseAlert } from "@/lib/nintendo/alerts";

export const runtime = "nodejs";
export const maxDuration = 60;

// Only followed, upcoming games within this window of their predicted
// launch instant get polled — everything else waits for the normal 10-min
// update-prices cycle. Keeps this cron cheap even with a tight schedule.
const WINDOW_MS = 30 * 60 * 1000;

const MAJOR_FIRST_PARTY = ["nintendo", "sega", "capcom"];

// Real, DST-aware Pacific UTC offset for a given date, via the Intl API's
// timezone database rather than a hardcoded -7/-8 assumption.
function getPacificUtcOffsetHours(referenceUTC: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    timeZoneName: "shortOffset",
  }).formatToParts(referenceUTC);
  const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-8";
  const match = offsetPart.match(/GMT([+-]\d+)/);
  return match ? parseInt(match[1], 10) : -8;
}

// Predicts a launch *instant* (not just a rule label) for a specific game.
// Partial implementation: only distinguishes "major first-party" (via
// publisher match) from everything else, since has_physical_release isn't
// available in the DB yet (migration pending) — once it lands, the
// "physical + digital" rule (9pm PT night before) can be added here too.
// Everyone else defaults to 9am PT release day, which per the copy policy
// already covers the fuzzy "some third-party" bucket with hedged framing
// on the release-time page — this cron doesn't show that copy, it just
// needs a reasonable instant to center the polling window on.
function predictLaunchInstant(releaseDate: string, publisher: string | null): number {
  const [y, m, d] = releaseDate.split("-").map(Number);
  const noonUTCOnReleaseDay = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const offsetHours = getPacificUtcOffsetHours(noonUTCOnReleaseDay);

  const pub = (publisher ?? "").toLowerCase();
  const isMajorFirstParty = MAJOR_FIRST_PARTY.some((p) => pub.includes(p));

  if (isMajorFirstParty) {
    // Midnight ET == 9pm PT the night before release day.
    return Date.UTC(y, m - 1, d - 1, 21 - offsetHours, 0, 0);
  }
  // 9am PT on release day.
  return Date.UTC(y, m - 1, d, 9 - offsetHours, 0, 0);
}

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
    .select("id, title, nsuid, publisher, release_date")
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

  const now = Date.now();
  const inWindow = candidates.filter((g) => {
    if (!g.release_date) return false;
    const predicted = predictLaunchInstant(g.release_date, g.publisher);
    return Math.abs(now - predicted) <= WINDOW_MS;
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
    if (!priceInfo?.regular_price) continue; // not live yet — ground truth, not the prediction, decides this

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
