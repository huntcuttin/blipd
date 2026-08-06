# Audit: Notification/Email Delivery + Security/Auth (2026-08-05)

Read-only audit of `/Users/huntcuttin/Documents/GitHub/blipd`. Scope: (A) notification/email delivery, (B) security/auth. Excludes items documented as known/deferred in CLAUDE.md and docs/AUDIT-2026-08-03.md.

**Totals: 2 critical, 3 moderate, 5 minor.**

---

## CRITICAL 1 — Resend quota-exceeded errors (`daily_quota_exceeded` / `monthly_quota_exceeded`) do not trip the rate-limit breaker; on a quota-exhausted day every pending alert is attempted, fails, and is permanently marked dispatched

**Severity:** critical (alert correctness — silent permanent loss of alerts, at exactly the moment the infra docs predict it)

**Files:** `src/lib/notifications/rate-limit.ts:24-26`, `src/lib/notifications/dispatch.ts:334,354`, `src/lib/notifications/email.ts:125-129`

**Evidence:**

`rate-limit.ts:24-26`:
```ts
export function isResendRateLimitError(error: { name?: string } | null | undefined): boolean {
  return error?.name === "rate_limit_exceeded";
}
```

Resend's SDK (`node_modules/resend/dist/index.d.cts`) defines three distinct 429-class error names:
```
RESEND_ERROR_CODE_KEY = ... | 'monthly_quota_exceeded' | 'daily_quota_exceeded' | 'rate_limit_exceeded' | ...
```

CLAUDE.md's own Infrastructure Limits section documents the free tier as "a hard 429 block (`daily_quota_exceeded`/`monthly_quota_exceeded`)" and predicts the cap "breaks on the *best* day" (big sale + many users).

**Description:** `isResendRateLimitError` only matches `rate_limit_exceeded` (the per-second throttle). When the daily or monthly quota is exhausted, every `resend.emails.send` returns an error whose name is `daily_quota_exceeded` — the breaker never trips, `dispatchRecentAlerts` grinds through the entire pending set making a doomed API call per user per alert, each send is logged "failed", and then `completeWork()` runs for every alert (`dispatch.ts:334` and `:354`), so `dispatched_at` is set on all of them (`dispatch.ts:361-374`). Because durable dispatch only re-fetches `dispatched_at IS NULL` rows, none of those alerts is ever retried after the quota resets. The exact scenario the durable-dispatch redesign exists for (a big sale day blowing past 100 emails) instead converts the entire day's alert backlog into permanent misses, silently.

**Suggested fix:** widen the check to all three quota/rate names (`["rate_limit_exceeded", "daily_quota_exceeded", "monthly_quota_exceeded"].includes(error?.name ?? "")`). With the breaker tripping, the existing "stop the run, leave un-attempted alerts undispatched" machinery already does the right thing (subject to Critical 2 below for the in-flight alert).

---

## CRITICAL 2 — "Attempted" counts as done: an alert whose sends fail (including the very alert that trips the rate limit) is still marked dispatched and never retried; `sendAlertToUsers` ignores the breaker between its internal batches

**Severity:** critical (alert correctness — contradicts the documented durable-dispatch guarantee)

**Files:** `src/lib/notifications/dispatch.ts:323-335`, `src/lib/notifications/send.ts:104-121`

**Evidence:**

`dispatch.ts:323-334` — the breaker is only consulted *between* work items, and `completeWork` runs unconditionally after the send:
```ts
for (const { payload, userIds } of Array.from(individualByAlert.values())) {
    if (isRateLimited()) { ...break; }
    ...
    const sent = await sendAlertToUsers(userIds, payload);
    dispatched += sent;
    if (sent < userIds.length) {
      console.warn(`  ${userIds.length - sent}/${userIds.length} failed for alert ${payload.alertId}`);
    }
    completeWork(payload.alertId);
}
```

`send.ts:107-119` — the per-alert user loop has no `isRateLimited()` check between its batches of 10:
```ts
for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((userId) => sendAlert(userId, payload))
    );
    ...
    if (i + BATCH_SIZE < userIds.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
}
```

Same pattern in Phase 4: a failed digest still completes its alerts' work (`dispatch.ts:347-354` — `ok === false` only logs a warning; `for (const id of alertIds) completeWork(id);` runs regardless).

