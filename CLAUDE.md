# Blippd — Claude Code Context Document

## Workflow Rules
- **Always push after committing.** After every `git commit`, immediately run `git push origin main` without asking. Every commit should be deployed.
- **Session logs go in `docs/SESSION-HISTORY.md`, not here.** This file is loaded into every session's context; keep it to durable knowledge (decisions, schema, rules, current state).
- **Read `## Hard-Won Lessons` before debugging.** Most bugs found here have been a repeat of a named class.

## Credentials & API Keys
- **cron-job.org API key:** `nXnh2WcO/qDxLTG/g2LW5dilu7fgfBLTqtpgP5OkLcg=` — use `Authorization: Bearer <key>` against `https://api.cron-job.org`
- **Supabase project ref:** `cigsitwnhfnndtidrjjo` — Management API (schema DDL, `/v1/projects/{ref}/database/query`, etc.) needs a personal access token, kept in the macOS keychain (never in this file — see the 2026-08-02 service_role leak below for why): `security find-generic-password -a "supabase-mgmt" -s "blippd-supabase-management-token" -w | base64 -d`. **Verified working 2026-08-04.** Don't confuse this with the plain `-a "supabase"` keychain entry — that one is the Supabase CLI's own login-session token (a different credential, stored in `go-keyring-base64:`-prefixed format by `supabase login`), which is what caused this token to look "missing" more than once when a session checked the wrong entry. PATs expire/get revoked periodically — if the command above returns 401 from `api.supabase.com`, ask the founder for a fresh one from supabase.com/dashboard/account/tokens and re-save it to this same keychain entry (`security add-generic-password -a "supabase-mgmt" -s "blippd-supabase-management-token" -w "$(echo -n NEW_TOKEN | base64)" -U`) rather than storing it in any git-tracked file.
- **Admin email:** `huntcuttin@gmail.com`

## What This Is
Blippd is a Nintendo eShop price alert app — "Beepr for Nintendo." Users follow games and get alerted the moment something changes. The goal is a clean, reliable side project that wins the US Switch niche by being definitively better at the one thing that matters: the alert fires, it's accurate, and it doesn't spam you.

- **App name:** Blippd (not Blipd — that's trademarked by a Virginia company)
- **Domain:** blippd.app (purchased, pointing to Vercel)
- **Company:** Westside Software LLC (or similar holding entity, never customer-facing)

## Blippd Product Bible — Non-Negotiables (Founder Interview, 2026-08-02)

### What Blippd is
A launch and price alert app for Nintendo eShop games. You follow games
you care about. When something happens — it launches, it goes on sale,
it hits an all-time low — you find out immediately. That's it.

The product is the alert. Not the store, not the discovery feed,
not the recommendation engine. The alert.

### The hero moment
A user is at a party on a Wednesday night. A game they'd been watching
drops on the eShop. Their phone buzzes once. They buy it from their phone.
It's downloading at home before they get back.

That moment — that's what every decision gets measured against. **The test
for any new feature: "Does this make the Wednesday night moment better, or
does it add noise between Wednesday nights?" If it adds noise: don't build it.**

### Priority order (locked)
1. **Launch alerts** — game just went live on eShop, fire immediately
2. **Release timing** — exact time a game drops, in the user's timezone
3. **Sales and price drops** — when something they follow goes on sale
   or hits an all-time low

This is the product hierarchy. Launch is the headline. Sales are
secondary. Discovery is tertiary.

### Non-negotiables (no exceptions, no edge cases)

**On notifications:**
- Never send a notification the user didn't explicitly opt into. No
  trending deals, no re-engagement pushes, no "you haven't opened the app
  in a while."
- Never fire a duplicate. One alert per event per user.
- Never obscure why an alert fired. Every notification must make
  immediately obvious: what game, what changed, by how much.
- Never paywall a notification. Alerts are the product — paywalling them
  is the thing that makes NT Deals bad.

**On the feed and alerts page:**
- Never show a game the user didn't follow in their alerts or notification
  feed. The alerts page is sacred — only followed games.
- Discovery (Deals page, browse, search) is a separate opt-in experience.
  The user goes there. It doesn't come to them.

**On copy (added 2026-08-05, founder rule):**
- Never use em dashes in any user-facing text: UI copy, meta/page titles,
  email subjects and bodies, alert headlines, error messages. Use a
  period, comma, colon, or the app's " · " separator instead. (The bare
  "—" glyph as a missing-price placeholder is a data glyph, not prose,
  and is fine.) This file and internal code comments are exempt.

**On the business:**
- Never make the alert the product in a commercial sense. Blippd doesn't
  sell games, doesn't earn from clicks, doesn't profit from purchase
  behavior. The alert tells you. What you do is yours.
- Never show an ad. The clean, ad-free experience is the portfolio signal
  and the product signal simultaneously. (See Monetization below — already
  independently decided the same way.)

**On reliability:**
- An alert that arrives late is worse than no alert. If the pipeline is
  delayed, the product has failed its one job.
- Users should never have to wonder if their alerts are working. "Last
  checked X min ago" is always visible.

### What success looks like
A user goes a full week without opening Blippd once. Then their phone
buzzes. They open it, see exactly what changed on a game they care about,
and act on it — or don't. Either way, they trust it. That's the product working.

### What Blippd is not
Not a game store. Not a recommendation engine. Not a social network. Not
a deal aggregator. Not a review site. Not a source of revenue from user
attention.

## Project Philosophy (Decided 2026-08-02, per Fable)

**Blippd is a proof-of-concept that runs in production, not a growth business.** This was effectively decided by the zero-touch + monthly-check-in constraint (see Zero-Touch Operations below) — a real product means responding to users, alert failures, and Nintendo API changes on their timeline, not yours. Naming it a POC is the filter for every roadmap/audit decision:

- **Kill anything that only pays off over years or requires ongoing curation.** DB migration baseline, major dependency version bumps (Next 14→16, React 18→19, etc.), multi-region/platform expansion — all explicitly deferred indefinitely, not "later." Don't revisit unless retention data (see Marketing Strategy) suggests this is becoming a real product.
- **Two things stay at product grade, everything else gets pinned and frozen:**
  1. **Alert correctness** — a false price-drop alert to a real user damages the portfolio value, not just the product experience.
  2. **Whatever makes the monthly check-in actually effective** — health-check coverage, error alerting, the things that let a once-a-month glance catch real problems.
