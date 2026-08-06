# Blippd Alert-Pipeline Audit — 2026-08-05

Scope: (A) alert-correctness core (ingest/transform/alerts/client/launch-window/types + update-prices, launch-burst-poll) and (B) sync/cron pipeline (sync-catalog/ratings/hype/release-dates, detect-directs/trailers, health-check, igdb.ts, retry.ts), plus the repo-wide unpaginated-select sweep and the last ~3 days of changes. Read-only; all findings cite code.

**Verified intact (no action needed, per the re-check mandate):** zero-price write guard (`src/lib/nintendo/ingest.ts:738-741`); `NOT_JUNK_OR` + followed-exemption on the poll query (`ingest.ts:649-655`), `releasingToday` (`ingest.ts:1087-1094`), and `pricedUpcoming` (`ingest.ts:1170-1178`); dispatch-level franchise-fanout junk gate (`src/lib/notifications/dispatch.ts:38-41,213`); out_now breaker/ceiling logic (`ingest.ts:44-45,1213-1240` — matches the documented >20 re-verify / >100 hold design, held candidates keep status); launch-burst-poll `sales_status === "onsale"` ground truth (`launch-window.ts:159-161`, `launch-burst-poll/route.ts:75`) and ±30min inclusive window math; sync-catalog's paginated `existingNsuids`/`existingSlugs` (`ingest.ts:286-300`) and price-field strip for existing rows; dedup un-suppress junk guard (`ingest.ts:536-538`); sync-release-dates `igdb-no-match` marker + 8/2 batch split + `BATCH_SIZE=10` + per-row `.update()` (`sync-release-dates/route.ts:17,24,59-76,104-122`); igdb.ts earliest-date sort + `"130,508"` platforms + `normalizeForMatch`/`pickBestMatch` + `attemptedIds` breaker protection; junk-leak followed-exemption in health-check; weekly-digest follows pagination + empty-digest skip; dispatch `dispatched_at IS NULL` durability with paginated alert fetch and per-alert work counters.

---

## CRITICAL

### C1. `pricedUpcoming`'s alert-history guard is 1,000-row-capped — the false-"out now" incident class can recur in exactly its designed-for scenario

**Severity:** critical (could email a user a false launch alert)
**File:** `src/lib/nintendo/ingest.ts:1194-1198`

```ts
    const { data: priorAlerts } = await supabase
      .from("alerts")
      .select("game_id")
      .in("game_id", ids);
    const hasHistory = new Set((priorAlerts ?? []).map((a) => a.game_id as string));
```

No `.range()`/`.limit()`. PostgREST caps this at 1,000 rows (confirmed live on this exact project: "the unpaginated select returns exactly 1,000 of 2,822 rows", CLAUDE.md 2026-08-04). This query fetches *every alert row* for every candidate game — not one row per game. The `hasHistory` guard is the fix (`5359221`) for the 62-false-alert/8-emailed incident: a game with prior alert history must never be announced as new. But during a recovery wave — the precise scenario this guard was built for — candidates are history-rich games (the documented incident had games with 40, 25, 20, 17 prior alerts each). ~30 candidates averaging ~35 alert rows exceeds 1,000; rows come back in arbitrary order, so a candidate whose alert rows all fall past the cap is invisible to `hasHistory`, classified `genuinelyNew`, and alerted. The downstream breaker doesn't save it: `verifyStillOnSale` passes (a long-released game genuinely *is* `onsale`), and the 100-ceiling only trips on much larger batches. Franchise fanout then emails real users — the exact 2026-08-03 failure, resurrected by row-cap truncation.

**Fix:** replace the row fetch with a per-game existence check (`head: true, count: "exact"` per id, or one paginated loop over the select), or select `game_id` with a `.range()` loop. Cheapest correct option: loop `.range()` like the `existingNsuids` fix 900 lines up in the same file.

---

## MODERATE

### M1. Sale-flap dedup is half-wired: `isDuplicateSaleSignature` gates `sale_started` but the `price_drop` branch re-fires the identical signature

**Severity:** moderate (duplicate emails to real followers; latent since the probable flap driver was fixed 2026-08-04)
**File:** `src/lib/nintendo/ingest.ts:806-817`; `src/lib/nintendo/alerts.ts:164-198`

