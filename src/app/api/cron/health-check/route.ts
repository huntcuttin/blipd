import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/nintendo/admin-client";
import { PLACEHOLDER_DATES, isYearOnlyDate, isMonthOnlyDate, isPlaceholderDate } from "@/lib/format";

export const runtime = "nodejs";
export const maxDuration = 30;

// update-prices runs every 10 min — 3x that gives room for a slow run
// without flagging a false positive.
const STALE_THRESHOLD_MS = 30 * 60 * 1000;

// Only jobs whose disable/failure genuinely breaks the pipeline are worth
// paging on — this list intentionally mirrors the crons in CLAUDE.md.
const MONITORED_CRON_TITLES = new Set([
  "Price Check (base)",
  "Launch Burst Poll",
  "Dispatch Notifications",
  "Catalog Sync",
  "Sync IGDB Hype",
  "Sync IGDB Ratings",
  "Sync Release Dates",
  "Detect Nintendo Directs",
  "Detect Game Trailers",
  "Weekly Digest",
]);

interface CronJobOrgJob {
  title: string;
  enabled: boolean;
  lastStatus: number;
}

async function checkCronJobOrg(): Promise<string[]> {
  const key = process.env.CRON_JOB_ORG_API_KEY;
  if (!key) return [];

  try {
    const res = await fetch("https://api.cron-job.org/jobs", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return [`cron-job.org API returned ${res.status}`];

    const data = (await res.json()) as { jobs: CronJobOrgJob[] };
    const problems: string[] = [];
    for (const job of data.jobs ?? []) {
      if (!MONITORED_CRON_TITLES.has(job.title)) continue;
      if (!job.enabled) {
        problems.push(`"${job.title}" is disabled on cron-job.org`);
      } else if (job.lastStatus && job.lastStatus !== 1) {
        problems.push(`"${job.title}" last run failed (status ${job.lastStatus})`);
      }
    }
    return problems;
  } catch (error) {
    return [`Failed to reach cron-job.org: ${error instanceof Error ? error.message : String(error)}`];
  }
}

async function checkPricePipelineFreshness(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("games")
    .select("last_price_check")
    .order("last_price_check", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) return [`Failed to check price pipeline freshness: ${error.message}`];
  if (!data?.last_price_check) return ["No games have ever had a price check"];

  const ageMs = Date.now() - new Date(data.last_price_check).getTime();
  if (ageMs > STALE_THRESHOLD_MS) {
    return [`Price pipeline stale: freshest last_price_check is ${Math.round(ageMs / 60000)} min old (expected < 30 min)`];
  }
  return [];
}

// Confirmed live 2026-08-02: Nintendo's price API can return a well-formed
// but wrong $0 regular_price for a game that's genuinely still paid — found
// via a real production incident (Monster Hunter Stories, Monster Hunter
// Rise Deluxe Kit, Capcom Fighting Collection all showed current_price=0
// despite Nintendo's API confirming real live prices when re-queried
// directly). ingest.ts now guards against writing a *new* 0 over an
// existing real price, but this doesn't un-stick rows already corrupted, and
// won't catch a game whose very first price check returns a bad 0. This is
// a periodic detection signal, not a fix.
//
// Confirmed live 2026-08-03: the RPC's original price_history-based filter
// (see migration 20260803_003) had a massive blind spot -- 89 of 92 real
// corrupted rows were invisible to it, including 8 of the founder's own 18
// followed games. Fixed by migration 20260803_004: the RPC now excludes an
// explicit nsuid allowlist of confirmed-legitimate $0 titles instead of the
// unreliable history heuristic, so any real corruption is caught regardless
// of price_history contents. With that allowlist doing the exclusion work,
// the threshold's only job is absorbing a brand-new F2P title or a transient
// blip before the allowlist is updated -- keep it small.
const SUSPICIOUS_ZERO_PRICE_THRESHOLD = 2;

async function checkSuspiciousZeroPrices(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("find_suspicious_zero_priced_games");

  if (error) {
    // This RPC is a nice-to-have monitoring signal, not core pipeline
    // health -- don't let its own failure (e.g. a missing function) mask
    // or crash the rest of the health check.
    console.error("Suspicious-zero-price check failed:", error.message);
    return [];
  }

  const rows = (data ?? []) as { title: string }[];
  if (rows.length <= SUSPICIOUS_ZERO_PRICE_THRESHOLD) return [];

  const examples = rows.slice(0, 5).map((r) => r.title).join(", ");
  return [
    `${rows.length} games show $0 current price despite real historical pricing (may include legitimate free-to-play conversions like Fortnite/Warframe -- spot check the rest). Examples: ${examples}`,
  ];
}

// ── Catalog-integrity invariants (audit §D, 2026-08-03) ──
// Every check below is purely informational: it emails the admin and never
// blocks, delays, or filters any alert or dispatch path. These are
// regression traps for incident classes this project has already hit at
// least once, not core pipeline health -- a failure here should never be
// treated as more urgent than the freshness/cron checks above.

// A real Direct-day IGDB correction wave could plausibly touch a couple
// dozen rows with genuinely distinct real dates in 24h -- the floor here is
// "the exact same date, not just the same day," which only a bulk mis-write
// bug (the 499-game "released today" incident) would ever produce.
const MASS_DATE_THRESHOLD = 50;

async function checkMassDateWrites(): Promise<string[]> {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // Confirmed live 2026-08-03 (first real run of this check): updated_at is
  // NOT a valid proxy for "release_date was just written" on its own --
  // routine price polling (runPriceUpdate) bumps updated_at on every game it
  // touches every ~10 min regardless of release_date, so within any 24h
  // window most of the catalog's updated_at has moved. The first live run
  // flagged 100 real, long-released games (Persona 5 Royal, Dark Souls
  // Remastered, etc.) sharing "2026-03-24" -- their release_date_source was
  // "unknown" (the original catalog-seed value from March, never touched by
  // any date-writing code path since), not a bulk mis-write. Only
  // "igdb"/"price-confirmed" sources are ever actively written by a
  // date-setting code path (sync-release-dates, the pricedUpcoming
  // fallback), and both are throttled to small batches/day -- restricting to
  // these makes 50+ genuinely sharing one date within 24h actually anomalous.
  const { data, error } = await supabase
    .from("games")
    .select("release_date")
    .eq("is_suppressed", false)
    .in("release_date_source", ["igdb", "price-confirmed"])
    .gte("updated_at", since);

  if (error) return [`Mass-date check failed: ${error.message}`];

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const d = row.release_date as string;
    // Sentinel/imprecise dates are excluded -- a real batch of IGDB
    // year-only or month-only corrections legitimately clusters many rows
    // on Dec 31 or a month-end, that's not the bulk-mis-write signal this
    // check exists for.
    if (isPlaceholderDate(d) || isYearOnlyDate(d) || isMonthOnlyDate(d)) continue;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }

  const problems: string[] = [];
  for (const [date, count] of Array.from(counts.entries())) {
    if (count > MASS_DATE_THRESHOLD) {
      problems.push(`${count} unsuppressed games all got release_date=${date} in the last 24h -- looks like a bulk mis-write, not real launches`);
    }
  }
  return problems;
}