- ~~The only path back to "real product" thinking is retention data.~~ **Repealed 2026-08-17** (see Bible Addendum): retention no longer gates anything. The founder builds what the founder wants; retention data is informational. The POC instinct below survives only as taste (don't manufacture multi-year maintenance burdens), never as a reason to defer requested work.

## Bible Addendum — Decisions from Founder Interview (2026-08-02)

### Launch-minute alerts (the differentiator — build this)
Sales alerts are a commodity (Deku, NT Deals, NTPrices all have them).
Launch-minute alerts are what nobody does. This is Blippd's edge.

- **Per-game launch burst polling:** a 1–2 min cron that checks whether any
  *followed* game is within ±30 min of its predicted launch window (from the
  editions-field prediction + publisher rules), and polls only those nsuids.
  No news feeds, no curation — IGDB release dates + hype scores (already
  syncing every 6h) supply everything. Zero-touch compatible.
- The "out now" alert stays ground-truth: it fires when the price actually
  goes live, prediction only tells the poller when to watch closely.
- This re-sorts the audit priorities: launch-alert reliability (release-date
  sync timeout, placeholder dates) outranks sale-alert polish. (Release-date
  sync timeout and placeholder dates fixed 2026-08-02 — see fix batches
  #3/#5/#6. Web push hardening also shipped 2026-08-02, but see Bible
  Addendum 2 below — push was deprioritized behind the retention gate, which
  was repealed 2026-08-17; email remains the hero channel on web, and real
  push arrives with the iOS app.)
- **Not yet built:** the launch burst polling cron itself. This is the next
  real feature, not just a hygiene fix — pending implementation.

### Launch notification links to eShop (decided)
The "out now" notification deep-links to the game's eShop product page
(nintendo.com/us/store/products/{nsuid}). Nintendo supports remote purchase
to console, so this completes the hero moment: buy from your phone,
downloading at home before you're back. This is NOT a "Buy Now" CTA in the
commercial sense — no affiliate, no urgency copy, no tracking. It's the
shortest path from "it's here" to "it's mine." The locked "no Buy Now CTA"
rule refers to Blippd's own UI pushing purchases, not to linking the alert
to its subject.

### Positioning: differentiator-first, both-mode delivery (decided)
Founder's priority (launches > timing > sales) may not match every user's.
Resolution: don't force the hierarchy on the UI — encode it in positioning.
- Landing/onboarding leads with the unique thing: "Know the minute it
  launches" — then "and catch every sale after."
- The user's follows determine their mode: follow an upcoming game → launch
  alerts are the experience; follow released games → sales are. No setting,
  no forced priority, the app adapts.
- Onboarding first ask: "Which games are you waiting for?" (upcoming +
  released search, mixed) — not sales-first framing.

### Miss protocol (decided): silence
If the pipeline is late or misses a launch, do not notify users about the
miss. No "we were late" notes. The health-check email tells the admin; the
user just gets the alert when it fires. Rationale: zero-touch, and a miss
note draws attention to a failure most users would never have noticed. The
"last checked" timestamp stays visible — that's the freshness signal that
resolves this against the "never wonder if it's working" principle (see
Product Bible above).

### Nintendo platform risk (deferred, one line)
Not worried at POC scale. If a C&D ever arrives: comply immediately, don't
argue. Don't build anything that increases scraping surface area beyond
what exists today.

### End-of-life (decided): never auto-shutdown
The app stays running indefinitely on free tiers regardless of involvement
level. Low involvement ≠ shutdown. Monthly check-in keeps it alive; there
is no sunset plan and none is needed.

### Retention gate — REPEALED 2026-08-17 (founder decision)
The gate ("10+ users returning in week 2, OR ≥25% week-2 return rate from the
launch cohort") **no longer blocks anything.** Founder, 2026-08-17: "don't block
any building based on [it] ... I want to do iOS too."

Retention data is now **informational, not a gate.** It is still worth measuring
(follows-per-signup and week-2 return rate, see Marketing Strategy) because it
tells you whether the thing is working. It does not decide what gets built.

**What this means for a session: do not defer, decline, or slow any piece of
work by citing retention, the gate, or POC framing.** If the founder asks for
something, build it. The POC framing in Project Philosophy still holds as
*taste* (don't invent multi-year maintenance burdens for their own sake), never
as a veto.

## Bible Addendum 2 — Channel & Launch Decisions (2026-08-02)

### Email is the hero channel for MVP (decided)
Users will not add a PWA to their home screen — accept reality.
- Web push audit items (#11, iOS PWA install flow) drop to
  behind the (since-repealed) retention gate. Still do not build web-push
  install prompts: the reason there was never the gate, it is that users do
  not add PWAs to their home screen. Real push comes with the iOS app. (#10's actual bugs —
  dedup logging, sign-out cleanup, the success-count miscount — were
  already fixed 2026-08-02 before this decision landed; that work wasn't
  wasted, it's just not where further investment goes next.)
- Email deliverability is therefore the entire product. Promote to
  launch-critical: #20 (Resend errors ignored, failures logged as "sent")
  — **fixed 2026-08-02** — and bounce visibility (not yet built) — a
  silently-dead email address is a silently-dead user, and it's the #1
  documented failure mode in this category (Slickdeals bounce suppression,
  see Competitor Intelligence).
- Launch-minute burst polling still ships: "the minute it launches, in
  your inbox" still beats every competitor's cadence. The pocket-buzz
  version of the hero moment is what the iOS app unlocks later.

### iOS app: GREENLIT 2026-08-17 (founder decision, supersedes the gate below)
Previously "built if and only if the retention gate triggers." The founder
lifted that on 2026-08-17 and asked for the iOS app directly. **It is being
built.** Plan: `docs/MOBILE-APP-PLAN.md`.

The original cost note still stands as something to manage, not a reason to
hesitate: web + native roughly doubles the surface (App Store review, $99/yr
dev account, OS breakage ~2x/yr, cert management, second codebase) and strains
zero-touch. The pitch is unchanged and it is the right one: real push
notifications, the actual hero moment, not "our website, installed."

### alerts table growth (noted, no action)
`alerts` is the global event log (every price event on all ~2,800 games),
not per-user — 17k rows with one user is expected, not a bug. Per-user
deliveries live in notification_log. Cleanup policy: alerts with no
user_alert_status references and older than 6 months are eligible for
deletion. Add a saved script to `fixes/` eventually (see Zero-Touch
Operations); no action needed until row count actually matters (years away).

### Portfolio artifact (decided)
The live app is the artifact. No case study, no write-up, no blog post.
Someone visits blippd.app and it works — that's the proof. Zero-touch
compatible by definition.

### Launch readiness (recommendation, not a gate — founder launches when founder wants)
Blippd is launch-ready when these are green:
1. Launch-minute burst polling built and verified on one real release — **built and live 2026-08-02 (cron-job.org job 8205523); still needs verification against an actual real-world release to confirm it catches a launch within the intended window**
2. #20 fixed (Resend errors surfaced, not logged as "sent") + bounce visibility — **fully done 2026-08-02: webhook registered in the Resend dashboard, `RESEND_WEBHOOK_SECRET` added to Vercel, confirmed live (route correctly rejects an unsigned test POST with 401 "Invalid signature" instead of 500 "Not configured")**
3. Magic link verified working live (#9 shipped, needs a real-device check including email-app in-app browsers) — **custom SMTP was never configured for Supabase Auth (the actual root cause of the "more urgent finding" below) — found and fixed 2026-08-02, verified with a real end-to-end send/receive/click via Gmail. Desktop-browser flow confirmed working live. Still not done: a check specifically from a phone's email-app in-app browser (Gmail/Mail app), the one scenario most likely to hit the PKCE cross-context failure mode.
4. Zombie sale banners verified gone in prod (#2 shipped, needs a look) — **verified 2026-08-02: only one active named_sale_event remains, with a correct tagged-game count**
5. One end-to-end dress rehearsal: follow a game, trigger a real alert, receive the email, click through — the full loop, on a phone — **not yet done**

Everything else in the audit is post-launch. When these five are green,
the three launch posts (r/NintendoSwitch thread, Show HN, one Discord) are
the next action.

### Notification voice (direction set, options drafted 2026-08-02, decision pending)
Warmth over pure utility — the alert should feel like "it's here," not a
receipt. **Any session writing or editing notification/email templates must
still prompt the founder before shipping — options below are drafted, not
decided.**

Fable drafted 3 copy variants per alert type (full text in session log, not
duplicated here to avoid this doc going stale if the founder picks a mix):
- **"Out now":** A) Excited friend (high energy, shortest) — B) Quiet
  concierge (calm, restrained, ages best at high alert volume) — C) Insider's
  nod (intimate, references the relationship, most distinctive but risks
  feeling precious).
- **"Price drop":** A) Leads with the number (scannable, deal-forward) —
  B) Leads with the feeling (better open-curiosity, worse scanability) —
  C) The scout's report ("we watch so you don't have to" — reinforces the
  retention story directly).

**Sender identity — recommendation, not yet decided:** keep alerts on
`alerts@blippd.app` (a bot pretending to be a named founder inverts warmth
into fakeness the moment a user notices), but set `reply-to` to an address
the founder actually reads, and reserve genuine founder-voice sends (welcome
email, occasional "what should Blippd watch next") for the few real
low-frequency human touchpoints.