**Description:** Suppose one alert has 50 followers and Resend starts returning 429 partway through. `markRateLimited()` fires inside `sendEmailAlert`, but `sendAlertToUsers` keeps hammering through the remaining batches of that same alert (each failing), then `completeWork` marks the alert dispatched. Every follower whose send failed gets a "failed" `notification_log` row and is never retried — the durability guarantee ("a rate-limit stop mid-run correctly leaves in-flight alerts undispatched for retry next tick", CLAUDE.md session log 2026-08-04) holds only for alerts *after* the one that hit the limit, not for the one in flight. More generally, *any* transient failure (Resend 500, network blip) at a send site is permanent for that user: attempted-and-failed is treated identically to attempted-and-sent for `dispatched_at` purposes, and there is no failed-send retry lane anywhere. Per the severity rubric ("alert correctness / silent no-op"), critical; at 1 real user today the practical exposure is small, but this is the load-bearing mechanism for the launch scenario.

**Suggested fix:** (a) check `isRateLimited()` between batches inside `sendAlertToUsers` (and before each recipient in the digest path), and (b) when a work item's sends were cut short or failed on a rate-limit/quota error, skip its `completeWork` so the alert stays undispatched for the next tick — the existing `alreadySentPairs` + 24h dedup already make re-runs safe for the users who did get the email.

---

## MODERATE 1 — Audit #10's push-subscription endpoint-hijack concern is NOT fixed: `onConflict: "endpoint"` still reassigns `user_id`

**Severity:** moderate (security; 0 push subscriptions in prod today, and an endpoint URL is high-entropy, so exploitability is low — but the documented concern is still open)

**File:** `src/app/api/push/subscribe/route.ts:26-31`

**Evidence:**
```ts
const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
}, { onConflict: "endpoint" });
```

**Description:** Any authenticated user who learns another user's push endpoint URL can POST it and silently reassign that subscription row to themselves: the victim's browser then receives the attacker's alerts (content leak to the wrong device) and the victim silently stops receiving their own (silent no-op of a user action). This is verbatim the concern in audit #10 ("endpoint hijack possible via `onConflict: "endpoint"` reassigning user_id"); the 2026-08-02 fixes covered dedup logging, sign-out cleanup, and the success-count bug, but not this. The DELETE handler (`route.ts:51`) does scope by `user_id` correctly — only the upsert path is exposed.

**Suggested fix:** before upserting, select the existing row for that endpoint and reject (409) if it belongs to a different `user_id`; or upsert with `ignoreDuplicates: true` and only update rows already owned by the caller.

---

## MODERATE 2 — Digest sends have no secondary dedup layer; combined with a fail-open `alreadySentPairs` query and a log-only `dispatched_at` update failure, duplicate digest emails are possible

**Severity:** moderate ("never fire a duplicate" is a Bible non-negotiable; requires a failure coincidence to manifest)

**Files:** `src/lib/notifications/send-batch.ts:27-78`, `src/lib/notifications/dispatch.ts:147,158-160,369-373`

**Evidence:**

`dispatch.ts:147` — the sent-log query failing does not abort; the run proceeds with an empty dedup set:
```ts
if (sentLogsResult.error) console.error("Failed to fetch sent logs:", sentLogsResult.error.message);
```

`dispatch.ts:371-372` — a failed `dispatched_at` write is only logged, leaving already-sent alerts in the undispatched pool:
```ts
const { error } = await supabase.from("alerts").update({ dispatched_at: now }).in("id", chunk);
if (error) console.error("Failed to mark alerts dispatched:", error.message);
```

`send-batch.ts` `sendDigest` — sends immediately after the suppression check; unlike `sendEmailAlert` (which re-checks `notification_log` for a prior "sent" row per user+alert within 24h, `email.ts:82-97`), there is no per-user dedup query before a digest goes out.