// Regression trap for the exact incident class Phase 0/1 fixed (2026-08-03):
// an unsuppressed junk row is the leak, UNLESS it's directly followed --
// the Bible's "a followed game always alerts" exemption means a followed
// BUNDLE/ADD_ON_CONTENT is *supposed* to stay unsuppressed (confirmed live
// 2026-08-03: the first real run of this check flagged exactly the two
// known, deliberately-exempted rows from Phase 0.4 -- Dave the Diver: In
// the Jungle and DRAGON QUEST - HD-2D Erdrick Trilogy Collection -- as a
// false positive). Every OTHER user-facing surface's own filter is what's
// supposed to keep the non-exempt count at 0.
async function checkJunkLeak(): Promise<string[]> {
  const supabase = createAdminClient();
  const [junkResult, followsResult] = await Promise.all([
    supabase
      .from("games")
      .select("id, title")
      .eq("is_suppressed", false)
      .in("product_type", ["ADD_ON_CONTENT", "BUNDLE"]),
    supabase.from("user_game_follows").select("game_id"),
  ]);

  if (junkResult.error) return [`Junk-leak check failed: ${junkResult.error.message}`];
  const followedIds = new Set((followsResult.data ?? []).map((f) => f.game_id as string));
  const leaked = (junkResult.data ?? []).filter((g) => !followedIds.has(g.id));

  if (leaked.length === 0) return [];

  const examples = leaked.slice(0, 5).map((g) => g.title).join(", ");
  return [`${leaked.length} non-followed ADD_ON_CONTENT/BUNDLE rows are unsuppressed and eligible for Out Now/Coming Soon/Deals -- ingest gate or a query filter may have regressed. Examples: ${examples}`];
}

// Every row should get a real classification at ingest time (transform.ts).
// A small buffer absorbs an in-flight sync or a genuinely-new Algolia edge
// case; a NULL count much above that means something upstream of the
// backfill (2026-08-03) has regressed.
const PRODUCT_TYPE_NULL_THRESHOLD = 5;

async function checkProductTypeNulls(): Promise<string[]> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("games")
    .select("id", { count: "exact", head: true })
    .is("product_type", null);

  if (error) return [`product_type NULL check failed: ${error.message}`];
  if ((count ?? 0) <= PRODUCT_TYPE_NULL_THRESHOLD) return [];
  return [`${count} games have product_type=NULL (expected ~0 after the 2026-08-03 backfill) -- ingest may have stopped classifying new rows`];
}