```ts
        const isPriceDrop = newPrice < oldPrice;
        let isNewSale = isOnSale && !game.is_on_sale;
        if (isNewSale && await isDuplicateSaleSignature(supabase, game.id, discount, newPrice)) {
          isNewSale = false;
        }
        if (isPriceDrop || allTimeLow || isNewSale) {
          ...
          if (isPriceDrop) {
            if (await generatePriceDropAlert(...)) alertsCreated++;
          } else if (isNewSale) {
```

For the documented Monster Hunter flap to have re-fired `sale_started` (it did, every 1-2 days), `priceChanged` had to be true — i.e. the price round-tripped through the regular price. Replay that flap against *current* code: on the sale-reappears cycle, `newPrice < oldPrice` → `isPriceDrop=true` → the `if (isPriceDrop)` branch fires a `price_drop` alert with the identical discount+price, **bypassing the signature check entirely** (its verdict is only ever assigned to `isNewSale`). `hasRecentAlert`'s 24h gate doesn't catch flap gaps >24h — the incident's documented cadence. The function even queries `.in("type", ["sale_started", "price_drop"])` (alerts.ts:179), showing the intent to cover both types; the result just isn't applied to the price_drop path. Nuance: the 2026-08-04 root-cause finding (catalog-sync 1,000-cap clobber, fixed in `ba2b357`) most plausibly *was* the flap mechanism, so this is a latent gap today rather than an active duplicator — but any future price round-trip (Nintendo-side or another write bug) re-opens it as duplicate `price_drop` emails.

**Fix:** when `isPriceDrop && isOnSale`, run the same `isDuplicateSaleSignature` check before firing `generatePriceDropAlert` (or hoist the check above the branch and gate both).

### M2. `runFullCatalogSync`'s Switch2-link/dedup/un-suppress pass reads the whole `games` table unpaginated — same bug class fixed 175 lines earlier in the same function

**Severity:** moderate (silent partial dedup/suppression today; documented fix half-applied)
**File:** `src/lib/nintendo/ingest.ts:475-477` (plus `483-484`, `545-548`, `558-562`, `572-576`)

```ts
  const { data: allDbGames } = await supabase
    .from("games")
    .select("id, title, nsuid, current_price, product_type");
```

The 2026-08-04 fix (`ingest.ts:274-300`) paginated `existingNsuids` and recorded the lesson: "any .select() over the games table without .range() pagination is wrong the moment the catalog exceeds 1,000 rows, which it has since March." This second whole-table select in the same function was never given the same treatment. Consequences, every daily sync: the title-grouping/dedup/suppress/un-suppress pass sees an arbitrary ~1,000-row subset of the ~2,900-row catalog — title groups split across the cap boundary lose their base or their Switch-2 sibling, so new duplicate listings can go unsuppressed and Switch-2/upgrade-pack links go unlinked, silently and non-deterministically. Same cap applies to the franchise rebuild inputs directly below: `franchiseData` (:545-548), `repGames` (:558-562), `saleData` (:572-576) — meaning `franchises.game_count`/`popularity_score` are computed from a truncated subset **right now** (well over 1,000 rows carry a franchise tag). Also `existingLinks` (:481-484) caps at 1,000; once switch2-linked rows exceed that, `existingSw2Set` truncates and `generateSwitch2EditionAlert` re-fires for already-linked games on consecutive daily syncs (24h `hasRecentAlert` window ≈ the daily cadence, so the gate is borderline).

**Fix:** reuse the exact `.range()` loop pattern from :289-300 for all five selects.

### M3. Catalog sync's trusted-date restore list is unpaginated — a slow-fuse re-run of the "sync demotes released games" incident

**Severity:** moderate (time bomb: silent once `igdb`+`price-confirmed` rows exceed 1,000)
**File:** `src/lib/nintendo/ingest.ts:265-268`

```ts
  const { data: trustedDates } = await supabase
    .from("games")
    .select("id, release_date, release_status, release_date_source")
    .in("release_date_source", ["igdb", "price-confirmed"]);
```