**Description:** Individual emails are protected twice (the run-level `alreadySentPairs` set and `sendEmailAlert`'s own 24h `notification_log` check). Digests are protected once. If a digest is sent but its alerts fail to get `dispatched_at` (update error), the next run re-fetches them; normally `alreadySentPairs` filters those users out — but that query itself fails open (`:147`), so a transient PostgREST error on the sent-logs fetch in a subsequent run re-sends the identical digest. The equivalent failure for an individual send is absorbed by the 24h check; the digest path has no such backstop.

**Suggested fix:** either abort the run when `sentLogsResult.error` is set (symmetric with the `gameFollowsResult.error` abort at `:152-155`), or add the same 24h `notification_log` pre-check inside `sendDigest` for its alertIds.

---

## MODERATE 3 — `getFranchiseByName` passes a URL-derived string into `.ilike()` unescaped (the same bug class audit #29 fixed in detect-trailers)

**Severity:** moderate-to-minor (input validation; read-only public data, worst case wrong-row match or query error — no write path)

**File:** `src/lib/queries.ts:357-362`

**Evidence:**
```ts
export async function getFranchiseByName(supabase: Client, name: string): Promise<Franchise | null> {
  // Try exact match first, then case-insensitive
  const { data, error } = await supabase.from("franchises").select("*").ilike("name", name).maybeSingle();
```

**Description:** `name` comes from the `/franchise/[name]` URL segment. `%` and `_` are ILIKE wildcards, so `/franchise/%25` (i.e. `%`) matches every franchise; `maybeSingle()` then errors on multi-row results (returns null — a soft 404) or, for a crafted pattern matching exactly one unintended row, renders the wrong franchise page. `searchGames` in the same file escapes correctly (`queries.ts:264`: `query.replace(/[%_]/g, "\\$&")`), and detect-trailers was fixed for exactly this in audit #29 — this call site was missed.

**Suggested fix:** escape with the same `replace(/[%_]/g, "\\$&")` before the `.ilike()`, or use `.eq()` + a second `.ilike()` on the escaped value for the case-insensitive fallback.

---

## MINOR 1 — HTML-escaping asymmetry across email templates: only the launch digest escapes game titles

**Severity:** minor (malformed markup, not XSS — email clients neuter scripts; titles come from Nintendo's catalog)

**Files:** `src/lib/notifications/templates.ts:74` (and every `${payload.gameTitle}` in that file), `src/lib/notifications/batch-template.ts:39` (`${game.title}`), `src/lib/notifications/digest-template.ts:37` (`${game.title}`) vs `src/lib/notifications/launch-digest-template.ts:34` (`${escapeHtml(game.title)}`)

**Evidence:** `email-shell.ts:8-11` itself documents the reason escaping exists: "Game titles come from Nintendo's catalog and routinely contain `&` (and occasionally angle brackets), which produce invalid markup when dropped into a template raw." Yet `templates.ts`, `batch-template.ts`, and `digest-template.ts` interpolate `payload.gameTitle` / `game.title` / `payload.headline` raw into both subject-adjacent HTML and body markup.

**Suggested fix:** import `escapeHtml` from `./email-shell` at the three remaining template files and wrap title/headline interpolations.

---

## MINOR 2 — `supabase/.temp/` is gitignored but still tracked; working tree shows it modified on every CLI run

**Severity:** minor (hygiene / info disclosure: pooler host + project ref, both already semi-public; no credentials)

**Evidence:** `git ls-files supabase/.temp` returns 8 tracked files including `pooler-url` containing `postgresql://postgres.cigsitwnhfnndtidrjjo@aws-1-us-east-1.pooler.supabase.com:5432/postgres`; `.gitignore:42` has `/supabase/.temp/`; current `git status` shows `M supabase/.temp/cli-latest`.

**Description:** Audit #32's fix added the ignore rule but never ran `git rm --cached` on the already-tracked files, so they remain in the repo (and keep showing as dirty). Incomplete execution of a documented fix.

**Suggested fix:** `git rm -r --cached supabase/.temp` and commit.

---

## MINOR 3 — Unhandled `request.json()` on POST routes returns raw 500s

**Severity:** minor (hygiene)

**Files:** `src/app/api/push/subscribe/route.ts:21` (`const subscription = await request.json();`), `:50` (`const { endpoint } = await request.json();`), `src/app/api/admin/trailers/[id]/route.ts:42` (`const body = await request.json();`)

**Description:** A malformed JSON body throws before validation and surfaces as an unhandled 500 instead of a 400. No security impact (all three sit behind auth guards); just noise in error logs and imprecise client behavior.

**Suggested fix:** wrap in try/catch and return 400 on parse failure.

---

## MINOR 4 — `sendPushToUsers` is dead code

**Severity:** minor (hygiene)

**File:** `src/lib/notifications/push.ts:60-67`

**Evidence:** `grep -rn "sendPushToUsers" src/` finds no caller outside its own definition.

**Description:** The bulk push helper (which also has no `notification_log` integration) is exported but unused — if a future named-sale push blast wired it up naively it would bypass logging/dedup. Delete it or leave a comment noting the logging gap.

---

## MINOR 5 — `sale_ending` copy vs the (recommended) urgency-line policy, and a "soon" fallback

**Severity:** minor (copy policy is documented as a recommendation, not a locked rule)

**File:** `src/lib/notifications/templates.ts:148,161`

**Evidence:**
```ts
const endStr = payload.saleEndDate ? formatShortDate(payload.saleEndDate) : "soon";
...
<p ...>Sale ends ${endStr}. Don't miss it</p>
```

**Description:** The Bible's urgency-line recommendation says end dates should appear as a date, never as generic urgency, and "no date → say nothing." When `saleEndDate` is null (unlikely for `sale_ending` alerts, which are generated from a known end date, but the fallback exists), the body renders "Sale ends soon. Don't miss it" — generic urgency with no date. "Don't miss it" is also a mild imperative urgency line in the body. Founder's call; flagging because the policy text exists.

---

## Verified clean (scope checklist, no findings)

- **Cron auth:** all 11 cron routes check `CRON_SECRET` bearer identically (e.g. `dispatch-notifications/route.ts:8-11`); `weekly-digest/route.ts:43-45` included. `!secret` fails closed.
- **Webhook:** `api/webhooks/resend/route.ts:61-68` verifies svix signatures on the raw body; unsigned → 401; unset secret → 500 (fails closed). Deliberate 200-on-processing-error is commented and reasonable.
- **Admin:** page (`admin/trailers/page.tsx:39-42`) and API (`api/admin/trailers/[id]/route.ts:9-12,37-40`) both read `ADMIN_EMAIL` from env and use `getUser()`.
- **Middleware:** uses `getUser()` not `getSession()` (`middleware.ts:30`); matcher excludes `api/` (all API routes self-authenticate) and static assets only.
- **Auth callback:** no open redirect — all redirect targets are hardcoded paths; error codes go through `encodeURIComponent` into a query param only (`auth/callback/page.tsx:33`).
- **Service-role isolation:** every `admin-client` importer is a server component, API route, or server-side lib; zero `"use client"` modules import it; `SUPABASE_SERVICE_ROLE_KEY` referenced only in `src/lib/nintendo/admin-client.ts:8`.
- **Secrets scan:** no `sb_secret_`/`sbp_`/JWT/Resend-key literals in tracked files beyond the known CLAUDE.md cron-job.org key. `fixes/*.py` all read keys from `.env.local` at runtime; the hardcoded Algolia app-id/key in `fixes/sync_nintendo_first_party_slate.py:35-36` is Nintendo's own public search key, not a Blippd credential.
- **Suppression enforcement:** `isEmailSuppressed` checked before all 5 user-facing Resend sends — `email.ts:109` (individual), `send-batch.ts:51` (price + launch digests via shared `sendDigest`), `send-batch.ts:126` (named-sale blast), `weekly-digest/route.ts:108`. Fail-open semantics correct (`email.ts:34-47`). Admin/health-check sends intentionally exempt (fixed admin address).
- **Resend `{data,error}` checked at every send site:** `email.ts:125`, `send-batch.ts:65,133`, `weekly-digest/route.ts:151`, `admin-alert.ts:24`, `health-check/route.ts:298`.
- **Franchise-fanout junk gate:** present — `dispatch.ts:38-41` (`isJunkForFanout`: `is_suppressed` or `ADD_ON_CONTENT`/`BUNDLE`), applied at `:213` to franchise resolution only; direct follows exempt per Bible.
- **Batching:** `BATCH_THRESHOLDS` price=5, launch=5 (`batching.ts:46-49`); launch/price digests never merge; the one-alert-spans-multiple-users work counter (`dispatch.ts:309-315`) is arithmetically correct (verified: mixed individual+digest alerts bump once per work item and complete symmetrically); no stuck-forever path found — zero-recipient alerts are marked immediately (`dispatch.ts:361-363`).
- **push.ts semantics:** `attempted`/`succeeded` split correct; `send.ts:72-77` only logs `web_push` to `notification_log` when `attempted > 0` — the spurious-failed-row bug stays fixed.
- **Templates:** zero em dashes in any subject/body/headline string (grep across `src/lib/notifications/` and `src/lib/nintendo/alerts.ts` headline builders — only code comments/tests, which are exempt); `NEXT_PUBLIC_APP_URL` is `.trim()`ed at all 6 read sites and no untrimmed read exists anywhere in `src/`; links are plain `${APP_URL}/...` or nsuid-based eShop URLs, well-formed.
- **`release_date_set`:** email is NOT wired — `getPrefColumn` routes it to `notify_releases` (`dispatch.ts:57`), but `getTemplate` has no case for it and falls to `default: return null` (`templates.ts:237`), so `sendEmailAlert` bails at `email.ts:76-79`; it has no batch group so it can't ride a digest. In-app only, per the locked founder rule. Verified.
