# Blippd iOS App: Server / Backend / App-Store Gap Map

Scope: everything between the current codebase (`/Users/huntcuttin/Documents/GitHub/blipd`) and a shippable iOS app, EXCLUDING the mobile/ Expo scaffold itself (assessed separately). Read-only investigation, 2026-08-05.

Status legend: **ready** (works as-is) / **reusable-with-work** / **missing** (must build) / **blocked** (external dependency) / **decision-needed** (founder call).

---

## 1. PUSH — the entire point of the app

### 1.1 Channel abstraction already anticipates native push — but nothing implements it
- **Area:** notification channel plumbing
- **Status:** reusable-with-work
- **Detail:** `src/lib/notifications/types.ts:1` already declares `NotificationChannel = "email" | "web_push" | "expo_push"` — the union was future-proofed. But `src/lib/notifications/channels.ts:14` hardcodes `return ["email", "web_push"]` and `src/lib/notifications/send.ts:60-80`'s channel switch has cases only for `email` and `web_push` (default → `Promise.resolve(false)`). Concretely: add `"expo_push"` to the array in `channels.ts`, add a `case "expo_push":` in `send.ts`'s switch that mirrors the existing `web_push` case (including the attempted-0-means-nothing-to-log discipline documented in the comment at `send.ts:64-71`). The existing `alertToPushPayload()` (`send.ts:12-46`) is directly reusable — title/body/url/tag already map 1:1 onto an Expo push message (`tag` → `collapseId`/`categoryId`, `url` → `data.url` for deep-link routing).
- **Effort:** S

### 1.2 Device-token storage: new table, don't extend push_subscriptions
- **Area:** schema
- **Status:** missing (+ decision-needed on table shape, with a clear recommendation)
- **Detail:** `supabase/migrations/20260310_003_push_subscriptions.sql` defines web-push-shaped columns: `endpoint`, `p256dh`, `auth` — all `NOT NULL`, `UNIQUE(endpoint)`. An Expo push token (`ExponentPushToken[xxx]`) has no p256dh/auth material, so reusing this table means either nullable-column soup plus a `channel` discriminator, or stuffing the token into `endpoint` and lying about the other two. **Recommendation: a new table** `device_push_tokens (id, user_id references auth.users on delete cascade, expo_push_token text unique not null, platform text, created_at, last_seen_at)` with the same RLS shape as push_subscriptions (`FOR ALL USING (auth.uid() = user_id) WITH CHECK (...)`) — that policy pattern (migration line 13-16) already lets the mobile client register/remove its own token directly with the anon key + session, no API route strictly required. Note this repo's most-repeated bug class: **migrations that exist in the repo but were never applied live** (three separate instances documented in CLAUDE.md). Whoever builds this must apply the migration via the Management API (keychain token, `security find-generic-password -a "supabase-mgmt" ...`) and verify against `pg_tables`/`pg_policy` before shipping code that reads it.
- **Effort:** S (schema) — but the apply-and-verify step is mandatory

### 1.3 Token registration endpoint: existing pattern is copy-paste ready
- **Area:** API
- **Status:** reusable-with-work
- **Detail:** `src/app/api/push/subscribe/route.ts` is the exact template: `Authorization: Bearer <supabase access token>` → `createAdminClient().auth.getUser(token)` → upsert/delete. A native token route (`/api/push/register-device` or similar) is a ~40-line clone with the Expo token body shape. Alternatively skip the route entirely and have the app upsert into `device_push_tokens` directly under RLS (simpler, one less endpoint; the route only adds server-side validation of token format). One real bug to NOT copy: the web route's `onConflict: "endpoint"` upsert reassigns `user_id` for an existing endpoint (endpoint-hijack noted in audit #10) — for the new table, upsert on the token with an ownership check, or rely on RLS `WITH CHECK` by doing the write client-side.
- **Effort:** S

### 1.4 Expo Push Service vs direct APNs
- **Status:** decision-needed — recommendation: **Expo Push Service**, strongly
- **Detail:** For a zero-touch POC, Expo Push wins on every axis: free (no separate billing; ~600 notifications/sec rate limit, absurd headroom for this scale), no APNs credential material in the Vercel environment at all (EAS stores the APNs .p8 key; the server just POSTs JSON to `https://exp.host/--/api/v2/push/send`), `expo-server-sdk-node` handles chunking (100/batch) and backoff. Direct APNs would mean: .p8 key in Vercel env vars (this project has already leaked one credential class into git and one env var arrived with an embedded `\r\n` — fewer secrets is a feature), JWT signing, an HTTP/2 client on Vercel serverless (annoying), and per-token binary feedback handling. The single Expo caveat: **push receipts arrive ~15 min after send** and must be polled to learn about `DeviceNotRegistered` (uninstalls) — see 1.6.
- **Effort:** — (decision)