sync-release-dates resolves ~8-10 rows/run at 4 runs/day and the 2026-08-04 fabricated-dates script tagged 182+ rows `igdb`; this population grows monotonically toward 1,000. The moment it crosses, the restore pass silently drops the overflow: those games' release_date/release_status get clobbered by the upsert each daily sync and never restored — the exact "DRAGON QUEST Trilogy demoted to upcoming every sync" incident the restore exists to prevent. Blast radius is smaller than the original (the `parseReleaseDate` fallback to Algolia's `releaseDate` now usually supplies a real date), but the Algolia-null case (the original trigger) still reverts rows to placeholder/TBA, re-enters them into `pricedUpcoming`, and relies on the C1-vulnerable history guard to avoid a false out_now.

**Fix:** paginate with `.range()`.

### M4. Slate-reconciliation script's `release_date_source: "nintendo"` is not a trusted source — its docstring claim is false, and the next catalog sync can clobber the founder's corrections

**Severity:** moderate (data integrity; founder-facing regressions of the 2026-08-05 morning fixes)
**File:** `fixes/sync_nintendo_first_party_slate.py:12-14,137`; `src/lib/nintendo/ingest.ts:268`

Script docstring: "upsert into our games table with release_date_source='nintendo' (the same source value ingest itself uses for Nintendo-provided dates, so future syncs agree rather than fight)." That premise is false: `grep -rn "release_date_source" src/` shows the only source values any code reads or writes are `igdb`, `price-confirmed`, and `igdb-no-match`; the string `"nintendo"` appears nowhere in `src/`. The catalog sync's restore pass (`ingest.ts:268`) protects only `["igdb", "price-confirmed"]`, so every slate row (19 updated + 8 created) is unprotected. Where Algolia's own `releaseDate` matches what the script wrote, the nightly re-derivation is convergent and harmless — but the script explicitly falls back to the founder's date when Algolia's is empty (`algolia_date = (hit.get("releaseDate") or "")[:10] or expected_date`, :118), and those rows revert to the 2099-12-31 placeholder ("TBA") on the next nightly sync, silently undoing the morning fix (Rhythm Heaven Groove-class rows were on TBA precisely because Algolia data was bad). `releaseDateDisplay` month-year conventions can also diverge from the script's exact dates. Secondary issue in the same script: created rows (`:145-159`) set no `franchise`, and the two "(English)"-prefixed Pokémon rows are permanently invisible to catalog sync (see M9), so their `franchise` stays NULL forever — meaning **Pokemon franchise followers will never receive launch/sale alerts for FireRed/LeafGreen** (dispatch's franchise fanout keys off `games.franchise`, `dispatch.ts:213`).