**Urgency-line policy (recommendation):** eShop games never sell out, so
"before it's gone" is always false and violates the no-manufactured-urgency
rule. Real sale end dates are fine to state — as a date in the body
("sale runs through March 3"), never as an imperative in the subject, and
only when the pipeline actually has a real end date. No date → say nothing,
never fall back to generic "limited time" language.

## Research Queue (2026-08-02, per Fable strategy pass)

In priority order — these keep the project moving between check-ins:
1. ~~**Resend free-tier limits + bounce webhook setup**~~ — **answered 2026-08-02, see Infrastructure Limits below.**
2. **Calibrate launch-time predictions against reality** — for the next 3-5 notable releases, log predicted vs actual eShop go-live time in this doc. Turns the four documented rules into a validated system. **Methodology correction (2026-08-02 overnight, found while attempting this)**: "just check timestamps after each release" doesn't work for an unfollowed game — checked "The Legend of Zelda™: Echoes of Wisdom" (real Nintendo first-party release, `release_date: 2026-08-02`) and its `out_now` alert fired ~20 hours after the "major first-party → midnight ET" predicted go-live time. That's not a real prediction miss: nobody follows the game (confirmed live), so `launch-burst-poll`'s every-2-min monitoring never activated for it — its alert timestamp just reflects the general `update-prices` cron's full-catalog rotation cadence (~100 games/10min against ~2,800+ games ⇒ any single unfollowed game may only get re-checked every few hours), which has nothing to do with when it actually went live. **This calibration only produces valid data for a game that's followed by someone before its release** (so burst-poll is actively watching it near the predicted window) — pick real upcoming follows for the next 3-5 data points, not just any notable release.
3. **Draft the launch posts before launch day** — the pitch is the differentiator ("emails you the minute a game goes live on eShop"), not "another price tracker." Check r/NintendoSwitch + r/NintendoSwitch2 self-promo rules at time of posting — they change, and a launch-day ban is a real outcome.
4. **NTPrices trajectory check at each monthly check-in** — the one competitor worth watching. If they add launch alerts, the differentiator window narrows.

## Infrastructure Limits (2026-08-02, per Fable research — verified against primary docs)

**Resend free tier:** 100 emails/day, 3,000/month — a hard 429 block (`daily_quota_exceeded`/`monthly_quota_exceeded`), not a queue or silent drop. Bounce rate must stay under 4% and spam rate under 0.08% across all tiers or sending gets temporarily paused entirely — this is why bounce visibility matters more than the quota itself. **Bounce/complaint webhooks are free-tier, not paid-gated.** Events: `email.bounced` (with `bounce.type`: Permanent=hard/never-deliverable, Transient=soft/may-retry, Undetermined=unclear), `email.delivery_delayed` (temporary, Resend auto-retries before falling back to bounced), `email.complained` (spam report → suppress immediately). Must verify webhook signatures. As of early 2026, Resend emits one event per recipient, not per email. Suggested policy (matches Resend's own reference): hard bounce → suppress immediately; soft bounce → counter, suppress at 3; complaint → suppress immediately. Cheapest upgrade: Pro, $20/mo, 50k emails, no daily cap, pay-as-you-go overage capped at 5x quota — the unlock is removing the daily cap, not new bounce tooling (that's already on free).

**⚠️ Supabase auth email — the real risk, more urgent than Resend's cap:** Supabase's *default* auth mailer (used for magic links unless custom SMTP is configured) is capped at 2 messages/hour, restricted to the project's own team addresses, and explicitly non-production. **If custom SMTP isn't wired up, magic links to real users don't work at all — this needs verifying before anything else on the Launch Readiness list.** Once custom SMTP (presumably Resend) is configured: default rate limit becomes 30/hour (adjustable in Authentication → Rate Limits), 1 request/60s per user, links expire in 1 hour (both configurable). If Supabase auth emails route through the same Resend account as alert emails, they share the same 100/day pool.

**cron-job.org free tier:** no job-count limit (fair-use), execution frequency down to 1/min, 30s execution timeout, 64KB max response, last 50 executions with 2-day response retention. Expect 4-40s of scheduling jitter, no punctuality guarantee. Paid tier bumps timeout to 5 min, response cap to 256KB.

**What breaks first at ~500 users, in order:**
1. Resend's 100/day cap — breaks on the *best* day, not a random one: a big Nintendo sale alerting 20-25% of 500 users in one cron run blows past 100 immediately, compounding with launch-post signup emails on the same pool. Upgrade to Pro before the public launch post, not after.
2. Supabase's 30/hour auth cap (once SMTP is configured) — a launch post driving 30+ signups/hour silently fails magic links: the client call succeeds, the email never arrives, and the user's first impression is "this is broken." Raise it in the dashboard before launch.
3. cron-job.org holds fine at this scale as long as the endpoint acks fast — the risk is the 30s timeout on the poll-and-dispatch job as it grows; return 200 immediately and process async if that ever becomes tight.

## Game Quality & Catalog Ranking (2026-08-02, per Fable)

Surface quality alongside price. A 90% discount on a 2-star shovelware title
is not a deal — it's noise. A 30% drop on a 95-rated game is signal.

### Ranking signals (in priority order)
1. OpenCritic / Metacritic score (≥75 = quality threshold for featuring)
2. Nintendo first-party titles always surface (regardless of discount %)
3. User follow count on Blippd (social proof from our own users)
4. Discount depth (% off, not absolute price)
5. All-time low flag (is this the cheapest it's ever been?)

### Catalog tiers
- **Tier 1:** Nintendo first-party + games with OC score ≥85. Always show.
- **Tier 2:** Third-party with OC score 75-84. Show in standard feeds.
- **Tier 3:** OC score <75 or unscored. Only show on direct search or
  followed by user. Never surface in "trending" or featured slots.

### Principles
- Never surface unscored shovelware in any featured or algorithmic slot.
- A followed game always alerts regardless of tier — the user opted in.
- Quality filters apply to discovery, not to personal watchlists.
- Launch catalog = top 500 most-followed Switch titles, pre-filtered by tier.

**Implementation status: built 2026-08-02.** `getGameTier()` in
`src/lib/ranking.ts` classifies every game 1/2/3 per the rules above
(Nintendo first-party or OC/Metacritic ≥85 = Tier 1; 75-84 = Tier 2;
unscored or <75 = Tier 3). Wired into `/sales` (the Deals page): Tier 3
games are filtered out of the algorithmic views (sort list + All-Time-Lows
scroll) so a deep discount on an unscored/low-rated title doesn't read as
a deal. Search results and games the user already follows are exempt —
verified live, e.g. a followed Tier-3 game still shows. Not touched:
`/home` (personal dashboard — no tier filter, per "quality filters apply
to discovery, not personal watchlists") and `/upcoming` (Out Now/Coming
Soon — not currently in scope, revisit if it starts surfacing shovelware).

## Locked Stack

| Layer | Tool |
|---|---|
| Frontend + Backend | Next.js 14 (App Router) |
| Database + Auth | Supabase (Postgres + magic link) |
| Email | Resend — sender: alerts@blippd.app |
| Hosting | Vercel (free tier) |
| Cron | cron-job.org (14 jobs as of 2026-08-02 — see Cron Jobs table below) |
| Payments | None — no monetization at all (see Monetization below) |
| iOS (v2) | Expo / React Native |
| Data | nintendo-switch-eshop npm + ITAD API + IGDB API + Algolia |

## Monetization

**None. Killed entirely, not deferred (Decided 2026-08-02, per Fable).**

- **Free forever:** Unlimited follows, email alerts, web push notifications — no paywall, no ads.
- The prior "Carbon Ads at 5k+ users" plan is dead. At POC scale, Carbon is tens of dollars a month at best, and an ad slot actively works against the actual goal here — a clean, fast, ad-free niche tool reads better to anyone evaluating this as a portfolio piece than a monetized one does.
- Infra is effectively free at this scale (Vercel/Supabase/Resend free tiers) — there's no cost to cover.
- If hosting costs ever actually appear, a one-time Ko-fi link is the zero-touch answer (no account setup, no payout threshold, no ad-tag maintenance) — not an ad network.
- Stripe removed from roadmap entirely (unchanged from before).
- **Confirming evidence (2026-08-02, per Fable research):** Deku Deals — a multi-year incumbent with strong brand loyalty — earns an estimated ~$471/month from Patreon (~245 paid of 571 total members). Carbon-style ads need 5k+ engaged users to pay meaningfully at all; voluntary tip jars top out around 2-3% of active users paying ~$2/month even for an established brand. Neither is worth planning around at POC scale — this doesn't change the decision above, it just confirms it was the right call. (NT Deals' paywalled-feature model — desired-price threshold + multi-region — is the only pattern in this space that generates real revenue, but it requires exactly the kind of user-hostile feature-gating Blippd is explicitly trying not to do.)
- **Counter-consideration surfaced by a second research pass (2026-08-02) — noted, does not reverse the lock above:** the category norm across DekuDeals/IsThereAnyDeal is a voluntary "supporter" tier (not ads, not a hard paywall) with "alerts delivered first" as the paid hook — monetizing alert speed/reliability anxiety without gating the core function. This is a real pattern, and it's a much softer ask than NT Deals' paywalled-threshold model. If this project ever moves off POC framing (see Project Philosophy — that requires actual retention data first), a Patreon/Ko-fi "supporter" tier offering early/faster alerts would be the pattern to revisit, not ads. Not building this now.