// A game stuck on a placeholder date with a real price should get resolved
// (released, suppressed, or dated for real) within a run or two of the
// event-creation breaker/pricedUpcoming fallback -- one still sitting here
// after a week suggests something is looping without making progress. Not
// currently a live concern (neither of the two known followed-junk rows
// happens to sit on a placeholder date right now), but not filtered by
// product_type -- a followed junk item genuinely stuck here is still a real
// stuck-row signal worth surfacing, so no followed-exemption here, unlike
// checkJunkLeak (which is specifically about junk *reaching users*, not
// about whether a row's data is stuck).
const STUCK_PLACEHOLDER_DAYS = 7;

async function checkStuckPlaceholderPricedGames(): Promise<string[]> {
  const supabase = createAdminClient();
  const staleSince = new Date(Date.now() - STUCK_PLACEHOLDER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("games")
    .select("title")
    .eq("is_suppressed", false)
    .in("release_date", PLACEHOLDER_DATES as unknown as string[])
    .gt("current_price", 0)
    // created_at, not updated_at: price polling bumps updated_at on every
    // actively-priced game every few hours, so an updated_at staleness
    // filter excluded exactly the priced rows this check exists to catch
    // (2026-08-05 audit) -- the check could never fire for its target.
    .lt("created_at", staleSince)
    .limit(10);

  if (error) return [`Stuck-placeholder check failed: ${error.message}`];
  if (!data || data.length === 0) return [];

  const examples = data.slice(0, 5).map((g) => g.title).join(", ");
  return [`${data.length}+ games have a real price + placeholder release_date, unsuppressed, older than ${STUCK_PLACEHOLDER_DAYS} days -- may be stuck in the event-creation breaker's hold state. Examples: ${examples}`];
}

// Launches cluster at known Nintendo eShop go-live times (9am/9pm PT,
// midnight ET), so a real Direct-day wave can legitimately exceed the
// informational floor -- only the alarm tier is treated as a problem.
const OUT_NOW_VOLUME_INFO = 15;
const OUT_NOW_VOLUME_ALARM = 50;

async function checkOutNowVolume(): Promise<string[]> {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("alerts")
    .select("id", { count: "exact", head: true })
    .eq("type", "out_now")
    .gte("created_at", since);

  if (error) return [`out_now volume check failed: ${error.message}`];
  const n = count ?? 0;
  if (n > OUT_NOW_VOLUME_ALARM) {
    return [`${n} out_now alerts created in the last 60 min (>${OUT_NOW_VOLUME_ALARM}) -- alarm tier, verify this is a real Direct-day wave and not a leak`];
  }
  if (n > OUT_NOW_VOLUME_INFO) {
    console.log(`Health check: ${n} out_now alerts in the last 60 min -- above the informational floor (${OUT_NOW_VOLUME_INFO}), not alarming (launches legitimately cluster at known go-live times)`);
  }
  return [];
}

async function sendAlertEmail(problems: string[]): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!key || !adminEmail) {
    console.error("Health check found problems but RESEND_API_KEY/ADMIN_EMAIL not configured:", problems);
    return;
  }

  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: "Blippd <alerts@blippd.app>",
    to: adminEmail,
    subject: `Blippd pipeline health check: ${problems.length} issue${problems.length === 1 ? "" : "s"} found`,
    text: problems.map((p) => `- ${p}`).join("\n"),
  });
  if (error) console.error("Failed to send health-check alert email:", error.message);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    cronProblems,
    freshnessProblems,
    zeroPriceProblems,
    massDateProblems,
    junkLeakProblems,
    productTypeNullProblems,
    stuckPlaceholderProblems,
    outNowVolumeProblems,
  ] = await Promise.all([
    checkCronJobOrg(),
    checkPricePipelineFreshness(),
    checkSuspiciousZeroPrices(),
    checkMassDateWrites(),
    checkJunkLeak(),
    checkProductTypeNulls(),
    checkStuckPlaceholderPricedGames(),
    checkOutNowVolume(),
  ]);

  const problems = [
    ...cronProblems,
    ...freshnessProblems,
    ...zeroPriceProblems,
    ...massDateProblems,
    ...junkLeakProblems,
    ...productTypeNullProblems,
    ...stuckPlaceholderProblems,
    ...outNowVolumeProblems,
  ];

  if (problems.length > 0) {
    console.error("Health check found problems:", problems);
    await sendAlertEmail(problems);
  } else {
    console.log("Health check passed");
  }

  return NextResponse.json({ ok: problems.length === 0, problems });
}