**Fix:** either add `"nintendo"` to the trusted-source list in `ingest.ts:268` (one-word change, also makes the script's docstring true), or retag the rows `igdb`. Backfill `franchise: "Pokemon"` (and appropriate tags for Star Fox/Zelda rows) on the created rows.

### M5. sync-release-dates can stamp `out_today` and thereby skip the launch alert entirely

**Severity:** moderate (launch-alert miss — the Bible's worse failure mode — for shadow-drop-dated followed games)
**File:** `src/app/api/cron/sync-release-dates/route.ts:109-115`; `src/lib/nintendo/ingest.ts:1076-1080`

```ts
        .update({
          release_date: result.releaseDate,
          release_status: computeReleaseStatus(result.releaseDate),
```

`computeReleaseStatus` returns `"out_today"` when the resolved date is today (Pacific). `releasingToday`'s alert query requires `release_status = "upcoming"` (`ingest.ts:1079`: `.eq("release_status", "upcoming").eq("release_date", todayStr)`), so a game whose IGDB date resolves *on its launch day* — the shadow-drop pattern, where IGDB gets the date the day it's announced/released — is stamped `out_today` and never matches the alert path. `pricedUpcoming` can't catch it either (its date is now real, not placeholder), and launch-burst-poll only watches `release_status = "upcoming"` (`launch-burst-poll/route.ts:36`). Followers get only the in-app `release_date_set` alert (no email template by design); the launch email never fires; `pastRelease` flips it to `released` silently the next day. This is the same shape as the fixed audit #13 (out_today stamping starves the releasingToday query) surviving through a different writer.

**Fix:** in sync-release-dates, when `computeReleaseStatus` yields `out_today`, either keep status `upcoming` (letting `releasingToday` fire on the next update-prices tick) or fire `generateReleaseAlert` here for followed games.

### M6. Health-check does not monitor the "Launch Burst Poll" cron — the differentiator is unprotected against the auto-disable failure mode already observed three times

**Severity:** moderate (monitoring gap on the product's #1 priority feature)
**File:** `src/app/api/cron/health-check/route.ts:15-25`

```ts
const MONITORED_CRON_TITLES = new Set([
  "Price Check (base)",
  "Dispatch Notifications",
  "Catalog Sync",
  "Sync IGDB Hype",
  "Sync IGDB Ratings",
  "Sync Release Dates",
  "Detect Nintendo Directs",
  "Detect Game Trailers",
  "Weekly Digest",
]);
```

The launch-burst-poll job (cron-job.org job 8205523, per CLAUDE.md's cron table, which this list claims to "intentionally mirror") is absent. cron-job.org has auto-disabled three of this project's jobs before, unnoticed for months — that exact failure mode against burst-poll would silently kill launch-minute alerts (the locked product differentiator, and one of the two things Project Philosophy keeps at product grade: "whatever makes the monthly check-in actually effective"). The native onFailure/onDisable emails are a partial backstop, but the health-check was built precisely because those weren't sufficient alone.

**Fix:** add the burst-poll job's cron-job.org title to the set.

### M7. Health-check's stuck-placeholder invariant can structurally never fire for its stated target population

**Severity:** moderate (a monitoring check that silently doesn't monitor)
**File:** `src/app/api/cron/health-check/route.ts:241-248`

```ts
  const { data, error } = await supabase
    .from("games")
    .select("title")
    .eq("is_suppressed", false)
    .in("release_date", PLACEHOLDER_DATES as unknown as string[])
    .gt("current_price", 0)
    .lt("updated_at", staleSince)
```

The check's stated purpose (comment, :226-235): catch a priced, placeholder-dated game "stuck in the event-creation breaker's hold state" for >7 days. But a game matching `current_price > 0` with an nsuid is in the price-poll rotation, and `runPriceUpdate` writes `updated_at: new Date().toISOString()` on **every** polled game each ~4.7h rotation regardless of price change (`ingest.ts:758`, update applied to all `pendingUpdates` at :782-789). So `updated_at < now - 7d` is false for every game the breaker could ever be holding — the invariant only fires for priced rows *outside* the poll rotation (nsuid-null oddities), i.e. almost never, and never for the incident class it was written for. The same `updated_at`-is-not-a-write-proxy lesson is already documented inside this very file for `checkMassDateWrites` (:136-148) but wasn't applied here.

**Fix:** drop the `updated_at` clause and instead compare against the game's alert history or a dedicated `release_status`-transition timestamp; or track breaker holds explicitly (log table or counter) rather than inferring from row staleness.

### M8. `sale_ending` fires twice per sale per user, with copy skewed up to a day early — audit #27's fix was display-only, the alert path still parses UTC midnight

**Severity:** moderate (per-event duplicate emails + wrong urgency copy in real emails)
**File:** `src/lib/nintendo/ingest.ts:846-851`; `src/lib/nintendo/alerts.ts:237-240`

```ts
      const due = endingSoon.filter((game) => {
        if (!game.sale_end_date) return false;
        const endTime = new Date(game.sale_end_date).getTime();
```
```ts
  const daysLeft = Math.ceil(
    (new Date(saleEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const urgency = daysLeft <= 1 ? "ends today" : `ends in ${daysLeft} days`;
```

Two stacked issues. (a) Duplicate-per-event: the 48h eligibility window is re-evaluated every 10-min cron, and the only dedup is `hasRecentAlert`'s 24h gate — so a sale entering the window at T-48h alerts once ("ends in 2 days"), then again ~24h later ("ends today"). Two emails for one sale-end event violates "one alert per event per user"; the observed 280 sale_ending vs 510 sale_started rows in 30 days is consistent with routine double-firing. (b) `sale_end_date` is stored date-only (`ingest.ts:756` strips the time), and `new Date("YYYY-MM-DD")` parses UTC midnight — hours before the sale's real end, so the window opens early and the "ends today" copy can be a day early relative to the Pacific-anchored labels users see in the UI. Audit #27 fixed exactly this in GameCard//deals/GameDetailClient via the shared `getDaysUntil`/`getSaleEndLabel` (`src/lib/format.ts:80-100`) but the alert-generation path never adopted them — alert email copy and on-site countdown can disagree by a day for the same game.

**Fix:** compute the window and `daysLeft` via `getDaysUntil` (already imported-adjacent in both files), and decide the intended cadence (one alert at 48h, or explicitly two-tier) — if one, extend the dedup gate for `sale_ending` past 48h or key it on `sale_end_date`.

### M9. Dispatch's already-sent dedup pairs query is unpaginated — duplicate emails on retry runs exactly during high-volume incidents

**Severity:** moderate (dedup guard defeats itself at the volumes where it matters)
**File:** `src/lib/notifications/dispatch.ts:135-141,158-160`

```ts
    alertIds.length > 0
      ? supabase.from("notification_log").select("alert_id, user_id").in("alert_id", alertIds).eq("status", "sent")
      : ...
  const alreadySentPairs = new Set(
    (sentLogsResult.data ?? []).map((l) => `${l.alert_id}:${l.user_id}`)
  );
```

The alerts fetch directly above it (:104-118) was carefully paginated with the comment "PostgREST caps an unbounded select at 1,000 rows" — this companion query wasn't. `alreadySentPairs` exists to prevent re-sending when a run is interrupted (rate-limit stop) and alerts are re-fetched whole next tick. But the interruption scenario is precisely when the undispatched backlog is large: >1,000 already-sent (alert,user) pairs truncates the set arbitrarily, and every pair past the cap gets a second email. The 2026-08-03 wave produced 489 alert rows in one incident; with a handful of users this crosses 1,000 pairs easily. Same unpaginated pattern on `user_game_follows .in(game_ids)` (:140) and `user_franchise_follows .in(franchise_ids)` (:180-183) — those truncate *recipients* (missed sends) at scale rather than duplicating.

**Fix:** paginate all three with `.range()` loops (the file already contains the exact pattern).

### M10. Audit #18's `2020-01-01` arm of `pricedUpcoming` is dead code — `pastRelease` silently swallows those rows first, preserving the miss #18 set out to close

**Severity:** moderate (documented fix ineffective; class = missed launch alert; 0 affected rows today)
**File:** `src/lib/nintendo/ingest.ts:1119-1134` vs `1142-1155`

```ts
  // Games past their release date still marked upcoming
  const { data: pastRelease } = await supabase
    .from("games")
    .select("id")
    .in("release_status", ["upcoming", "out_today"])
    .lt("release_date", todayStr);
```

`2020-01-01 < todayStr`, and `pastRelease` has no placeholder exclusion — so any row stuck at the 2020-01-01 placeholder with `release_status` upcoming/out_today is flipped to `released` **silently, with no alert**, in step 2 of `runReleaseStatusUpdate`. Step 3's `pricedUpcoming` (`.in("release_date", PLACEHOLDER_DATES)`, :1154) then re-queries `release_status IN (upcoming, out_today)` and can never see it. The #18 fix ("a game stuck at 2020-01-01 with a real price would never have been reached by this fallback at all... this closes the gap structurally") therefore closed nothing: the row still never reaches the out_now announcement path — it just exits via a different silent door. The session log's own live verification ("the full query still returns 0") is explained by this, not by the sweep having caught everything.

**Fix:** exclude `PLACEHOLDER_DATES` from `pastRelease`'s `.lt()` match (e.g. `.not("release_date", "in", ...)`) so placeholder-dated rows fall through to `pricedUpcoming` where the alert decision actually lives.

---

## MINOR

### m1. Followed-exemption sets unpaginated (scale-gated)
`src/lib/nintendo/ingest.ts:644` and `:1082-1085`, `src/app/api/cron/launch-burst-poll/route.ts:20-22`, `src/app/api/cron/health-check/route.ts:195` — all `user_game_follows.select("game_id")` with no `.range()`. Past 1,000 follow rows: the poll/releasingToday/pricedUpcoming followed-exemptions truncate (a followed-but-suppressed game silently stops polling/alerting) and burst-poll silently stops watching followed games past the cap. Harmless at 18 follows; the exact class that has bitten three times. Related: `ingest.ts:646,654` interpolates the entire id list into one `.or()` URL — at a few hundred follows the request URL itself will exceed limits and the *whole poll query errors out* (run returns 0 checked; health-check staleness would catch it within 30 min).

### m2. `getIGDBHype` direct-ID branch swallows 429s — the #7 "breaker poisons rows" class half-fixed
`src/lib/igdb.ts:232-242`:
```ts
  const res = await fetch("https://api.igdb.com/v4/games", { ... });
  if (!res.ok) return null;
```
Unlike its sibling `getIGDBRating` (`:321-324` throws on 429), a 429 here returns `null` → `batchGetHypeScores` counts the game as attempted-no-match → `sync-hype-scores/route.ts:70-78` permanently zeroes `igdb_hype` for a game that was never actually evaluated, and the circuit breaker never increments. Only reachable for games with `igdb_id` set but `igdb_hype` null (rating-synced then flipped upcoming) — narrow, display-only impact.

### m3. `isMonthOnlyDate`'s future-only clause makes the imprecise-date launch-alert guard time-of-day dependent
`src/lib/format.ts:48-54` (`return d.getDate() === lastDay && d > new Date();`) + `src/lib/nintendo/ingest.ts:1093`. After 12:00 UTC on a month-end day, that month's month-only sentinel no longer registers as imprecise, so `releasingToday`'s `isImprecise` suppression stops applying. Safe today only because the 10-min cron always processes (and flips) matching rows during the 07:00-12:00 UTC window at the start of the Pacific day; a 5-hour cron outage spanning that window on a month-end day would let month-only-dated games fire false "releases today" alerts. Encoding-detection and display semantics are conflated in one helper — `releasingToday` should use a time-independent "is this a month-end sentinel" check.

### m4. `release_date_set` alert renders sentinel dates with fabricated precision
`src/lib/nintendo/alerts.ts:308-311`: `subtext: 'Releasing ${formatShortDate(releaseDate)}'`. An IGDB year-only resolution (Dec-31 sentinel) produces "Releasing Dec 31, 2027" for a date the rest of the app carefully renders as "2027" (`formatReleaseDate`). In-app only today. Use `formatReleaseDate`, and consider not firing at all for year-only resolutions ("now has a release date" is untrue).

### m5. Release alerts can read "$0.00 on Nintendo eShop"
`src/lib/nintendo/alerts.ts:284-288` (`subtext: '${formatPrice(price, "")} on Nintendo eShop'`) with `formatPrice(0)` → "$0.00". The slate script created upcoming rows with `current_price: msrp or 0` (`fixes/sync_nintendo_first_party_slate.py:122,152-153`) — Fortune's Weave-class rows are $0/$0 (the founder's "Price TBA" fix was UI-only). On their release day, `releasingToday` (`ingest.ts:1108-1113`) passes the stale $0 into the alert. Burst-poll's out_now path is immune (it writes the live price first).

### m6. Sale-scan and named-event selects unpaginated (scale-gated)
`src/lib/nintendo/ingest.ts:835-840` (`endingSoon`, all on-sale rows) and `:931-935` (`allSaleGames`). Past 1,000 simultaneously-on-sale games, sale_ending alerts silently skip the overflow and named-event `games_count`/publisher stats undercount. ~205 on sale today.

### m7. `detect-trailers`' game matcher can anchor an alert to a suppressed/junk/duplicate SKU
`src/app/api/cron/detect-trailers/route.ts:164-182`: neither ilike lookup filters `is_suppressed`/`product_type`, and the partial match (`.ilike("title", '%${baseTitle}%').limit(1)`) is unordered — an arbitrary pick among a title family can select the suppressed Switch-2-Edition duplicate or a BUNDLE SKU instead of the base game, so the auto-published `announced` alert lands on a row whose followers are (by design) nobody, silently reaching no one. Distinct from the known-deferred insertAndDispatch-routing item. Add `.eq("is_suppressed", false)` + the NOT_JUNK or-clause and a deterministic order.

### m8. `checkMassDateWrites`' `updated_at` proxy still doesn't measure "written in 24h"
`src/app/api/cron/health-check/route.ts:149-154`: since price polling bumps `updated_at` on every polled row (~every 4.7h), the `.gte("updated_at", since)` clause matches essentially all `igdb`/`price-confirmed` rows, making the check "do >50 igdb-sourced rows share one exact date, ever." Detection of a genuine bulk mis-write still works; false-positive risk grows slowly as IGDB-resolved coverage accumulates games sharing real popular release dates. Informational-only check; fix by restricting on a real write signal when one exists.

### m9. "(English)" prefix filter — actual behavior and blast radius (scope B.5)
`src/lib/nintendo/transform.ts:4-8`:
```ts
const LANGUAGE_PREFIX = /^\((English|French|Spanish|German|Italian|Dutch|Japanese|Korean|Chinese|Portuguese|Russian)\)\s/i;
export function isEnglishGame(hit: AlgoliaHit): boolean {
  return !LANGUAGE_PREFIX.test(hit.title);
}
```
Applied at `ingest.ts:224` before any other filter, so any title whose *only* US listing carries a "(Language) " prefix — including "(English) ..." ones, despite the function's name implying it keeps English — never enters the catalog via sync, permanently. Known instances: Pokémon FireRed/LeafGreen (manually inserted 2026-08-05). Consequence for those manual rows: catalog sync will never refresh them (cover art, publisher, `editions`/`has_physical_release`, franchise, genre data all frozen at insert values; franchise NULL → see M4's fanout gap). Any future first-party re-release Nintendo lists the same way is silently invisible until a human notices. A more surgical filter would drop a prefixed listing only when an unprefixed sibling exists (the dedup pass already computes normalized title groups that could answer that).

### m10. Cron-caller 30s timeout exposure (scope B.6)
Routes with `maxDuration` far beyond cron-job.org's free-tier 30s: `sync-catalog` (300s — known/documented benign status-5 noise, excluded per instructions), `dispatch-notifications` (300s, `dispatch-notifications/route.ts:5`) and `weekly-digest` (300s). Dispatch currently completes fast, but a large backlog run (the durable `dispatched_at` design *invites* big catch-up runs) will exceed 30s: work completes server-side but cron-job.org logs status 5 → health-check emails "Dispatch Notifications last run failed" — false-alarm noise during exactly the recovery the design intends. Return-early-and-process-async remains the documented eventual fix; until then expect the noise.

---

## Unpaginated-select sweep summary (games/alerts/user_game_follows/notification_log, src/)

Findings above cover the consequential ones: `ingest.ts:265` (M3), `:475/:483/:545/:558/:572` (M2), `:644/:1083` + `launch-burst-poll:21` + `health-check:195` (m1), `:835` /`:931` (m6), `:1196` (C1), `dispatch.ts:137/:140/:180` (M9). Remaining unbounded selects are per-user/per-entity scoped and safe at any plausible cardinality (`queries.ts:337` per-franchise, `:344` `.in(ids)` caller-bounded, `:375/:552` per-user follows, `:464` per-game alert display — cosmetic truncation at >1,000 alerts for one game), plus `weekly-digest:75-80` (`.in(allGameIds)` — bounded by the paginated follows list, though the `.in()` URL length will break before 1,000-row truncation matters).

## Recent-changes review (last ~3 days)

- **No-em-dash sweep (`6669ddf`)**: alert copy changes only; dedup is keyed on (game_id, type)/(discount, price)/day-bucket, never headline text — no dedup regression. Side effect: game-detail's identical-(type,headline,subtext) collapse won't merge pre/post-sweep runs of the same alert (cosmetic).
- **Nintendo IP tiers (`a91ebd9`, `947c6d4`)**: `getNintendoIpTier`/`isNintendoFirstParty` confirmed referenced only from `queries.ts` sorts and `feed/page.tsx` — display-only, no alert-path impact.
- **Alert source chips (`72ea740`)**: `getAlerts` plumbing correct; as already flagged to the founder, franchise-sourced alerts still never enter the feed (chip unrenderable) — product question, not re-reported.
- **Slate script (`953ed8b`)**: M4 above.
- **Spotify pill / Watch rename / Home rebuild**: UI-only; no alert-path or query-filter regressions found in the touched files.
