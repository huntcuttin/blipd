# Blippd — Claude Code Context Document

## Workflow Rules
- **Always push after committing.** After every `git commit`, immediately run `git push origin main` without asking. Every commit should be deployed.

## Credentials & API Keys
- **cron-job.org API key:** `nXnh2WcO/qDxLTG/g2LW5dilu7fgfBLTqtpgP5OkLcg=` — use `Authorization: Bearer <key>` against `https://api.cron-job.org`
- **Supabase project ref:** `cigsitwnhfnndtidrjjo` — management API via `https://api.supabase.com/v1/projects/{ref}/database/query` with Bearer token from macOS keychain (`security find-generic-password -a "supabase" -w | base64 -d`)
- **Admin email:** `huntcuttin@gmail.com`

## What This Is
Blippd is a Nintendo eShop price alert app — "Beepr for Nintendo." Users follow games and get alerted the moment something changes. The goal is a clean, reliable side project that wins the US Switch niche by being definitively better at the one thing that matters: the alert fires, it's accurate, and it doesn't spam you.

- **App name:** Blippd (not Blipd — that's trademarked by a Virginia company)
- **Domain:** blippd.app (purchased, pointing to Vercel)
- **Company:** Westside Software LLC (or similar holding entity, never customer-facing)

## Locked Stack

| Layer | Tool |
|---|---|
| Frontend + Backend | Next.js 14 (App Router) |
| Database + Auth | Supabase (Postgres + magic link) |
| Email | Resend — sender: alerts@blippd.app |
| Hosting | Vercel (free tier) |
| Cron | cron-job.org (9 jobs configured) |
| Payments | None (ad-supported, free forever) |
| iOS (v2) | Expo / React Native |
| Data | nintendo-switch-eshop npm + ITAD API + IGDB API + Algolia |

## Monetization

- **Free forever:** Unlimited follows, email alerts, web push notifications — no paywall.
- **Ads:** Carbon Ads at 5k+ users (light touch, banner only, never interstitials). No Stripe, no subscription tier.
- Stripe removed from roadmap entirely.

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

- Price drop
- Sale started
- Sale ending soon (v1.5)
- Out now (game released)
- Release date changed

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

## UX Decisions (Locked — Don't Re-litigate)

- Follow a game or franchise = per-category notification preferences (announcements, sales, all-time low, releases). Default all-on, customizable from detail page.
- No "Buy Now" CTA. Alerts are passive. Purchase happens on console.
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

Nobody owns per-game launch time answers. Low competition, high intent.

Nintendo eShop US launch time rules:
- Digital-only -> 9:00 AM PT on release day
- Physical + digital -> 9:00 PM PT night BEFORE release day
- Big Nintendo/Sega/Capcom titles -> Midnight ET
- Some third-party -> 12:00 PM PT on release day

Page elements: inferred launch time, timezone converter, countdown (release week), "Notify me when it goes live" CTA -> follows game.

Competitor comparison page: `/vs/nt-deals` — honest comparison table, surfaces Switch 2 catalog issue, ad model difference, notification philosophy.

## Marketing Strategy

Deferred until the app is ready. Focus on product quality first.

## Competitive Context

### NT Deals (closest competitor)

- Founded 2016 by Valerii Chernov (Ukrainian, now based in Dubai)
- Developer entity: IRONPAW FZCO (also builds XB Deals, PS Deals)
- Small team, effectively a passive side project for Valerii now
- iOS app launched 2021, no Android app (promised in 2021, never shipped)
- Premium: $4.99/mo or $29.99/yr
- "Millions of users" (self-reported) — realistic US MAU: 50k-150k

Their exploitable weaknesses:
- Switch 2 catalog broken since June 2025 launch (9+ months)
- Ads are aggressive — triggered by search, forces subscription to escape
- Dead support — no email response, account restore broken
- Notification spam model — no named sale event awareness
- Founder's attention is on Dubai real estate, not the product

What they do well (don't underestimate):
- Push notifications that fire reliably
- Price history depth (9 years)
- "Desired price" threshold alerts (premium)
- Wishlist + "games I own" collection tracking

### Deku Deals

- Incumbent, multi-platform (Switch + PS + Xbox + Steam)
- Email alerts, no push notifications
- 76% direct traffic — strong brand loyalty but weak mobile
- Runs tasteful banner ads

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

### Blippd design principles derived from this
- Notifications must fire fast. If an alert is delayed more than a few minutes, it feels broken.
- Never break auth. Magic link must work flawlessly every time — this is Blippd's only login method.
- Free tier should include: follows, notifications, price history, search. Paywall only advanced features (multi-region, instant vs. batched alerts, etc.).
- Show price context on every game: current price, historical low, % off. Users make purchase decisions based on this.
- Mobile-first touch targets on all interactive elements, especially price charts and game cards.
- Session persistence: users should never have to re-authenticate unless they explicitly log out.
- Game catalog coverage matters. If a user's game isn't there, they churn. Prioritize catalog completeness.

## Page Audit (2026-03-22)

### Current Nav Structure
4 bottom tabs: Home, Deals (Sales), Feed, Alerts

### What Each Page Shows

| Page | Content | Filters/Tabs |
|------|---------|-------------|
| **Home** | Two tabs: Discover (trending games + genre filter) and My Games (watchlist split into on-sale/watching/owned + franchises + suggested franchises) | 2 tabs + 12 genre pills + swipe |
| **Sales** | All games on sale + named sale banners + ATL horizontal scroll | 3 tabs (All/Watchlist/My Franchises) + 4 sort pills |
| **Feed** | Out Now (horizontal scroll) + Coming Soon (list) + Direct/sale banners | None |
| **Alerts** | User's notification history grouped by time | 4 filter pills |

### Data Overlap Analysis
- **Discover tab on Home** ≈ **Sales page** — both show games with prices, both have search. Discover shows ALL games (trending), Sales shows ON SALE games. But a user looking for deals goes to Sales, and a user browsing goes to Discover. These are different intents.
- **My Games tab on Home** is the ONLY place to see your watchlist and franchises. This is the most important personal data in the app and it's buried as a sub-tab.
- **Sales page** has Watchlist/My Franchises filters that duplicate My Games tab filtering. Users see "my stuff on sale" in two places.
- **Feed page** shows Out Now + Coming Soon — this is the "Upcoming" concept from the original nav. It works but "Feed" is a vague name.
- **Alerts** is clean and standalone. No overlap.

### Core Problems
1. **Home has two unrelated jobs** — browse/discover AND personal watchlist. These are different user intents crammed into tabs.
2. **Sales page re-implements Home's personalization** with its own Watchlist/Franchises tabs. Redundant.
3. **"Feed" is a meaningless name** — it's really "New & Upcoming." Users won't know what to expect.
4. **Too many filter dimensions** — Sales has 3 filter tabs × 4 sort pills = 12 possible states. That's too much for mobile.

## Proposed Restructure

### Decision: Option A — Home becomes personalized dashboard

**Why:** The app's value prop is "follow games, get alerted." Home should immediately show the user THEIR games — what's on sale in their watchlist, their franchises, price drops they care about. Discovery/browsing is secondary and belongs on Sales (for deals) or the new Upcoming page (for releases).

### New Page Structure

| Nav Tab | New Name | Purpose | Content |
|---------|----------|---------|---------|
| **Home** | Home | **Your games at a glance** | Sale alerts on followed games → full watchlist → followed franchises. No tabs. One scrollable personal dashboard. |
| **Deals** | Deals | **All deals, sorted** | Named sale banners → ATL scroll → all on-sale games with sort pills only (no Watchlist/Franchises tabs). Search. |
| **Upcoming** | Upcoming | **New & coming soon** | Direct/sale banners at top → Out Now horizontal scroll → Coming Soon list. Replaces "Feed." |
| **Alerts** | Alerts | **Notification history** | Unchanged. Already clean. |

### What Moves Where

1. **Discover tab (Home)** → DELETE. Trending games concept merged into Deals page (Best Deals sort already does this). Genre filter stays on Deals.
2. **My Games tab (Home)** → PROMOTED to be the entire Home page. No tab needed — it's the default view.
3. **Sales Watchlist/Franchises tabs** → DELETE. Home now shows "your stuff on sale" prominently. Sales is just ALL deals.
4. **Feed** → RENAMED to "Upcoming" in nav. Content stays (Out Now + Coming Soon).
5. **Genre filter pills** → MOVED from Home to Deals page (replaces the removed Watchlist/My Franchises tabs).

### Why This Is Better
- **Home instantly answers "what should I care about?"** — your games on sale, your watchlist, your franchises. One scroll, no tabs.
- **Deals is simpler** — just deals with sort options. No personalization filters that duplicate Home.
- **"Upcoming" is a clear name** — user knows what to expect before tapping.
- **Cognitive load drops** — Home goes from 2 tabs + 12 genre pills to 0 tabs. Sales goes from 3 tabs + 4 sorts to 0 tabs + 4 sorts. Total filter controls across the app drops from 23 to ~8.

## Session Log — 2026-03-22 (Page Restructure)

### Final Page Structure Implemented

| Nav Tab | Label | Purpose | Content |
|---------|-------|---------|---------|
| Home | Home | Personal dashboard | DirectBanner → On Sale Now (followed games) → Watching for Deals → My Library → My Franchises. No tabs. |
| Deals | Deals | All current deals | Sale event banners → genre filter pills → ATL horizontal scroll → sorted game list (4 sort options) |
| Upcoming | Upcoming | New & coming releases | DirectBanner → sale banners → Out Now (horizontal scroll) → Coming Soon (list) |
| Alerts | Alerts | Notification history | Time-grouped alerts with filter pills. Unchanged. |

### What Changed
- **Home**: Removed Discover/My Games tabs. Now a single scrollable personal dashboard.
- **Deals (Sales)**: Removed Watchlist/My Franchises filter tabs. Added genre filter pills (moved from old Discover tab). Sort pills remain.
- **Feed → Upcoming**: Renamed. Replaced inline banners with shared DirectBanner/NamedSaleBanner components.
- **Alerts**: Unchanged.

### What Was Removed
- Discover tab and trending games on Home (discovery happens via Deals + Search)
- Watchlist/My Franchises filter tabs on Sales
- Swipe gesture handling on Home (no tabs to swipe between)
- Inline Direct/sale banners on Upcoming (replaced with shared components)

### Tradeoffs
- Users can no longer browse "trending games" without going to Deals. Trade: simpler Home, and the Deals page sort-by-Best-Deals serves the same purpose.
- Deals page no longer shows "your followed games on sale" as a filtered tab. Trade: Home prominently shows this as the first section.

## Session Log — 2026-03-18 (Overnight Audit)

### UI Audit — Green Hierarchy Fix (6 cycles)
**Problem:** Accent green (#00ff88) was used on everything simultaneously — active tabs, Following buttons, filter pills, nav icons, alert borders, franchise links, profile avatars, hover states. It created visual noise instead of directing attention.

**New hierarchy:**
- Green reserved for: sale prices, discount badges, PRICE DROP/ATL badges, primary CTA buttons, toggle "on" states, unread alert dots, alert count badges
- Following/followed buttons: muted white fill on dark background (not green)
- Active filter pills and tabs: white/off-white text on subtle bg (not green)
- Hover states on links/borders: neutral gray (not green)
- Profile avatar: white initial on gray (not green)
- BottomNav active: white text + white indicator bar (not green)

### Card Layout Fixes
- **"I own this" button** — was floating disconnected below its card. Moved inside GameCard via `ownAction` prop, renders as a small inline button in the Follow button column
- **Feed badges (NEW/SOON/DEMO)** — were overlapping Follow button in top-right. Moved to top-left of cover art with unified neutral style (black/white, no color variation)
- **Title truncation** — compact cards and deals page changed from `truncate` to `line-clamp-2`
- **Franchise thumbnails** — increased from 40px to 48px, single initial fallback

### Sale Banner Redesign
- Was: small left-aligned pill with text
- Now: full-width gradient card with icon, game count, CTA text

### Urgency Color System
- Sale end labels now use tiered urgency: 1-3 days (red bold), 4-7 days (amber), 8-14 days (muted gray)
- Applied consistently to GameCard and /deals page

### Dead Code Removed
- `SwipeableGameCard.tsx` — unused since consolidation commit
- `FranchiseCard.tsx` — not imported anywhere
- `computeGameScore()` — backward-compat alias, unused
- `DEFAULT_NOTIFY_PREFS` unused import in queries.ts

### Other Fixes
- Removed swipe indicator dots below Home tabs (redundant with tab bar)
- Added `focus:outline-none` globally for buttons/links to prevent blue browser focus rings
- Fixed Watchlist explanatory text left-edge clipping
- Fixed franchise detail fallback: 2-letter → single initial

### Build Status
- Zero errors, 3 pre-existing warnings (img element in /deals, useEffect deps in release-time)

### Needs Human Review
- Admin trailers route (`/api/admin/trailers/[id]`) uses email-based admin check — consider stronger auth if admin panel gets more usage
- Onboarding and Settings pages share console selection UI — could extract shared component if these pages get more complex

### Not Changed (by design)
- Green on primary CTA buttons (brand accent, correct)
- Green on sale prices and discount badges (functional color, correct)
- Green on toggle switches in NotifyPrefsPanel (standard on/off pattern)
- Green on Logo component (brand identity)
- Green glow on input focus states (subtle, appropriate)
- Console.log in server-side cron routes (appropriate for production logging)
- .env.local NOT tracked in git (gitignored correctly)

## Session Log — 2026-03-17

### Production Audit Fixes (8 items)
1. **Auth callback skip onboarding for returning users** — checks `user_profiles.onboarding_completed` before redirect
2. **Console preference syncs to AuthContext** — added `setConsolePreference` setter, Settings page calls it after DB write
3. **Removed duplicate pb-28** from Sales + Upcoming pages (layout.tsx already adds 96px bottom padding)
4. **Lightweight BottomNav alert count** — added `getUnreadAlertCount()` query instead of fetching full `getAlerts()`
5. **ProfileButton overlap fix** — hidden on `/home` route to avoid header button overlap
6. **PWA icons** — generated 180/192/512px PNGs from favicon SVG, added apple-touch-icon + updated manifest.json
7. **GameCard price row overflow** — added `min-w-0` to publisher, `flex-shrink-0` to discount badge
8. **Added Syne + DM Mono fonts** — Syne on page headings + game titles, DM Mono on prices/badges. CSS vars via `next/font/google`, Tailwind `font-syne`/`font-mono` utilities
   - **Note (2026-08-02):** Syne was later removed in commit `fb88067`. App now uses Inter + DM Mono only.

## Audit — 2026-08-02

Cold-read audit after ~4.5 months idle (last commit 2026-03-22). Three parallel code-audit agents + live production checks (cron-job.org API, Supabase REST, Nintendo price API, npm audit). **All findings below verified against code and/or live prod.** Launch readiness: ~60%.

### Live pipeline status (verified 2026-08-02)

| System | Status |
|---|---|
| update-prices + dispatch (10-min via cron-job.org) | ✅ Alive — alerts generated + emails sent today |
| Nintendo price API, YouTube RSS, Resend, site, cron auth | ✅ All healthy |
| sync-catalog (daily), sync-hype (6h), weekly-digest | ✅ Running on schedule |
| **sync-release-dates** | ⚠️ Enabled but **timing out every run** (cron-job.org status 5) → 746/2,934 games (25%) stuck with 2099-12-31 placeholder dates |
| **sync-ratings** | ❌ **Auto-disabled on cron-job.org since ~2026-03-23** (route works when triggered manually: 200 in 29.6s — right at the 30s caller timeout, 40 games/run) |
| **detect-directs, detect-trailers** | ❌ **Auto-disabled since ~2026-04-21** (detect-directs works when triggered: 200 in 9.6s). `nintendo_directs` table is EMPTY — no Direct ever detected |
| **Named sale event detection** | ❌ **Has not executed since 2026-03-22.** Two zombie rows still `active=true`: "Nintendo eShop Sale" (count frozen at 284, only 25 games actually tagged) and "Square Enix Sale" (count 89, **0 games tagged**) → stale banners on /sales that filter to an empty list |
| Web push | ❌ **Never fired once in production** — 0 subscriptions, all 1,007 notification_log rows are email |
| price_snapshots | ❌ Table never created in prod (migration exists; only writer `poll-prices.ts` has zero callers). Price history = monthly-bucket jsonb only (current month overwritten in place) |
| Monitoring | ❌ **Nothing watches the pipeline.** 3 jobs dead 4+ months, unnoticed. Root cause of most decay above |

Scale check: 1 user, 18 follows, 0 push subs, 17,492 alerts, 1,007 emails sent. Alert mix last 30d: 510 sale_started / 280 sale_ending / 106 price_drop / 104 ATL / **0 release alerts**.

### Fix list (prioritized)

**🔴 Critical — security & data integrity**

| # | Issue | File | Effort |
|---|---|---|---|
| 1 | **ROTATE SUPABASE SERVICE_ROLE KEY.** Live key (exp 2036) hardcoded in 8 Python scripts, still retrievable from git history (`git show 6fcf89e:scripts/assign_franchises.py`) on github.com/huntcuttin/blipd. Deleting the files did not revoke it. Rotate in dashboard, then update Vercel + .env.local | git history, `scripts/*.py` | S |
| 2 | Named-sale-event lifecycle broken end-to-end: events never deactivated, `games_count` frozen at creation, tags nulled as sales end (`ingest.ts:639`), detection trigger starved — `else if (isNewSale)` at `ingest.ts:689-694` excludes every sale-onset that reads as a price drop from `newSaleGames`, so the ≥5 gate (`:739`) almost never fires. Fix: decouple newSaleGames from alert branching; deactivate events when tagged count hits 0; recompute counts; hide banner when 0 tagged | src/lib/nintendo/ingest.ts:639,684-694,739,779-856 | M |
| 3 | Cron scheduling split-brain + auto-disabled jobs: re-enable sync-ratings/detect-directs/detect-trailers on cron-job.org, shrink IGDB batches (40→~20) so runs finish <25s, fix sync-release-dates timeout, **delete vercel.json crons** (they double-fire the same endpoints daily at 04:00-09:00 UTC vs cron-job.org's 10-min cadence) | vercel.json, sync-ratings/route.ts:8, sync-release-dates/route.ts:9 | S/M |
| 4 | No pipeline monitoring — add a health-check cron (email/push if no alert generated in N hours, or any cron-job.org job disabled/failing) + enable cron-job.org failure notifications | new | S |
| 5 | `is_all_time_low` flaps off on the next run: current-month history entry is overwritten with the new price, then strict `<` compares price against itself | src/lib/nintendo/transform.ts:37-43 + ingest.ts:643-653 | S |
| 6 | `last_price_check` stamped for all 100 games BEFORE prices validated — an API outage silently skips the whole batch for a full cycle | src/lib/nintendo/ingest.ts:598-612 | S |
| 7 | IGDB circuit breaker poisons rows: after 3× 429s, the unprocessed remainder is written `metacritic_score=0`/`igdb_hype=0` and never retried (query filters on `IS NULL`) | sync-ratings/route.ts:67-77, sync-hype-scores/route.ts:66-76 | S |
| 8 | Nintendo price fetch uses raw fetch — no retry, drops 50-game batches silently on error (retry.ts exists but is only used for YouTube RSS) | src/lib/nintendo/client.ts:141-175 | S |
| 9 | Expired/cross-browser magic links silently bounce to /login with zero explanation (`?error=otp_expired` params never parsed; PKCE verifier loss from email-app in-app browsers unhandled) | src/app/auth/callback/page.tsx:21-55 | S |
| 10 | Push notification layer never validated + broken: sends not logged to notification_log (no dedup — 15-min window vs 10-min cron = doubles), subscription survives sign-out, endpoint hijack possible via `onConflict: "endpoint"` reassigning user_id | src/lib/notifications/push.ts, api/push/subscribe/route.ts:26-31 | M |
| 11 | iOS push unreachable: no add-to-home-screen prompt/instructions anywhere, and the Enable button shows "BLOCKED in browser settings" when the real cause is Safari-not-installed-as-PWA | settings/page.tsx:256-262 | M |
| 12 | DB is unreproducible: no CREATE TABLE baseline for games/alerts/franchises/user_* tables; live-patched objects missing from repo (dedup_key UNIQUE, sale_event_id, has_demo, last_price_check, metacritic_score, notification_log RLS — live RLS verified present); two competing migration dirs (supabase/migrations/ vs migrations/). Run `supabase db dump` as baseline | supabase/migrations/, migrations/ | M |

**🟡 Moderate**

| # | Issue | File | Effort |
|---|---|---|---|
| 13 | /sales renders up to 500 GameCards, no virtualization/pagination; `sortGames`+`deduplicateGames` unmemoized (~9k `computeTrendingScore` calls per keystroke); sale events fetched twice; GameCard `memo` defeated by FollowContext object churn | SalesPage.tsx:92,112, FollowContext.tsx:271-295 | M |
| 14 | Sale-ending scan: unbounded serial loop (~177 games × 2-3 queries each) inside update-prices' 60s budget | ingest.ts:705-736 | M |
| 15 | No cron overlap guard + alert dedup is SELECT-then-INSERT with no DB unique constraint (TOCTOU dupes); `hasRecentAlert` returns true on query error (silently suppresses alerts) | alerts.ts:12-30 | M |
| 16 | Loading-state flashes: /home shows "No games yet" before follows load (read `loading` from useFollow like profile does); /alerts flashes empty pre-auth; franchise page same; unread badge never clears until hard reload; pull-to-refresh is a no-op (router.refresh vs client-side queries) AND fights horizontal scroll (global non-passive touchmove) — unused `usePullToRefresh` hook is the ready-made fix | home/page.tsx:22, alerts/page.tsx:40-43, BottomNav.tsx:12-21, PullToRefresh.tsx:30-59 | S–M |
| 17 | Event-filter dead end on /sales: empty state never mentions the active event filter; "Clear ✕" only renders if a second fetch finds the event | SalesPage.tsx:130-138,204-226 | S |
| 18 | Middleware: `getSession()` instead of `getUser()` (silent logouts); matcher runs auth on /api/cron/*, sw.js, manifest, icons | src/middleware.ts:26,42 | S |
| 19 | `onboarding_completed` checked only in auth callback — returning user with live cookie skips onboarding forever | middleware.ts:29-36 | M |
| 20 | Resend v6 returns errors in `{data, error}` — all 4 send sites ignore it and log status "sent" for failed sends | email.ts:87, send-batch.ts:42,96, weekly-digest:111 | S |
| 21 | weekly-digest loads ALL follows unpaginated (PostgREST 1k cap will truncate audience at scale) | weekly-digest/route.ts:30-32 | M |
| 22 | Sitemap covers ~1,230 of ~2,300 eligible games (row cap); /deals has zero inbound links AND missing from sitemap; /upcoming redirect stub is in sitemap instead of /feed | sitemap.ts, deals/page.tsx | S |
| 23 | No OG image for root/static pages (blank share cards); zero canonical URLs; game OG images 600×375 (below 1200×630) | layout.tsx:37-48 | M |
| 24 | npm: 16 vulns (12 high — ws, svix chain). `npm audit fix` + resend 6.9.3→6.18.1 | package.json | S |
| 25 | Dead deps: @supabase/auth-helpers-nextjs (deprecated, zero imports), nintendo-switch-eshop (zero imports) — uninstall both | package.json:15,19 | S |
| 26 | Stale deps: Next 14.2.35 (→16), React 18 (→19), Tailwind 3 (→4), eslint 8 (EOL), @supabase/ssr 0.9→0.12, @anthropic-ai/sdk 0.78→0.115. Do minor bumps now, majors post-launch | package.json | L |
| 27 | Sale-end dates stored as date-only text, parsed as UTC midnight — "ends today" copy off by up to a day; /deals and GameCard compute countdowns differently (can disagree by a day) | ingest.ts:638,718, deals/page.tsx:46-56 vs GameCard.tsx:261-283 | S |
| 28 | Admin auth split: page hardcodes email, API reads ADMIN_EMAIL env — if env unset, page renders but every action 403s | admin/trailers/page.tsx:9 vs api/admin/trailers/[id]/route.ts:10 | S |
| 29 | detect-trailers feeds unescaped LLM output into `.ilike()` — %/_ wildcards can attach an alert to the wrong game | detect-trailers/route.ts:162-167 | S |
| 30 | `maxDuration=300` on 3 routes needs Vercel Pro (Hobby clamps to 60s) — verify plan; moot for crons once vercel.json crons are deleted | sync-catalog, weekly-digest, dispatch-notifications | S |
| 31 | In-app alert feed ignores notify prefs — user_alert_status written for ALL followers regardless of toggles (email/push correctly filter) | alerts.ts:32-45 | S |

**🟢 Minor / hygiene**

| # | Issue | File | Effort |
|---|---|---|---|
| 32 | Repo litter: 31MB screenshots-audit2/ committed, 1.json (byte-identical package-lock copy), supabase/.temp/ committed (pooler host+ref), .claude/scheduled_tasks.lock tracked-but-deleted, test-audit2.mjs + audit2-report.json, OVERNIGHT_LOG.md/COST_ESTIMATE.md; .gitignore missing supabase/.temp, .claude/, screenshots*; scripts/ is gitignored but `npm run seed`/`sync` depend on it (broken on fresh clone). Note: CLAUDE.md itself commits the cron-job.org API key | repo root | S |
| 33 | NaN price guard: malformed raw_value propagates NaN → nulls current_price via JSON.stringify | ingest.ts:590-594 | S |
| 34 | .env.example missing 7 of 13 required vars (VAPID×3, ANTHROPIC, TWITCH×2, ADMIN_EMAIL); push silently no-ops when VAPID unset | .env.example | S |
| 35 | Design drift batch: 3 filter-pill sizes, header padding differs per route (py-3/4/6), 3 back-button variants, green outside spec (metacritic chip, section headers, onboarding dots, static "ON" pills in settings — which are hardcoded non-interactive badges), detail-page price not font-mono | see frontend audit | M |
| 36 | Dead code: /deals page (orphan — either link it from nav/footer or delete), usePullToRefresh.ts, poll-prices.ts (only price_snapshots writer, zero callers), 8 unused queries.ts exports, isQualityGame | various | S |
| 37 | sw.js: no offline fallback, no skipWaiting/clients.claim (push-fix deploys stall until all tabs close), SVG notification icons (Android wants PNG); dual manifests (manifest.ts SVG-only vs public/manifest.json) — delete manifest.ts | public/sw.js, src/app/manifest.ts | S–M |
| 38 | Mobile a11y: touch targets <44px (franchise back 32px, genre pills 30px, tz select 26px, Direct dismiss 24px, compact follow 36px); price-history chart unusable at 120 points on 430px | various | S each |
| 39 | README is still create-next-app boilerplate | README.md | S |
| 40 | An Expo app scaffold lives in mobile/ (34 tracked files) — excluded from tsconfig but uploaded in every Vercel build context | mobile/ | S |

### Corrections to earlier sections of this doc
- Syne font was REMOVED in `fb88067` — "Syne on headings" above is stale; app uses Inter + DM Mono.
- Cron table says 9 jobs; cron-job.org actually has 12 (4 hit update-prices: base + 3 burst windows). 3 are disabled (see status table).
- "PriceSnapshot table — start accumulating own data now" never happened: table absent in prod, writer never wired. Price history chart rarely renders (needs 3+ points; history is monthly buckets).
- vercel.json also declares 3 daily crons — redundant double-scheduling against cron-job.org. Delete them.
- `sale_started`/named-event claims: sale_started alerts DO fire in prod (510 last 30d) — but named-event detection is starved by the else-if branching (see fix #2).

### Suggested execution order for next session
1. Rotate service_role key (#1) — 10 minutes, do it first
2. Re-enable + right-size the 3 dead crons, fix release-dates timeout, delete vercel.json crons (#3)
3. Named-sale lifecycle fix (#2) — kills the zombie banners (the /sales screenshot bug)
4. ATL flap (#5), last_price_check ordering (#6), IGDB zeroing (#7), price-fetch retry (#8) — one batch, all S
5. Health-check dead-man's switch (#4)
6. Magic-link error surfacing (#9) + /home loading flash (#16 first item)
7. `npm audit fix`, remove 2 dead deps, bump resend (#24, #25)