## Database Schema (Core Tables — Supabase public schema)

### games
- id (uuid PK), nsuid, switch2_nsuid, upgrade_pack_nsuid, title, slug, publisher, developer, franchise
- current_price, original_price, upgrade_pack_price (numeric)
- discount (int), is_on_sale, is_all_time_low, is_suppressed (bool)
- release_date, release_status (released/upcoming/out_today), sale_end_date
- platform, cover_art, nintendo_url, price_history (jsonb)
- igdb_id, igdb_hype, metacritic_score, sale_event_id

### alerts
- id (uuid PK), game_id (FK→games), type, headline, subtext
- new_price, old_price (numeric), discount (int), sale_end_date
- created_at (timestamptz)

### user_profiles
- user_id (FK→auth.users), console_preference, onboarding_completed, updated_at

### user_game_follows
- user_id, game_id, notify_announcements, notify_sales, notify_all_time_low, notify_releases (bool)

### user_franchise_follows
- user_id, franchise_id, notify_announcements, notify_sales, notify_all_time_low, notify_releases

### user_game_owns
- user_id, game_id

### user_alert_status
- user_id, alert_id (FK→alerts), read, dismissed, remind_at

### notification_log
- id, user_id, alert_id, channel (email/web_push), status (sent/failed), error, created_at

### named_sale_events
- id, name, detected_at, active, games_count, dedup_key (UNIQUE)

### franchises
- id, name, game_count, logo, popularity_score

### push_subscriptions
- id, user_id, endpoint, p256dh, auth, created_at

### nintendo_directs
- id, video_id, title, detected_at, active

### trailer_detections
- id, video_id, title, game_id, franchise_id, confidence, status, detected_at

## Cron Jobs

All cron endpoints live at `/api/cron/*` and require `Authorization: Bearer {CRON_SECRET}`.

| Endpoint | Frequency | What it does |
|---|---|---|
| `/api/cron/update-prices` | Every 10 min | Polls eShop prices, detects drops/sales/ATL, generates alerts, detects named sale events |
| `/api/cron/dispatch-notifications` | Every 10 min (after update-prices) | Sends email/push for recent alerts, batches 5+ price alerts into digest |
| `/api/cron/sync-catalog` | Daily | Full catalog sync from Nintendo eShop Algolia, deduplication, franchise linking |
| `/api/cron/sync-hype-scores` | Every 6 hours | Fetches IGDB hype counts for upcoming games |
| `/api/cron/sync-ratings` | Every 6 hours | Fetches IGDB aggregated_rating for released games → metacritic_score column |
| `/api/cron/sync-release-dates` | Every 6 hours | Fetches IGDB release dates for games with placeholder dates |
| `/api/cron/detect-directs` | Every 5 min | YouTube RSS check for Nintendo Direct videos, creates banner |
| `/api/cron/detect-trailers` | Every 15 min | YouTube RSS + Claude API matching for game trailers |
| `/api/cron/weekly-digest` | Weekly (Sunday) | Sends digest email of followed games currently on sale |
| `/api/cron/health-check` | Every 30 min | Checks cron-job.org job health + price-pipeline freshness, emails admin on problems |
| `/api/cron/launch-burst-poll` | Every 2 min | Polls only followed, upcoming games within ±30 min of predicted launch — the launch-minute differentiator, see Bible Addendum |

### Reliability infrastructure
- **`src/lib/retry.ts`** — `withRetry` (exponential backoff), `withTimeout`, `fetchWithRetry` (drop-in fetch replacement)
- All YouTube RSS fetches use `fetchWithRetry` with 2 retries + 10s timeout
- Claude API calls wrapped with 20s `withTimeout`
- IGDB batch operations have circuit breaker (stops after 3 consecutive 429s)
- Named sale event creation uses `dedup_key` upsert to prevent race conditions
- Notification dispatch tracks actual send success/failure counts
- Alert payloads validated (NaN, negative, >100% discount blocked)

## eShop Link Format
```
https://www.nintendo.com/us/store/products/{nsuid}
```
If nsuid is null, fall back to: `https://www.nintendo.com/us/store/`

## Polling Architecture

| Window | Frequency |
|---|---|
| Normal hours | Every 10 min |
| Thursday midnight PT (known drop window) | Every 1-2 min |
| Nintendo Direct detected (YouTube RSS) | Every 30s for 2hrs post-detection |

Pattern: ingest job -> snapshot diff -> event router -> notification delivery

Nintendo Direct detection: YouTube RSS channel `UCGIY_O-8vW4rfX98KlMkvRg`

## Alert Types

**Corrected 2026-08-03 (audit Phase 2 doc reconciliation)** — this list previously included "Release date changed," which grep confirms never existed in code (no `release_date_changed` type anywhere). Actual types, from `getPrefColumn()`'s switch statement (`src/lib/notifications/dispatch.ts`):

