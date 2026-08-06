# Blippd Audit — Client Data Layer + Frontend (2026-08-05)

Read-only audit of scope (A) client data layer and (B) frontend pages/components/copy. Excludes items already documented as known/deferred in CLAUDE.md and docs/AUDIT-2026-08-03.md.

**Totals: 1 critical · 7 moderate · 9 minor** (plus a "verified clean" section at the end).

---

## CRITICAL

### C1. Alert dismissal is silently lost if the user navigates away during the undo window

**Severity:** Critical (rubric: silent no-op of a user action; real-world impact bounded — the alert reappears rather than data being corrupted)

**File:** `src/app/alerts/page.tsx:80-84` (with `:97-113`, `:139-147`, `:164-167`)

```tsx
useEffect(() => {
  return () => {
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
  };
}, []);
```

The dismissal design (documented in CLAUDE.md "Bulk Dismissal / Alert Feed UX") deliberately delays the DB write until the 5s undo window closes — `dismissWithUndo` removes the alert from local state immediately and schedules `commitPending` via `setTimeout`. But the unmount cleanup **clears the timer without committing**. Any navigation within 5 seconds of a dismiss (or within the staggered exit animation + 5s of "Clear all") silently drops the write: the user watched the alert disappear, but `user_alert_status.dismissed` is never set, and the alert is back on the next visit.

This is not just an edge case: the most natural post-dismiss action — tapping another alert to open its game page — unmounts the alerts page. Same for "Clear all" followed by a bottom-nav tap. There is also no `beforeunload`/`pagehide` handler, so tab close does the same.

`handleDismiss` compounds it slightly: it delays `dismissWithUndo` by another `EXIT_ANIM_MS` (250ms) via a bare `setTimeout` (`:139-146`), so navigation during the exit animation loses the dismissal before the undo window even starts.

**Fix:** in the unmount cleanup, commit instead of discarding: `if (pendingTimer.current) { clearTimeout(...); if (pendingRef.current) commitPending(pendingRef.current.alerts); }` (needs a ref mirror of `pending` since the cleanup closure is stale). Optionally add a `pagehide` listener doing the same. The undo UX is unchanged; only the abandonment path changes from "silently un-dismiss" to "commit what the user did."

---

## MODERATE

### M1. Upcoming page loading flag uses `&&` across three queries — partial-content and empty-state flashes

