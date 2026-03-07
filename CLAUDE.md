# Blippd — Claude Code Context Document

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
| Cron | cron-job.org (7 jobs configured) |
| Payments | Stripe (v1.5) |
| iOS (v2) | Expo / React Native |
| Data | nintendo-switch-eshop npm + ITAD API + IGDB API + Algolia |

## Monetization

- **Free:** Follow up to 5 games, email alerts
- **Pro ($3/mo via Stripe):** Unlimited follows, instant alerts, future push notifications
- No ads at launch. Carbon Ads considered at 5k+ users (light touch, never interstitials).

## Database Schema (Core Tables)

### Game
- id, nsuid, title, slug, publisher, developer
- CatalogTier (top500, full)
- price_us, msrp_us
- releaseDate, platform
- igdb_id, igdb_hype

### PriceSnapshot
- id, game_id, price, msrp, discount_pct, is_on_sale
- captured_at, sale_id (nullable — links to NamedSaleEvent)

### UserWatch
- id, user_id, game_id, created_at

### NotificationLog
- id, user_id, game_id, alert_type, sent_at, channel

### UserAlertState
- id, user_id, game_id, status (seen/remind/dismissed), updated_at

### NamedSaleEvent
- id, name ("Mar10 Sale", "Black Friday Drop", "Nintendo Direct Sale")
- detected_at, active, games_count

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

- Follow a game = receive ALL alert types for it. No per-alert toggles.
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

- [ ] Connect blippd.app domain to Vercel — DNS records added in Namecheap, propagating
- [ ] Add blippd.app to Resend, update sender to alerts@blippd.app
- [ ] Rename Blipd->Blippd everywhere in codebase (exclude node_modules, .next, lock files)
- [ ] Update cron-job.org endpoints if Vercel URL changed

### MVP (Current Focus)

- Confirmed email alerts firing end-to-end
- Stable catalog + pricing pipeline
- Domain live on Vercel
- Top 500 game catalog seeded

### V1.5

- Stripe Pro tier ($3/mo)
- Web push notifications
- "Sale ending soon" alert type
- Named sale event detection + two-tier notification system
- Notification batching rule (5+ games = one digest)
- Per-game release time SEO pages (/games/[slug]/release-time)
- Nintendo Direct detection banner (YouTube RSS)
- IGDB hype score on Upcoming page
- Weekly digest re-engagement email

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
- "My Savings" counter (running total saved per user)

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

### Reddit Launch Plan

Origin story hook:
> "On December 22, 2025, Cyberpunk 2077 was accidentally 75% off on Switch 2 eShop for a few hours (CDPR swapped discount percentages with The Witcher 3). Most people missed it. I built Blippd so you never miss that again."

Timing: Post when the next major Nintendo sale drops. Use origin story as hook, tie to the live sale as immediate reason to sign up.

Subreddits: r/NintendoSwitch, r/patientgamers, r/NintendoSwitchDeals

Rules:
- Build ~25+ karma first by participating genuinely
- Frame as story, not ad
- Reply to every comment personally in first 2 hours
- One great post at the right moment beats ongoing presence

Priority order (don't deviate until 1,000 users):
1. Working product with confirmed alerts
2. One Reddit post at right moment
3. Passive SEO from game detail pages
4. Skip Twitter/X, TikTok, ProductHunt until 1k users

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

These are captured for later evaluation. None are in active scope.

- Gift card arbitrage alerts
- "My Savings" counter
- Rarity scoring
- Discord bot
- Publisher/developer following
- "The deal you missed" onboarding
- Shareable deal card
- Budget mode
- "Rarely goes on sale" badge
- Multi-region support
- SMS notifications

## Response Format for Claude Code Sessions

When helping with Blippd, default to:
1. Requirements -> Data model changes -> Implementation -> Risks
2. Copy-paste ready code
3. Flag risks explicitly
4. MVP-first, no over-engineering
5. Mobile-first UI decisions