- Price drop
- Sale started
- Sale ending soon
- All-time low
- Release today / Out now (game released)
- Announced / Switch 2 edition announced (`notify_announcements`)
- Retro game added (in-app feed only — see Session Log 2026-08-03 for why it's deliberately email-exempt)

## Notification Architecture (Two-Tier for Named Sales)

**Tier 1 — Named sale event push** (all users with followed games in the sale):
> "Mar10 Day Sale is live — 47 games on sale now, including ones you're watching"
One notification. Drives to app. Feels like news.

**Tier 2 — Individual game push** (personalized, fires after Tier 1):
> "Super Mario Odyssey just dropped 50% — All-time low: $29.99 (was $59.99)"
Only for specifically followed games.

**Email** — different job entirely:
Digest sent a few hours after sale drops. Lists all followed games on sale with price, discount %, ATL status, link to blippd.app. One email, not one per game.

**Batching rule for unrecognized price drops:**
- 1-4 games dropping in same 30-min window -> individual alerts
- 5+ games in same 30-min window -> one batched digest email

**Frequency cap — grounded in real data (2026-08-02, per Fable research):** Localytics research (via GoodFirms/Sci-Tech Today, directional not peer-reviewed) found 46% of users disable push at 2-5 messages/week, and 32% quit the app entirely at 6-10/week. Blippd's existing batching design (instant for target-price-hit/out-now, digest for everything else, 5+ = one email) already lands well inside the safe zone — this is validation, not a design change. Worth keeping in mind as a ceiling if any future feature considers adding more push volume.

**Reliability architecture validation:** the same research calls a hybrid of event-driven detection + reconciliation jobs "the documented sweet spot" for this category — Blippd's actual architecture (10-min polling cron + the health-check reconciliation job) already matches this pattern. CamelCamelCamel's own Jan 2025 incident (a bug that re-created price watches for ~158,000 users, generating duplicate alerts) is the concrete cautionary tale for exactly the kind of idempotency gap the alerts-dedup fix (#15 in the audit list) closes — see Zero-Touch Operations and the 2026-08-02 session log.

## Bulk Dismissal / Alert Feed UX (built 2026-08-02 overnight session)

Shipped per the spec below: `dismissAlerts()` (queries.ts) upserts `user_alert_status.dismissed=true` for one or many alert IDs (column already existed, `getAlerts()` already filtered on it — only the write path and UI were missing). `AlertCard` gained swipe-to-dismiss (touch drag, threshold 80px, red X reveal) plus an inline `×` button for non-touch; both call the same `onDismiss`. `/alerts` page adds a header "Clear all" next to "Mark all read" (disabled — hidden, really — when the feed is empty) and a 5s `UndoToast`: dismissal is optimistic in the UI immediately, but the actual DB write is delayed until the undo window closes, so "Undo" is just cancelling a pending timeout rather than a real un-dismiss round-trip. Tap-to-open still only marks the single tapped item read (unchanged). One deliberate deviation from the original spec below: "Clear all" disables on an empty feed, not on zero-unread — a read-but-undismissed backlog is exactly what Clear all exists to clear, so gating it on unread would make it useless for that case.

Original spec (2026-08-02, per Fable research) the above was built against:
- Header-level "Clear all" (matches the safe-default pattern used by Teams' Activity → overflow menu), plus per-notification inline actions (mark read, dismiss).
- Swipe-to-dismiss per item, tap-to-open marks that single item read.
- A persistent read/unread dot — never let one tap silently mark the *entire* list read (a repeatedly-reported bug elsewhere).
- An undo toast after any dismiss/mark-read action — "no visual clue to reverse the action" is a named complaint against competitors.
- Disable "Clear all" when there are zero unread — a broken/no-op button at that state is a documented bug pattern (Hugging Face, Status mobile) to avoid repeating.

## UX Decisions (Locked — Don't Re-litigate)

- Follow a game or franchise = per-category notification preferences (announcements, sales, all-time low, releases). Default all-on, customizable from detail page.
- No "Buy Now" CTA. Alerts are passive. Purchase happens on console. **Clarified 2026-08-02 (Bible Addendum):** this refers to Blippd's own UI pushing purchases — the "out now" notification deep-linking to the game's eShop product page is not a Buy Now CTA (no affiliate, no urgency copy, no tracking), just the shortest path from "it's here" to "it's mine."
- Alert action wording: "Remind me in a few days" (not "snooze")
- Unseen alerts dashboard in-app — not a storefront
- Three-button pattern on game detail: Notify / Add to Wishlist / Own this game
- Launch with top 500 most-followed Switch titles, not full 10k+ catalog
- US eShop only at launch

## Historical Price Data Strategy

- **ITAD API** (already in stack) — use for historical low/high, "X times on sale", sale frequency. Covers pre-launch data gap.
- **PriceSnapshot table** — start accumulating own data now even before launch. Every week of polling = history you can never get back.
- Display approach: Show ITAD data labeled "historical" and own data labeled "tracked by Blippd since [date]." Transparent > silent.

ITAD endpoint:
```
GET https://api.isthereanydeal.com/games/history/v2
  ?key={API_KEY}&id={game_id}&country=US&since=0
```

## Zero-Touch Operations

**Constraint (Decided 2026-08-02): monthly check-in, as close to zero-touch as possible.** "Never touch it" isn't honest — it dies at the first delisted game or mis-tagged franchise. The actual answer is "monthly check-in + a cheap, saved, one-off fix when something predictable breaks" — the goal is making those fixes cheap and non-recurring, not eliminating them entirely.

**What's already built toward this:**
- `/api/cron/health-check` (every 30 min) — checks cron-job.org job health + price-pipeline freshness, emails on problems.
- Native cron-job.org `onFailure`/`onDisable` email notifications enabled on all monitored jobs.

**Still to build — a `fixes/` folder (per Fable, ~30 min one-time investment):**
- Saved SQL/scripts for the predictable, recurring exception categories: mark a game delisted, retag a mis-detected franchise, clear a stale named-sale-event banner (see `scripts/fix_zombie_sale_events.sh`-style pattern already used once this session).
- Extend `/api/cron/health-check` to surface the *triggers* for these, not just pipeline staleness — e.g. catalog sync hitting a 404/removed listing → "possibly delisted: {game title}" in the alert email.
- Goal: turn a manual fix from context-reload archaeology into running one saved, documented command. That's zero-touch in spirit — no recurring curation, just a lever for the rare exception.

## Roadmap

### Immediate (Unblocking — Do First)

- [x] Connect blippd.app domain to Vercel — DNS records added in Namecheap, propagating
- [x] Add blippd.app to Resend, update sender to alerts@blippd.app (emails sending successfully since 2026-03-15)
- [x] Rename Blipd->Blippd everywhere in codebase (exclude node_modules, .next, lock files)
- [x] Update cron-job.org endpoints if Vercel URL changed
- [x] Run migration: `ALTER TABLE named_sale_events ADD COLUMN IF NOT EXISTS dedup_key text UNIQUE;`
- [x] Add cron job for /api/cron/sync-ratings (every 6 hours) — job 7382994 on cron-job.org
- [x] Branch `claude/review-recent-commits-LI1DF` — deleted (was stale, no commits ahead of main)

### MVP (Complete)

- [x] Confirmed email alerts firing end-to-end (923 alerts generated, 12 emails sent as of 2026-03-17)
- [x] Stable catalog + pricing pipeline (2785 games, 205 on sale, prices polling every 10 min)
- [x] Domain live on Vercel (www.blippd.app)
- [x] Top 500+ game catalog seeded (2785 games from Algolia + IGDB)

### V1.5

- ~~Stripe Pro tier~~ (removed — ad-supported free model)
- [x] Web push notifications (VAPID keys, sw.js, push_subscriptions table, integrated in dispatch)
- [x] "Sale ending soon" alert type (sale_ending in dispatch, 48h before sale ends)
- [x] Named sale event detection + two-tier notification system (Tier 1 blast + Tier 2 individual)
- [x] Notification batching rule (5+ games = one digest, BATCH_THRESHOLD in dispatch.ts)
- [x] Per-game release time SEO pages (/games/[slug]/release-time)
- [x] Nintendo Direct detection banner (YouTube RSS)
- [x] IGDB hype score on Upcoming page
- [x] Critic rating scores on game cards (IGDB aggregated_rating)
- [x] Weekly digest re-engagement email (cron job 7358907, Sunday)

### Launch-Minute Alerts (New Top Priority — 2026-08-02, see Bible Addendum + Launch Readiness)

- [x] Per-game launch burst polling cron — **built and live 2026-08-02** (`/api/cron/launch-burst-poll`, cron-job.org job 8205523, every 2 min). Verified live: `{"ok":true,"checked":0,"inWindow":0,"released":0}` — 0 in-window is expected, no followed upcoming game happened to be near its predicted launch at verification time. **Full implementation as of 2026-08-02 evening** — now imports the recovered `src/lib/nintendo/launch-window.ts` module (19 passing tests), so the physical+digital rule (9pm PT the night before, via `has_physical_release`) is live alongside major-first-party (midnight ET) and digital-only (9am PT) — no longer a partial implementation. Pacific/Eastern offsets computed via `Intl`'s real timezone database (correct across DST), not a hardcoded UTC offset. Also fixed a real correctness bug the same day: the route was treating "has a `regular_price`" as "is released," but Nintendo's API can return a price for still-unreleased preorders (verified live) — now requires `sales_status === "onsale"` as ground truth.
- [x] Release-date sync timeout fixed (2026-08-02, fix batch #3)
- [x] Web push notification layer hardened — dedup logging, success-count bug, sign-out cleanup (2026-08-02, audit #10). **Web-push install prompts (#11) stay unbuilt on their own merits (users do not install PWAs), not because of the retention gate, which was repealed 2026-08-17. Real push ships with the iOS app.**
- [x] #20 fixed — Resend send errors now surfaced instead of logged as "sent" (2026-08-02) — promoted to launch-critical per Bible Addendum 2
- [x] `has_physical_release` migration applied 2026-08-02 evening via the Supabase Management API (a fresh personal access token unblocked this — the previous session's keychain token was expired). Unblocked the per-game release-time prediction feature (`/games/[slug]/release-time` now shows one specific predicted rule instead of all four generically) and the launch-burst-poll extension above. Column is `null` for every existing row until the next daily catalog sync repopulates it from Nintendo's `editions` field — no regression in the meantime, existing rows just fall back to the digital-only default (same as before).
- [ ] Bounce visibility for email — **code done 2026-08-02** (`src/app/api/webhooks/resend/route.ts` + `email_suppressions` table migration). The `email_suppressions` table migration was also applied 2026-08-02 evening (same Management API token), confirmed live. Still blocked on one manual step: register the webhook URL (`https://www.blippd.app/api/webhooks/resend`) in the Resend dashboard so bounce/complaint events actually get sent — no API path for this, needs the dashboard. Launch-critical per Bible Addendum 2.

### Pre-Launch Polish (Current Focus)

**High-impact features:**
- [x] Landing page at `/` — live stats, CTAs, trust signals (2026-03-17)
- [x] "Set my target price" on game detail — `target_price` column on `user_game_follows`, progress bar, edit/remove (2026-03-17)
- [x] Price history chart on game detail — bar chart from `price_history` jsonb, shows when 3+ data points (2026-03-17)
- [x] Share a deal card — Web Share API + clipboard fallback on game detail (2026-03-17)

**Retention / stickiness:**
- [x] "My Savings" counter on profile — always visible, contextual message when $0 (2026-03-17)
- [x] Target price progress indicator — progress bar + "Target $X" on game card, "HIT TARGET!" when reached (2026-03-17)
- [x] "Last price drop" on game detail — shows days since last sale/price drop alert (2026-03-17)
- [x] "X people watching" on game detail — follower count per game (2026-03-17)

**SEO / organic growth:**
- [x] `/deals` public page — SSR with ISR, schema.org ItemList, stats, ATL section, CTA (2026-03-17)
- [x] Product schema.org markup on `/game/[slug]` — JSON-LD with offers.price (2026-03-17)

**Quick wins:**
- [x] Haptic feedback on follow/unfollow — `navigator.vibrate(10)` on tap (2026-03-17)
- [x] Pull-to-refresh on all pages — global PullToRefresh component in layout (2026-03-17)
- [x] Better empty states — Watchlist tab has "Discover games" CTA (2026-03-17)

### V2

- Expo iOS app
- Trailer-to-franchise matching pipeline
  - YouTube RSS -> Claude API game/franchise match
  - 85% confidence -> auto-publish alert
  - <85% -> held for manual approval at /admin/trailers
  - Admin queue: Approve / Reject / Reassign -> fires alert to followers
- AI "Should I Buy Now?" on game detail page
  - Feed: price history + sale frequency + current discount % + ATL status -> Claude API -> one sentence

### Post-V2

- Publisher/developer following (e.g. follow Devolver Digital)
- Franchise following (e.g. follow "Zelda", "Mario")
- Platform expansion (PlayStation, Xbox, Steam) — ~2 days schema work

## SEO Strategy

Per-game release time pages: `/games/[slug]/release-time`

~~Nobody owns per-game launch time answers. Low competition, high intent.~~ — **needs a correction (2026-08-02, per Fable research):** true that no deal-tracking competitor (NT Deals, Deku, NTPrices) has release-time pages, but those SERPs are actually owned by gaming press (IGN, Nintendo Life, Polygon), Nintendo's own pages, and Wikipedia — all near-DA100. A new domain won't crack that ranking regardless of technical SEO quality; keep these pages for their genuine UX value (the launch-time prediction helps users directly), not as a near-term traffic play.

**The actually-viable programmatic SEO angle, per the same research: per-game price-history/current-sale-status pages** ("[game] price," "[game] Nintendo eShop sale") — this is what Deku Deals and NTPrices both rank for. Worth considering as a future SEO investment if/when that becomes a priority; not something to build now given the users-first sequencing below.

**Important correction from a second research pass (2026-08-02): even for the category leaders, SEO is not actually the primary channel.** Per Semrush, DekuDeals gets 77.81% of traffic from Direct and only 9.32% from Google; IsThereAnyDeal is ~64% Direct vs ~29% Organic Search, and its top organic keywords are almost entirely branded ("isthereanydeal"), not per-game queries. These are loyalty/return-visit businesses — SEO is a supporting long-tail channel, not the growth engine, even at their scale. This directly reinforces the already-locked users-first sequencing (Marketing Strategy below): retention is what actually sustains this category, not search traffic. Build per-game pages for long-tail credibility, don't expect them to move the needle on their own.

Nintendo eShop US launch time rules:
- Digital-only -> 9:00 AM PT on release day
- Physical + digital -> 9:00 PM PT night BEFORE release day
- Big Nintendo/Sega/Capcom titles -> Midnight ET
- Some third-party -> 12:00 PM PT on release day

Page elements: inferred launch time, timezone converter, countdown (release week), "Notify me when it goes live" CTA -> follows game.

Competitor comparison page: `/vs/nt-deals` — honest comparison table, ad model difference, notification philosophy. (The Switch 2 catalog row was removed 2026-08-02 — NT Deals fixed that gap, see Competitive Context.)

**Per-game launch time prediction (added 2026-08-02):** the catalog sync captures Nintendo's own `editions` field (Digital vs Digital+Physical) alongside publisher, letting `/games/[slug]/release-time` predict a specific rule per game instead of listing all four generically. **Prediction accuracy is a copy concern, not a correctness concern — decided 2026-08-02, per Fable:**
- Rule-backed predictions (major first-party via publisher match, physical via the editions field) get a specific, confident time ("9:00 AM PT").
- The fuzzy "some third-party" bucket has no reliable signal, so it folds into the digital-only default with hedged phrasing ("typically around 9:00 AM PT") rather than a flat confident claim.
- Critically, the actual "out now" alert is ground truth — it fires from the price-poller when the game genuinely appears live, completely decoupled from whatever this page predicted. A wrong prediction is a mismatched expectation on a page, never a missed or wrong alert. Don't revisit this unless a user actually complains about it.

## Marketing Strategy

**Users first, zero-touch launch (Decided 2026-08-02, per Fable).** Confirmed: get real users before investing further in content/SEO — a new domain has no crawl authority yet, so SEO payoff is months out regardless of how much content exists. The zero-touch version of "getting users":

- 2-3 one-time launch posts: r/NintendoSwitch's suggestion/self-promo threads (check their rules first, Nintendo subreddits are strict about this), Show HN, a deals-focused Discord.
- Then stop and measure — no ongoing posting/growth-hacking cadence.
- Measure at the next monthly check-in. The metrics that matter are **follows-per-signup** and **week-2 return rate**, not raw signup count.
- This feeds directly into Project Philosophy above: retention data from this is the only signal that would justify treating Blippd as a real product instead of a POC. Users-first isn't just cheaper than SEO — it's the input everything else is waiting on.

## Competitive Context

### NT Deals (closest competitor)

- Founded 2016 by Valerii Chernov (Ukrainian, now based in Dubai)
- Developer entity: IRONPAW FZCO (also builds XB Deals, PS Deals)
- Small team, effectively a passive side project for Valerii now
- iOS app launched 2021, no Android app (promised in 2021, never shipped)
- Premium: $4.99/mo or $29.99/yr
- "Millions of users" (self-reported) — realistic US MAU: 50k-150k

Their exploitable weaknesses:
- ~~Switch 2 catalog broken since June 2025 launch~~ — **stale as of 2026-08-02, per Fable research: fixed.** Switch 2 games now list with current prices and sale end dates across multiple categories. No longer a differentiator — drop this from any comparison copy (`/vs/nt-deals` included).
- **New (2026-08-02): login-required-for-existing-lists friction.** A recent App Store review describes the app newly gating access to existing watchlists behind a forced login — the reviewer deleted the app over it and recommended Deku Deals instead.
- **New (2026-08-02): notifications gated behind popup ads.** Same review: watchlist notifications reportedly require watching a popup ad to receive.
- **New (2026-08-02): reload/search failures during high-traffic periods.** A separate review (Jan 2026) confirms the app failed to reload, making it impossible to see or search new sales — exactly when users need it most.
- Dead support — no email response, account restore broken (confirmed still true)
- Notification spam model — no named sale event awareness

What they do well (don't underestimate):
- Push notifications that fire reliably
- Price history depth (9 years)
- "Desired price" threshold alerts (premium)
- Wishlist + "games I own" collection tracking

### Deku Deals

- Incumbent, multi-platform (Switch + PS + Xbox + Steam)
- ~~Email alerts, no push notifications~~ — **stale as of 2026-08-02: Deku now has an iOS + Android app with push notifications.** The Android app has been on Google Play since December 2023 (over a year old, likely already adopted by their existing base). "Email-only" is no longer an accurate differentiator for Blippd to lean on.
- **New (2026-08-02): quietly monetizing via Patreon.** Homepage now advertises "Deku Supporters browse ad-free and get deal alerts first" — a paid-perk model, not the pure free-tier it used to be. Concrete numbers: ~$471/month from ~245 paid members out of 571 total Patreon members (source: PatreonStats). Useful monetization comparable — see Monetization section.
- 76% direct traffic — strong brand loyalty but weak mobile (still true, though the mobile gap narrowed with the app launch)
- Runs tasteful banner ads

### New entrants (2026-08-02, per Fable research)

- **NTPrices.com — the most credible new competitor.** A Nintendo Switch/Switch 2 eShop price tracker launched by the PlatPrices team (an established, trusted brand in PlayStation deal-tracking) as a sister site, reusing their proven price-tracking engine. Checks 50+ regional storefronts, full price history, free email alerts, no account required to browse. Starts with real brand equity and an existing cross-promotable user base — worth monitoring closely, potentially worth a direct mention on `/vs/nt-deals` or a new comparison page if it gains traction.
- **eShop Collection: Deals (Android)** — gained real traction: 1,810+ reviews at 4.7 stars as of mid-2026, added custom price alerts + an in-app notification inbox in a July 2025 update. Android-first, not US-specific — worth monitoring, not urgent.
- PageCrawl.io — a generic DIY URL price-tracker now targeting the Switch niche, not a games-catalog/follows-based tracker. Different audience, not a direct competitor.

## Future Ideas Backlog (Don't Build Yet)

- Gift card arbitrage alerts
- Rarity scoring
- Discord bot
- "The deal you missed" onboarding
- Budget mode
- Multi-region support
- SMS notifications

## Key Pages & Features Built

| Page | Status | Notes |
|---|---|---|
| `/home` | Done | Discover/Watchlist/Franchises tabs, search, Direct banner, sale banner |
| `/game/[slug]` | Done | Price, follow, own, notify prefs, price history chart, eShop link |
| `/games/[slug]/release-time` | Done | SEO page: countdown, timezone converter (8 zones), launch time rules, Schema.org |
| `/upcoming` | Done | Out Now / Coming Soon tabs, platform filter, critic ratings on cards |
| `/sales` | Done | Active deals |
| `/alerts` | Done | User's notification feed |
| `/profile` | Done | Stats, owned games, watchlist, franchises, savings |
| `/settings` | Done | Account (auth provider badge), console switcher, notification toggles, push enable |
| `/deals` | Done | Public SSR deals page with structured data |
| `/vs/nt-deals` | Done | SEO comparison table |
| `/privacy` | Done | Privacy policy |
| `/terms` | Done | Terms of service |

### Settings page features
- Console preference switcher (Switch vs Switch 2) — saves immediately, color-coded
- Auth provider badge (Google / Apple / Email) on account row
- Push notification enable/disable
- Email and weekly digest toggles

## Response Format for Claude Code Sessions

When helping with Blippd, default to:
1. Requirements -> Data model changes -> Implementation -> Risks
2. Copy-paste ready code
3. Flag risks explicitly
4. MVP-first, no over-engineering
5. Mobile-first UI decisions

## Competitor Intelligence: Deku Deals & NT Deals User Reviews

### What users love (build this well or they'll go back)
- Saving real money — users cite exact dollar amounts saved. The value prop is financial, not discovery. Lead with it.
- Price history: highest, lowest, average, and "last time it was at this price." Users use this to decide whether a current sale is actually good.
- Free push notifications. Any paywall on notifications = immediate 1-star reviews.
- Fast, smooth search. This is table stakes — if search lags, users mention it every time.
- Wishlist + alert combo. Users want to set it and forget it, then get notified. The less friction, the better.

### What users hate (do not repeat these mistakes)
- Delayed or unreliable push notifications. The #1 complaint on both apps. Users will tolerate a lot but not missed alerts — that's the whole point of the app.
- Aggressive or intrusive ads. NT Deals reviewers specifically said ads "tank the experience" despite loving everything else.
- Auth/login bugs. NT Deals has users who can't register at all. Broken auth = zero retention.
- Being logged out constantly. Deku Deals users complain about having to re-login. Session persistence matters.
- Missing games. If a user searches for a game and it's not there, they lose trust immediately.
- Paywalling core features. Desired price threshold behind NT Deals premium = resentment. Keep the free tier generous.
- No way to filter unreleased games from watchlist. Small but frequently mentioned.
- Price charts that are hard to tap on mobile. Interactive charts need large touch targets.

**Concrete failure-mode examples (2026-08-02, per Fable research — across the broader deal-alert space, not just NT/Deku):**
- **"Sold out by the time I got the alert."** A Slickdeals user on a Switch stock drop: alert arrived 27 minutes after the deal posted — already sold out. This is exactly the scenario Blippd's 10-min cron cadence exists to prevent; a slower pipeline than this is worse than no alert at all.
- **Silent bounce = silent alert death.** Users went weeks/months without alerts because one bounced email silently disabled all future sends, with zero indication to the user that anything had stopped. Confirmed via Slickdeals support's own admission. This is a real risk for Blippd's Resend-based email alerts too — worth checking whether a bounce silently suppresses future sends for that user with no visibility.
- **Stale subscriptions.** Users report getting alerts for items they already removed from their list — a dedup/cleanup gap, not a delivery gap.
- **Ad-gated notifications (NT Deals specific).** A reviewer says watchlist notifications require watching a popup ad first. Users who don't tolerate that simply never see their alert.
- **Spam trains users to ignore.** Alerts that don't match a user's actual subscriptions get flooded, and users adapt by ignoring notifications from the app entirely — the batching/dedup discipline already built into Blippd (5+ price alerts = one digest) directly guards against this.
- **Duplicate-alert bugs happen even to category veterans, at real scale (2026-08-02, per second Fable research pass).** CamelCamelCamel's own Jan 2025 postmortem: a bug "accidentally recreate[d] price watches for all wishlist items," affecting ~158,000 users with duplicate watches and flooded emails, live for 4 days before the fix. Directly validates prioritizing the alerts-dedup work (#15 in the audit fix list) rather than treating it as a nice-to-have.
- **CamelCamelCamel's own words on what "reliable" actually requires:** after admitting alerts were arriving so late "their pricing data appears incorrect," their fix was re-prioritizing alert-processing infrastructure so "price watch alerts are treated like the First Class passengers they are" — i.e. alert delivery needs to be a first-class, monitored system, not an afterthought bolted onto the main pipeline.

The through-line: across this whole space, the trust failure is almost always "I didn't get it" or "I got it too late," essentially never "I got too many." Blippd's passive alert model (follow → alert fires → buy on console, no ad-gating, no login-wall surprises) already sidesteps most of what's actively breaking trust for NT Deals right now.

### Blippd design principles derived from this
- Notifications must fire fast. If an alert is delayed more than a few minutes, it feels broken.
- Never break auth. Magic link must work flawlessly every time — this is Blippd's only login method.
- Free tier should include: follows, notifications, price history, search. Paywall only advanced features (multi-region, instant vs. batched alerts, etc.).
- Show price context on every game: current price, historical low, % off. Users make purchase decisions based on this.
- Mobile-first touch targets on all interactive elements, especially price charts and game cards.
- Session persistence: users should never have to re-authenticate unless they explicitly log out.
- Game catalog coverage matters. If a user's game isn't there, they churn. Prioritize catalog completeness.

## Hard-Won Lessons (read before debugging anything)

Distilled from five months of incidents. Full narratives:
`docs/SESSION-HISTORY.md`. These are recurring **classes**, not one-off bugs,
and most of them bit more than once before being named.

1. **Any unbounded `.select()` over a table with >1,000 rows is wrong.**
   PostgREST silently caps at 1,000 and returns no error. Five confirmed
   instances (sitemap, weekly-digest, catalog sync's existence check, the
   false-out-now alert-history guard, the unread-count read statuses). The
   catalog-sync one was the real root cause of every "$0 price corruption"
   wave, which had been misattributed to Nintendo's API for two days. Use a
   `.range()` loop; grep for unbounded selects when touching queries.
2. **A migration file in the repo does not mean it was applied to prod.**
   Three real instances, one of which (`onboarding_completed`) silently
   trapped every user in an onboarding loop for five months. A full sweep on
   2026-08-03 confirmed everything else is applied; only `price_snapshots` is
   knowingly absent. Verify against live schema before assuming a column exists.
3. **Supabase writes fail silently in two distinct ways.** A missing RLS
   UPDATE policy makes `.update()` match zero rows and still return
   `error: null` (this made per-game notify prefs and target prices no-ops for
   months). And a swallowed `error` object hides schema mismatches
   indefinitely. Check row counts, surface errors.
4. **Changing what a shared signal means breaks the consumers you forgot.**
   Suppressing junk DLC (correctly) starved `sync-release-dates`' queue.
   Fixing $0 prices (correctly) made a release-date fallback fire false "out
   now" emails. Enumerate every consumer of a signal before changing it.
5. **Verify with an unbounded query on the defining condition.** Three
   successive passes at counting one incident gave 10, then 27, then the real
   62, because each sampled an inbox or a time window instead of asking the
   database the actual question. Same discipline applies to "is it fixed" — a
   "the fix holds" checkpoint on 2026-08-03 was simply wrong, and the wave ran
   for hours past it.
6. **Do not trust a "fixed" claim, including your own from earlier the same
   session.** Several audit items marked done were half-done (touch targets
   applied to one branch of a component, `is_suppressed` filtered in 3 of 6
   alert paths). Re-read the code.
7. **External services do fail, but rule yourself out first.** YouTube's RSS
   endpoint is genuinely, permanently broken (platform-wide, not us; the two
   crons that depend on it are non-critical and left to decay). The Nintendo
   price API $0s were *us*. Blaming the vendor first cost two days.
8. **Manually triggering a cron dozens of times compresses weeks of
   production behavior into an evening.** That is how the 499-game "released
   today" incident reached that scale. Throttle once a fix is verified twice.
9. **`git push origin main` pushes local `main`, not HEAD.** A stray branch
   once absorbed a whole session's commits while every push reported
   "Everything up-to-date." Check `git rev-parse --abbrev-ref HEAD`.
10. **`UID` is readonly in zsh** and fails with a confusing "bad math
    expression," which can leave half-created test fixtures behind.
11. **Verification discipline that actually works here:** `tsc --noEmit` +
    `npm test` + `next build` before every commit, one concern per commit, and
    a live check against the REST API or a real cron trigger whenever a change
    touches a query filter or cron behavior. Two confirming runs, then stop.

## Current State (2026-08-17)

**Account deletion** exists as of 2026-08-17 (`/api/account/delete` + Settings
row + privacy copy), closing the App Store 5.1.1(v) blocker and a real web gap.

**Pipeline:** healthy. Alerts generating, 0 undispatched, junk-alert fix holding
(zero DLC/bundle `out_now` since 2026-08-03). Health-check's three standing
"problems" are known-benign: YouTube RSS 404s on detect-directs/detect-trailers,
and Catalog Sync "status 5" (cron-job.org's 30s caller timeout while the sync
completes fine server-side).

**Launch readiness** (recommendation, not a gate). Green: burst polling built,
Resend errors surfaced + bounce webhook live, magic link verified on desktop,
zombie sale banners gone. Still open:
- An end-to-end dress rehearsal on a phone: follow a game, get the real email,
  click through.
- A magic-link check specifically from a phone email app's in-app browser (the
  PKCE failure mode).
- Burst-poll verified against a real release. **Fire Emblem: Fortune's Weave,
  2026-09-17** is the first valid opportunity: it is followed, `TITLE`, Nintendo
  first-party, so the predicted window is midnight ET / 9pm PT on the 16th.
  Calibration only produces valid data for a game someone follows before it
  releases.

**Open decisions the founder owns** (nothing proceeds on these without a call):
1. Landing headline still leads deals-first ("Never miss a Nintendo deal")
   against the Bible's locked launch-first positioning.
2. Whether franchise-triggered alerts belong in the in-app alerts feed. The
   "via {franchise}" source chips are built but never render without it.
3. Notification voice: three copy variants per alert type drafted, none picked.
   Any session editing notification/email templates must prompt first.
4. `release_date_set` email is drafted but deliberately not wired
   (`docs/DRAFT-release-date-set-email-template.md`).

**iOS app: greenlit 2026-08-17, in progress.** The retention gate that used to
block it was repealed by the founder the same day. Plan and phases:
`docs/MOBILE-APP-PLAN.md`. Phase 0 (server-side) is fully shipped.

**Known open work, deliberately deferred:** non-pill back links and filtered
Clear-all semantics (both founder taste calls, `docs/audit-2026-08-05/`),
named-sale dedup-key refinement, detect-trailers routing through
`insertAndDispatch`, and the mobile app plan (`docs/MOBILE-APP-PLAN.md`, gated
greenlit 2026-08-17; its Phase 0 server-side items are all shipped).

**Second account exists:** `hwgrrdtbrg@privaterelay.appleid.com` (Apple private
relay, created 2026-03-17, last sign-in 2026-03-20). Either a real early user or
the founder's own Apple sign-in. Relevant before reading retention numbers.

## Session History

Everything chronological — every session log, the 2026-08-02 40-item audit and
its fix batches, the false-alert incidents, the 2026-03-22 page restructure —
now lives in `docs/SESSION-HISTORY.md`, verbatim. It was moved out on 2026-08-17
because this file had reached 256KB and is loaded into every session's context.
Read it for the story behind any rule above. Add new session logs there, not here.