### 1.5 Where the send goes in dispatch, and the digest gap
- **Area:** dispatch logic
- **Status:** reusable-with-work + decision-needed
- **Detail:**
  - Individual sends: nothing in `dispatch.ts` needs structural change — `dispatchRecentAlerts()` (`src/lib/notifications/dispatch.ts:90`) calls `sendAlertToUsers` → `sendAlert` → per-channel fanout, so wiring `expo_push` into `channels.ts`/`send.ts` (1.1) makes native push ride the existing durable `dispatched_at IS NULL` machinery (dispatch.ts:104-118), including the already-sent-pair dedup (`dispatch.ts:158-160, 221-222`) and rate-limit-stop retry semantics for free.
  - **The digest hole:** digested alerts send email ONLY. `sendBatchedDigest`/`sendLaunchDigest` (`src/lib/notifications/send-batch.ts` — grep confirms zero push references) are pure email paths, and the individual-send path that carries push is bypassed for any user whose group hits the 5-alert threshold (`batching.ts:46-49`). Meaning: on a big Nintendo sale day — the exact day push matters most — a heavy user gets **zero push notifications** today's architecture. Same for the named-sale Tier-1 blast and weekly digest (both email-only Resend sites per `email.ts` header comment). **Decision:** send ONE summary push per digest (e.g. "6 games you watch went on sale · up to 67% off") in `dispatch.ts` Phase 4 (lines 337-355) alongside the digest email. Recommended yes — it's one push, well inside the frequency-cap research already in CLAUDE.md.
  - Dedup/logging: `notification_log.channel` is free text (`migrations/create_notification_log.sql` — CHECK constraint is on `status` only), so logging `"expo_push"` rows needs no migration. Copy the web_push logging discipline from `send.ts:72-77` exactly (only log when `attempted > 0`), or every email-only user grows a spurious failed row per alert — the exact bug already fixed once for web_push.
- **Effort:** S (individual path) + M (digest summary push, incl. copy)