**Severity:** Moderate (visible on a primary page; the exact "empty-state flash" class from audit #16, reintroduced by the Phase-4 sectioning rebuild)

**File:** `src/app/feed/page.tsx:122`

```tsx
const loading = releasesLoading && upcomingLoading && unannouncedLoading;
```

The skeleton hides as soon as **any one** of the three queries resolves, not when all have. Consequences:

- Sections pop in one at a time (Nintendo rail / Coming Soon appear after Out Now), causing layout jumps on every load.
- If `getRecentReleases` resolves first and `outNow` is empty, the page hits the `outNow.length === 0 && !hasComingSoon` branch (`:249`) and flashes the full-page "Nothing yet" empty state while the other two queries are still in flight.

**Fix:** `const loading = releasesLoading || upcomingLoading || unannouncedLoading;`

### M2. `getUnreadAlertCount` fetches the user's *entire* read-status history unscoped — PostgREST 1,000-row cap will permanently corrupt the badge

**Severity:** Moderate (not harming at today's row counts; the identical unbounded-select class already bit this repo three times server-side — sitemap, weekly-digest, catalog-sync)

**File:** `src/lib/queries.ts:651-655`

```ts
supabase
  .from("user_alert_status")
  .select("alert_id")
  .eq("user_id", userId)
  .eq("read", true),
```

The query has no `.in("alert_id", alertIds)` scope and no `.limit()`, so it silently truncates at PostgREST's 1,000-row default once a user accumulates >1,000 read statuses (each "Mark all read" writes up to 50 rows; `user_alert_status` rows are also created at dispatch). Once truncated — with no guaranteed ordering — recently-read alerts can fall outside the returned set, so `alertIds.filter((id) => !readIds.has(id))` counts them as unread forever: a phantom unread badge on the bottom nav that never clears.

**Fix:** scope the status query to the 50 alert ids actually being counted (make the two queries sequential, or fetch statuses with `.in("alert_id", alertIds)` after the alerts query resolves). That also caps the response at 50 rows regardless of history size.

### M3. `getUserProfile` swallows its Supabase error and conflates "query failed" with "not onboarded" — Home can bounce an onboarded user back to /onboarding

**Severity:** Moderate (documented as "follow-up hardening worth doing, not done" on 2026-08-02; still absent, and the recent Home rebuild added a second consumer whose behavior depends on it)

**File:** `src/lib/queries.ts:523-533`

```ts
export async function getUserProfile(supabase: Client, userId: string): Promise<...> {
  const { data } = await supabase
    .from("user_profiles")
    .select("console_preference, onboarding_completed")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    consolePreference: data?.console_preference ?? null,
    onboardingCompleted: data?.onboarding_completed ?? false,
  };
}
```

`error` is never destructured. Any failure (transient network blip, future RLS/schema regression — the exact class that hid the onboarding loop for five months) returns `onboardingCompleted: false` indistinguishably from a real "not onboarded." Consumer at `src/app/home/page.tsx:56-58`:

```tsx
getUserProfile(supabase, user.id).then(({ onboardingCompleted }) => {
  if (!onboardingCompleted) router.replace("/onboarding");
});
```

A failed profile read on Home mount redirects a fully-onboarded user into /onboarding. (Onboarding's own check usually bounces them back if the next read succeeds, producing a redirect flicker; if the failure persists they're stuck re-onboarding.) The auth callback (`src/app/auth/callback/page.tsx:18-19`) has the same dependency.

**Fix:** destructure `error`; on error either `console.error` + return a `{ ok: false }` marker the callers treat as "don't redirect," or throw so callers' catch paths handle it. Failing open ("assume onboarded on error") is the safer direction for the Home redirect.

### M4. Franchise pages have no `is_suppressed` / `product_type` filter — suppressed junk (DLC kits, bundles, delisted rows) renders on a user-facing browse surface

**Severity:** Moderate

**File:** `src/lib/queries.ts:336-340`, consumed by `src/app/franchise/[name]/FranchiseDetailClient.tsx:24-27`

```ts
export async function getGamesByFranchise(supabase: Client, franchiseName: string): Promise<Game[]> {
  const { data, error } = await supabase.from("games").select("*").eq("franchise", franchiseName);
```

Every other discovery surface got the junk filter during the 2026-08-03 audit passes (`getGamesOnSale`, `getRecentReleases`, `getUpcomingGamesSoon`, `getUnannouncedUpcomingGames`, `searchGames`, `/deals`), but the franchise page was missed. After Phase 0's sweep suppressed 600+ ADD_ON_CONTENT/BUNDLE rows, `is_suppressed` became a load-bearing "never show in discovery" flag — yet a Monster Hunter or Dragon Quest franchise page still lists suppressed rows like "Monster Hunter Rise Deluxe Kit" (confirmed `is_suppressed=true` in the session logs) in its "ALL GAMES"/"ON SALE" sections, and counts them in the "N on sale" header line (`FranchiseDetailClient.tsx:59, 103-105`). These are exactly the two franchises the founder follows.

**Fix:** add `.eq("is_suppressed", false).or("product_type.is.null,product_type.not.in.(ADD_ON_CONTENT,BUNDLE)")` to `getGamesByFranchise`, mirroring `getRecentReleases`'s null-lenient pattern. (Follow-exemption isn't needed here — the page is a browse surface, not the user's alert feed.)

### M5. `getReleaseLabel` renders "Out in -N days" for upcoming games whose date has passed

**Severity:** Moderate (nonsense copy on the primary card component; pre-existing shape, but the 30-day window extension in `5e5814c` made it far more likely to be hit)

**File:** `src/components/GameCard.tsx:274-279`

```tsx
if (daysUntil === 0) return "Releases today";
if (daysUntil === 1) return "Out tomorrow";
// A month of countdown, matching the feed page's This Week/This Month
// buckets ...
if (daysUntil <= 30) return `Out in ${daysUntil} days`;
```

`daysUntil` (`getDaysUntil`) goes negative for past dates, and `daysUntil <= 30` includes every negative value. A game with `release_status: "upcoming"` and a `release_date` in the past — a real, documented state in this catalog (delayed/unpriced titles like the Mina the Hollower case; status only flips when the row is re-processed with a price) — renders "Out in -5 days". The Coming Soon page can't route such a row into a visible bucket (query filters `gte today`), but GameCard is also used for search results, watchlists, Home, and profile, where no date filter protects it.

**Fix:** `if (daysUntil > 1 && daysUntil <= 30) return ...`, with a `daysUntil < 0` branch returning `null` (or "TBA") before the countdown branches.

### M6. Onboarding completion writes still discard the Supabase error object

**Severity:** Moderate (the precise bug class that caused the months-long onboarding loop; flagged 2026-08-02 as hardening "not done in this session," still not done)

**File:** `src/app/onboarding/page.tsx:139-142` (`handleFinish`) and `:157-160` (`handleSkip`)

```tsx
await supabase
  .from("user_profiles")
  .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
  .eq("user_id", user.id);
setStep("done");
```

`.update()` does not throw — errors come back in the result object, which is never read. If this write fails (schema mismatch, RLS regression, missing row), the user sees the "done" step and gets redirected to /home as if it succeeded, and Home's re-check bounces them back into onboarding — the exact silent loop from March–August 2026, still invisible if it ever regresses. The `catch` block is effectively unreachable for this failure mode (only `markGameOwned` inside `Promise.allSettled` could throw, and `allSettled` never rejects).

**Fix:** `const { error } = await supabase...; if (error) console.error("onboarding_completed write failed:", error);` — even just logging makes the next regression findable. Same for `handleSkip`.

### M7. Alerts page flashes the signed-out "No alerts yet" empty state during auth load

**Severity:** Moderate (the audit-#16 "/alerts flashes empty pre-auth" item; the guard added since only covers the sign-in-prompt branch, and the page was rebuilt twice in the last 3 days without closing this)

**File:** `src/app/alerts/page.tsx:59-62` with `:299` and `:315-336`

```tsx
const { data: fetchedAlerts, loading: alertsLoading, ... } = useSupabaseQuery(
  (sb) => authLoading ? Promise.resolve([]) : getAlerts(sb, user?.id),
  [user?.id, authLoading]
);
```

While `authLoading` is true the query resolves `[]` almost instantly, so `alertsLoading` goes false before `onAuthStateChange` fires. The early return at `:220` only triggers once `!authLoading && !user`, so during auth load the page falls through to `isEmpty` and renders the **signed-out** empty state ("No alerts yet" / "Sign in and follow games…" / a "Sign in to get alerts" button) for every visitor — including a signed-in user about to see their alerts — until auth resolves and the refetch swaps in the skeleton. A second smaller variant: the signed-in empty state (`:326`) reads `followedGameIds.size` without gating on FollowContext's `loading`, so it can briefly say "Watching 0 games for you."

**Fix:** render the skeleton when `alertsLoading || authLoading` (`:299`), and gate the "Watching N games" line on FollowContext `loading` the way Home's `RadarStatus` already does (`src/app/home/page.tsx:160`).

---

## MINOR

### m1. Leftover "Follow/Following" brand-verb copy (rename to Watch/Watching was "app-wide" per the session log, but these were missed)

All user-visible; component names excluded by design:

- `src/app/feed/page.tsx:285` — On the Horizon card, built the same day as the rename: `"No date yet. Follow to know the minute it gets one, and the minute it launches."`
- `src/app/home/page.tsx:197` — `"Sign in to follow games and get alerted the moment prices drop."`
- `src/app/home/page.tsx:226` — `"Follow games to track prices and get alerts when they go on sale."`
- `src/app/alerts/page.tsx:229` — `"Follow games and get notified when prices drop or sales go live."` (and `:327`, though that branch is dead — see m7)
- `src/app/profile/page.tsx:149` — stats label `"Following"`; `:219` — `"No games followed yet"`
- `src/app/settings/page.tsx:222` — section header `"FOLLOWING"` (its own stat label on `:227` already says "watching")
- `src/app/layout.tsx:32,40` — site meta description: `"Follow games, get instant price drop alerts…"` (Google snippet copy)
- `src/app/game/[slug]/page.tsx:44` — upcoming-game meta description: `"Follow on Blippd to get notified…"`
- `src/app/vs/nt-deals/page.tsx:34` — comparison row label `"Follow limit (free)"`

### m2. FollowContext: unfollowing a game does not clear its entry in `targetPriceMap`

**File:** `src/lib/FollowContext.tsx:99-109` — the unfollow branch deletes from `followedGameIds` and `gamePrefsMap` but not `targetPriceMap`. Re-following the same game in the same session shows the old target price ("Target $X" progress bar on GameCard via `getTargetPrice`, `TargetPriceInput` shows "Alert me at $X") even though the DB row was deleted and re-created with `target_price: null` — so no alert will actually fire at that price until the user re-sets it or reloads. Fix: `setTargetPriceMap` delete alongside the prefs delete.

### m3. Signed-out /home shows two solid-green CTAs in one view

**File:** `src/app/home/page.tsx:147-153` (header "Sign in" pill) and `:199-204` ("Sign in to get started") — violates the locked "max one solid-green element per view" rule from the 2026-08-04 design pass. Suggest making the header pill the outlined variant when the body CTA is present.

### m4. Remaining sub-44px touch targets in recently-touched components

- `src/components/SearchBar.tsx:51-62` — the clear-search "×" button is a bare `w-4 h-4` icon (~16px) with no padding/min-size (the Phase-3 pass fixed the collapsed search button but not this).
- `src/components/GameCard.tsx:153-166` — "I own this" inline button: `px-2 py-1 text-[10px]` ≈ 26px tall, rendered on Home's Watching list.
- `src/app/profile/page.tsx:122-131` — settings gear link `w-9 h-9` (36px).
- `src/app/game/[slug]/GameDetailClient.tsx:266-271` — library "Remove" text button, no min-height.

### m5. Dead signed-out branches in the alerts page render path

**File:** `src/app/alerts/page.tsx:322-336` — the `user ? … : "No alerts yet"` / `!user && <Link …>Sign in to get alerts</Link>` branches inside the main render are unreachable in steady state because `:220` early-returns for `!authLoading && !user`; they only ever render during the auth-load flash (M7). Once M7 is fixed they are pure dead code; the related global-preview branch in `getAlerts` (`src/lib/queries.ts:406` comment "If not logged in, show recent global alerts as a preview") likewise has no rendering consumer — the anonymous fetch runs (unfiltered by `is_suppressed`/`product_type`, so it would show junk-game alerts if ever surfaced) and is thrown away.

### m6. `getAlerts` applies the dismissed filter after `limit(50)`

**File:** `src/lib/queries.ts:393-397` (limit) vs `:429-430` (client-side dismissed filter). A user who dismisses heavily sees fewer than 50 alerts, and once the 50 most recent are all dismissed the feed reads fully empty even though older undismissed alerts exist. Fine at POC volume; will read as "my alerts disappeared" for a heavy user. Fix eventually by excluding dismissed ids in the query (join or `not.in`) before limiting.

### m7. BottomNav unread badge never updates after mark-read (documented #16 residue, still open)

**File:** `src/components/BottomNav.tsx:12-15` — `getUnreadAlertCount` refetches only on `user?.id` change; marking alerts read on /alerts doesn't invalidate it, so the badge is stale until a full reload. Pre-documented in the 2026-08-02 audit (#16 "unread badge never clears until hard reload"); listed here only because BottomNav was touched in `72ea740` without addressing it. (M2 above is the *correctness* half of the same query.)

### m8. Non-pill text links remain on release-time and not-found paths

**File:** `src/app/games/[slug]/release-time/page.tsx:128-130` (`&larr; {game.title}` underlined text link), `src/app/game/[slug]/GameDetailClient.tsx:67-72` ("← Back to Home" underlined). The founder's 2026-08-05 rule was "nothing should look like a website link" (applied to game-detail's action links); these back-nav text links are the same pattern one page away. Cosmetic consistency call for the founder.

### m9. `handleClearAll` clears alerts hidden by the active filter

**File:** `src/app/alerts/page.tsx:149-168` — with a filter active (e.g. "Price Drops"), "Clear all" dismisses **all** alerts including those not currently visible (hidden ones get `delay 0` in the stagger map, so this is coded deliberately). The button label supports the current behavior; flagging only because a filtered user may expect visible-only clearing and the dismissal is destructive-ish (5s undo). Founder taste call, not a bug.

---

## Verified clean (no findings — confirming scope items checked)

- **Em-dash rule (B1):** grep of `—` across `src/` found zero violations in user-facing strings — all hits are code comments, server-side `console.*` logs, regex character classes, or the sanctioned bare "—" missing-price data glyph (`src/lib/format.ts:2`, `ReleaseTimeClient.tsx:140`). Email templates (`templates.ts`, `batch/digest/launch-digest-template.ts`, `email-shell.ts`) are clean; the launch-digest test now asserts the *absence* of the old em-dash string.
- **Spotify pill language (B3):** `FollowButton`, `FranchiseFollowButton`, `ReleaseTimeCta`, onboarding console pills, and the landing CTAs all conform (rounded-full, transparent bg, hairline border, active state via border/text color, `active:scale-95`). Solid green appears once per view except the signed-out-Home case (m3).
- **getAlerts scope vs. docs (A5):** confirmed current behavior matches the documented open product question — the query filters to directly-followed game ids (`queries.ts:400-405`), a franchise-only follower gets `return []` (`:402-404`), and the `sourceLabel` franchise branch (`:440-441`) plus AlertCard's "via {franchise}" chip (`AlertCard.tsx:175-179`) are plumbing-complete but currently unreachable. No drift from the docs; the founder decision is still the blocker.
- **FollowContext object churn (A4):** the provider value is `useMemo`'d and every function is `useCallback`'d (`FollowContext.tsx:271-295`) — the audit-#13 "new object every render" defeat is fixed. Residual: any follow/pref change necessarily produces a new context value, re-rendering all `useFollow` consumers (every GameCard) — inherent to the context approach, acceptable at this scale.
- **Hydration hazards (B8):** `ReleaseTimeClient` gates all timezone/countdown rendering behind a `mounted` flag with an SSR-safe "—" placeholder; countdown state starts `null` (client-effect only). `/deals` and `/` are pure server components (no hydrating client code around `formatFreshness`), so the ISR-stale stamp is a documented staleness caveat, not a mismatch. `RadarStatus`/alerts freshness are client-only. No mismatch vectors found.
- **RLS-needing new access patterns (A2):** the recent queries (`getLastPriceCheckTimestamp`, `getUnannouncedUpcomingGames`, alert source-chip join `user_franchise_follows → franchises(name)`) are all SELECTs against tables with confirmed SELECT policies; no new client-side `.update()`/`.upsert()` targets were added beyond the four tables verified in the 2026-08-02 RLS sweep.
- **Orphaned components (B7):** every file in `src/components/` has at least one importer (checked all 23); `/upcoming` is an intentional redirect stub to `/feed`.
- **Middleware, supabase client singleton, useSupabaseQuery race-guarding:** all sound; `useSupabaseQuery`'s `requestId` guard correctly discards stale responses, and the middleware matcher exclusions are as documented.
