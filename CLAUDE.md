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