### 1.6 Receipt handling / token hygiene
- **Area:** new module + small cron addition
- **Status:** missing
- **Detail:** New `src/lib/notifications/expo-push.ts` mirroring `push.ts`'s shape (`sendPushToUser` returning `{attempted, succeeded}`, `push.ts:28-58`): read tokens from `device_push_tokens`, send via expo-server-sdk, and — the part web-push doesn't have — **persist ticket IDs and check receipts on a later pass**, because `DeviceNotRegistered` (user uninstalled) mostly arrives in the receipt, not the ticket. Cheapest zero-touch design: store tickets in a small `expo_push_tickets` table (or a jsonb column), and have the existing 10-min `dispatch-notifications` cron check receipts for tickets older than 15 min at the top of each run, deleting dead tokens (the analog of web-push's 410 cleanup at `push.ts:46-48`). Skipping receipts entirely "works" but accumulates dead tokens forever and risks Expo throttling for repeatedly pushing to dead devices.
- **Effort:** M

### 1.7 Hero-moment latency: dispatch waits for the 10-minute cron
- **Area:** pipeline latency — **this one threatens the app's whole pitch**
- **Status:** missing (small fix, big consequence)
- **Detail:** `insertAndDispatch` (`src/lib/nintendo/alerts.ts:58-119`) only inserts the `alerts` row + `user_alert_status` rows — despite the name, it does not send anything. Actual delivery happens exclusively when the separate `dispatch-notifications` cron (every 10 min) runs `dispatchRecentAlerts`. So launch-burst-poll (every 2 min, `src/app/api/cron/launch-burst-poll/route.ts:96` → `generateReleaseAlert`) can detect a launch within ~2 minutes and the push still sits for up to 10 more minutes. Worst case ~12 min from go-live to phone buzz — for email nobody notices; for the native-push hero moment ("the minute it launches") it's a product failure per the Bible's own "an alert that arrives late is worse than no alert." Fix: after launch-burst-poll generates any `out_now` alert, invoke `dispatchRecentAlerts()` inline in the same request (it's idempotent and durable by construction — an overlapping run with the 10-min cron double-checks `notification_log` pairs at `dispatch.ts:158-160,221-222` before sending, though note the pair-dedup reads `status = "sent"` rows written *after* the send completes, so a genuinely simultaneous overlap has a small race window; acceptable at POC scale, or add a cheap advisory-lock/in-flight guard). Alternatively schedule dispatch every 2 min — but that multiplies cron-job.org executions for no benefit 99% of the time.
- **Effort:** S

---

## 2. AUTH — magic link → native

### 2.1 Client auth flow mapping
- **Area:** Supabase auth in RN
- **Status:** reusable-with-work + decision-needed (with recommendation)
- **Detail:** Web uses `createBrowserClient` from `@supabase/ssr` (`src/lib/supabase/client.ts`, PKCE flow by default) and `signInWithOtp({email, options: {emailRedirectTo: origin + "/auth/callback"}})` (`src/lib/AuthContext.tsx:58-66`). Native equivalent: plain `@supabase/supabase-js` client with `auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }`. Two viable magic-link designs:
  1. **Deep-link magic link (PKCE):** `emailRedirectTo: "blippd://auth/callback"`, app handles the link, `exchangeCodeForSession(code)`. Fragile in exactly the way this codebase has already documented on itself — `src/app/auth/callback/page.tsx:56-61`'s comment describes the PKCE-verifier-loss failure when a link opens in a context other than the one that requested it. On mobile that failure recurs whenever the mail app's in-app browser eats the link instead of handing it to the OS (Gmail's webview is the canonical offender). Universal Links (`applinks:` + AASA file served from blippd.app) reduce but don't eliminate this.
  2. **Email OTP code (recommended):** same `signInWithOtp` server-side, but the user types a 6-digit code into the app; `verifyOtp({ email, token, type: "email" })`. No deep link, no redirect allowlist, no PKCE verifier, works identically from any mail client. Costs: edit the Supabase magic-link email template to include `{{ .Token }}` (today's template presumably only has the ConfirmationURL — dashboard change), and one extra screen in the app. For a zero-touch POC where "auth must never break" is a locked principle, this is the right trade. The web keeps its link flow; both flows coexist on the same template.
- **Effort:** S–M (mostly app-side; server-side is dashboard config)

### 2.2 Supabase dashboard config changes
- **Area:** external config (no code)
- **Status:** blocked-on-manual-step (dashboard; some of it scriptable via Management API)
- **Detail:** (a) If deep-link flow: add `blippd://auth/callback` (and any Universal Link URL) to Auth → URL Configuration → Redirect URLs allowlist — without this, `emailRedirectTo` is silently ignored and links land on the web callback. (b) If OTP flow: edit the Magic Link email template to include `{{ .Token }}`. (c) Rate limits: magic-link/OTP sends ride the custom SMTP already wired through Resend (configured + verified 2026-08-02) — 30/hour default auth rate limit and the shared 100/day Resend pool both still apply; a launch-day app spike hits the same ceilings already documented in Infrastructure Limits. (d) If native Sign in with Apple ships (see 2.3): Apple provider needs the app's bundle ID added as an authorized client ID in the Supabase Apple provider config (native `signInWithIdToken` validates audience against it).
- **Effort:** S, but human/dashboard

### 2.3 Guideline 4.8 — does Sign in with Apple apply?
- **Area:** App Store policy
- **Status:** decision-needed (fork is fully mapped)
- **Detail:** Current guideline text (fetched from developer.apple.com 2026-08-05): apps using a third-party/social login (Google explicitly listed) for the primary account **"must also offer as an equivalent option another login service"** meeting three privacy criteria (limits collection to name/email, allows hiding email, no ad-profiling without consent). SIWA is *sufficient* but no longer the only qualifying option. Exemption: **"Your app exclusively uses your company's own account setup and sign-in systems"** — i.e. magic-link/OTP-only ships with no 4.8 obligation at all. The web login already offers Google AND Apple OAuth (`src/lib/AuthContext.tsx:68-86`, `src/app/login/LoginPage.tsx:22`), so the fork is:
  - **App ships email-only:** exempt. Simplest. Slight UX wrinkle: an existing user who signed up on web with Google can still enter the same email for OTP, but Supabase will treat provider identities per its linking config — with default settings a same-email OTP signin resolves to the same user only if identity linking allows; verify this against the live project's auth settings before betting on it (worst case the Google-created user gets a second account — a real support burr).
  - **App ships Google login:** 4.8 fires; must add Sign in with Apple natively — NOT the web OAuth redirect but `expo-apple-authentication` → `supabase.auth.signInWithIdToken({provider: "apple", ...})` (App Review reliably rejects webview-only Apple sign-in on iOS as a poor-native-experience 4.8/4.0 issue). Supabase Apple provider is already configured for web, so this is app-side work + the bundle-ID client addition (2.2d).
  - Recommendation for POC: **email-OTP only at v1** (exempt, zero extra provider surface), add native SIWA later if reviews/users demand it.
- **Effort:** — (decision) / M if Google+SIWA ship

---

## 3. DATA ACCESS — mobile hits Supabase directly with the anon key

### 3.1 RLS policies the mobile client depends on (all verified present in repo migrations; live-verified per CLAUDE.md's 2026-08-02 full RLS sweep)
- **Status:** ready
- **Detail (policy → source):**
  - `games`, `franchises`, `alerts` — public SELECT (`scripts/schema.sql:39-40, 53-54, 103-104`). Covers browse, search, game detail, the alert feed's join `alerts → games!inner` (`src/lib/queries.ts:393-397`), price history (jsonb on games).
  - `named_sale_events`, `price_snapshots` — public SELECT (`supabase/migrations/20260307_002`, `_003`).
  - `user_game_follows` — SELECT/INSERT/DELETE (`schema.sql:65-71`) + UPDATE added 2026-08-03 (`supabase/migrations/20260803_002`) — the UPDATE policy is what makes notify-prefs toggles and `setTargetPrice` work; it was missing for 5 months, so any mobile work must assume it's live-only-since-Aug-3.
  - `user_franchise_follows` — same shape incl. the Aug-3 UPDATE policy (`schema.sql:81-87`, `20260803_002`).
  - `user_alert_status` — SELECT/INSERT/UPDATE (`schema.sql:118-123`); upsert-based mark-read/dismiss/remind (`queries.ts:488-519`) all work under it.
  - `user_profiles` — SELECT/INSERT/UPDATE (`schema.sql:133-138`; duplicate-but-harmless second policy set noted in CLAUDE.md).
  - `user_game_owns` — `FOR ALL` manage-own (`supabase/migrations/20260311_002:16`).
  - `user_retro_follows` — SELECT/INSERT/DELETE + service-role (`20260318_001`).
  - `push_subscriptions` — `FOR ALL` manage-own (`20260310_003:13-16`); the new `device_push_tokens` table must copy this shape (see 1.2).
  - Every query in `src/lib/queries.ts` (806 lines) takes the client as a parameter (`supabase: Client`) rather than importing the web singleton — **the entire query layer is transplantable to RN as-is**, which is the single biggest reuse win in the codebase.
- **Effort:** — (inventory)

### 3.2 Data mobile CANNOT get client-side, and what to do
- **Status:** reusable-with-work (all have cheap paths)
- **Detail:**
  - `nintendo_directs` — RLS locked (0 policies; confirmed in CLAUDE.md's RLS review). Web gets it via the **public unauthenticated HTTP endpoint** `GET /api/directs/active` (`src/app/api/directs/active/route.ts`, admin client inside). Mobile just calls the same URL. Ready.
  - `notification_log`, `email_suppressions`, `trailer_detections` — locked; nothing user-facing reads them client-side on web either. No mobile need.
  - Landing-page stats and `/deals` SSR (`src/app/page.tsx:9`, `src/app/deals/page.tsx:38,77` use `createAdminClient`) — these read only the public-SELECT `games`/`named_sale_events` tables; the admin client there is a server-rendering convenience, not a privilege requirement. Mobile replicates with anon-key queries (or reuses `getGamesOnSale` etc. from queries.ts). Same for `game/[slug]`, `franchise/[name]`, `release-time` metadata pages.
  - User email address — server email path uses `auth.admin.getUserById` (`src/lib/notifications/email.ts:18-22`); mobile has `session.user.email` directly. No gap.
  - `src/app/admin/trailers` — admin-only, out of scope for the app.
  - One genuine asymmetry to note: `getAlerts` (`queries.ts:370-460`) filters the in-app feed to **directly-followed games only** — franchise-triggered alerts email but never appear in the feed (open founder question in CLAUDE.md). Mobile inherits whatever is decided there; nothing extra to build, but if push ships for franchise alerts, tapping a franchise push would deep-link to a game whose alert isn't in the feed — worth resolving the open question before the app ships.
- **Effort:** S total

---

## 4. APP STORE requirements the codebase does not meet

### 4.1 Account deletion — nothing exists, and Apple hard-requires it
- **Status:** missing — **hard blocker for submission**
- **Detail:** Guideline 5.1.1(v) (fetched 2026-08-05): "If your app supports account creation, you must also offer account deletion within the app." Exhaustive grep of `src/`, `supabase/`, `scripts/` finds **zero account-deletion path anywhere** — web included. Every `.delete()` call is row-level (follows, owns, push subscriptions, retro follows). The build is small and the pattern exists: an authenticated endpoint cloning `api/push/subscribe`'s bearer-token verification (`route.ts:6-19`) that calls `admin.auth.admin.deleteUser(user.id)`. FK hygiene is already almost perfect: `user_game_follows`, `user_franchise_follows`, `user_alert_status`, `user_profiles`, `user_game_owns`, `user_retro_follows`, `push_subscriptions` ALL declare `references auth.users on delete cascade` (schema.sql:59,75,109,128,144; migrations 20260310_003:3, 20260311_002:5, 20260318_001:3) — deleting the auth user wipes everything. Two stragglers: `notification_log.user_id` has **no FK at all** (`migrations/create_notification_log.sql:4`) so rows orphan (harmless operationally; arguably should be deleted in the same endpoint for GDPR-adjacent cleanliness), and `email_suppressions` is keyed by email, not user_id (leaving a bounce suppression after deletion is actually correct behavior — keep it). The endpoint must be reachable IN the app (a Settings row), not just on the website. Also verify the schema.sql cascades match live prod (this repo's known migration-drift class) before trusting them.
- **Effort:** S (endpoint + one settings row + live cascade verification)

### 4.2 Privacy policy URL
- **Status:** ready (one content nit)
- **Detail:** `src/app/privacy/page.tsx` exists and is live at blippd.app/privacy — covers what's collected (email via Google/Apple/magic-link), use, no-sale/no-tracking/no-ads, storage (Supabase/AWS, Resend), contact. App Store Connect just needs the URL. Nit: it says "Last updated: March 2026" and doesn't mention push tokens or account deletion; update the copy when 4.1 and push ship.
- **Effort:** S

### 4.3 Privacy nutrition labels — data inventory (from schema + code, for App Store Connect declarations)
- **Status:** ready (inventory below; declaration itself is a Connect form)
- **Detail — data actually collected, all linked to identity via user_id:**
  - **Email address** (auth.users; used for app functionality — alerts). Collected, linked, NOT used for tracking.
  - **User ID** (uuid across all user_* tables).
  - **Product interaction / app functionality data:** followed games + per-game notify prefs + target prices (`user_game_follows`), franchise follows, owned games (`user_game_owns`), retro follows, alert read/dismiss state (`user_alert_status`), console preference + onboarding state (`user_profiles`), notification delivery history (`notification_log`).
  - **Device tokens:** web push endpoint/keys (`push_subscriptions`); Expo push token once native ships — declare as identifiers used for app functionality.
  - **NOT collected:** name, location, contacts, photos, purchase history, browsing history, diagnostics/analytics. `package.json` confirms **zero analytics/tracking SDKs** — deps are Supabase, Resend, web-push, svix (webhook verify), Next/React, plus server-side-only `@anthropic-ai/sdk` (trailer matching cron; never runs client-side). No Sentry, no GA, no Amplitude, nothing. "Data Used to Track You: none" is truthfully declarable; App Tracking Transparency prompt not needed.
- **Effort:** S (form-filling)

### 4.4 Other review-surface items
- **Status:** ready-ish
- **Detail:** Support URL requirement → use blippd.app + `alerts@blippd.app` (already in the privacy page; a reply-to a human reads was already the CLAUDE.md recommendation). `/terms` exists. Content rating trivial. One soft risk: 4.2 minimum-functionality reviewers sometimes flag thin webview-ish apps — a real native app with push and native nav clears this; do not ship a WebView wrapper.
- **Effort:** —

---

## 5. OPERATIONAL — what breaks zero-touch

### 5.1 Recurring, unavoidable
- **Apple Developer Program $99/yr** — hard recurring. If it lapses the app is **removed from the App Store** (existing installs keep working). This is the single clearest permanent break of "free-tier forever": the Bible's end-of-life stance ("stays running indefinitely on free tiers") cannot extend to iOS.
- **~1 forced rebuild/year, in practice.** Three independent forcing functions converge on roughly annual maintenance: (a) Apple's annual minimum-SDK rule — new submissions/updates must be built with a recent Xcode/iOS SDK (only bites when you update, but you WILL update because of (b)); (b) **Expo SDK support window** — EAS Build drops old SDK versions from build infra on ~a yearly cadence, and expo-notifications/API churn rides SDK majors; an app pinned to a dead SDK can't produce a new build at all when something eventually needs fixing; (c) annual iOS majors occasionally break RN internals (usually fixed by the SDK bump you're forced into anyway).
- **App Store Improvements policy** — apps not updated for ~3 years AND below a minimal download threshold get flagged for removal. A frozen POC with a handful of users is squarely in the removal profile; a once-a-year rebuild (above) doubles as the pulse-keeper.
- **Push-token hygiene** — receipts/`DeviceNotRegistered` cleanup (1.6) is automated once built; no recurring human step.

### 5.2 One-time / non-recurring
- **EAS Build free tier (2026):** 30 builds/month, max 15 iOS, low-priority queue — comfortably enough for a POC's dev + release cadence; $0. (Overrun = wait for monthly reset or pay per-build.)
- **Certs/profiles:** EAS manages distribution certs + provisioning automatically at build time; the APNs **.p8 auth key does not expire** (unlike old push certs) and lives with EAS for Expo Push. An expired distribution cert never breaks the shipped app — it only matters at next build, where EAS regenerates. Effectively zero cert babysitting.
- **Expo Push Service:** free, no quota to manage at this scale (600/sec rate limit), no credential rotation server-side.
- **App Store Connect setup, screenshots, review** — one-time; first review typically 1-3 days, rejections cost round-trips (budget the account-deletion and privacy-label items above being checked, since those are the two things reviewers reliably test).

### 5.3 Net zero-touch verdict
The retention-gate framing in CLAUDE.md already said it: the iOS app roughly doubles the surface and introduces the project's first genuinely unavoidable recurring costs ($99/yr) and recurring labor (~1 forced SDK/rebuild cycle/yr). Everything else on this list is one-time or automatable. The server-side delta is honestly small — the codebase's channel abstraction, RLS posture, and client-parameterized query layer were all accidentally built mobile-ready — the recurring operational tax is the real price, exactly as Bible Addendum 2 predicted when it gated the app behind retention.

---

## Priority-ordered build list (server/App-Store side only)

| # | Item | Status | Effort |
|---|------|--------|--------|
| 1 | Account deletion endpoint + settings row (4.1) — submission blocker | missing | S |
| 2 | `device_push_tokens` table + RLS, applied AND live-verified (1.2) | missing | S |
| 3 | `expo-push.ts` sender + receipts pass (1.6) | missing | M |
| 4 | Wire `expo_push` into channels.ts/send.ts with logging discipline (1.1, 1.5) | reusable-with-work | S |
| 5 | Inline dispatch after launch-burst out_now — kill the 10-min push lag (1.7) | missing | S |
| 6 | Digest-day summary push decision + implementation (1.5) | decision-needed | M |
| 7 | Auth: email-OTP flow + template `{{ .Token }}` + (if linking) redirect allowlist (2.1, 2.2) | reusable-with-work | S–M |
| 8 | 4.8 fork: email-only (exempt) vs Google+native SIWA (2.3) | decision-needed | — / M |
| 9 | Privacy-page copy refresh + nutrition labels + Connect setup (4.2-4.4) | ready-ish | S |
| 10 | Accept recurring: $99/yr + ~annual rebuild (5.1) | decision-needed | recurring |

Sources for external facts: [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) (4.8 and 5.1.1(v) text fetched 2026-08-05) · [Expo billing/plans docs](https://docs.expo.dev/billing/plans/) and [EAS free plan limits changelog](https://expo.dev/changelog/2023-08-01-eas-free-plan-limits) (30 builds/mo, 15 iOS) · [Expo push docs — sending](https://docs.expo.dev/push-notifications/sending-notifications/) and [FAQ](https://docs.expo.dev/push-notifications/faq/) (free service, 600/sec, tickets vs receipts, DeviceNotRegistered).
