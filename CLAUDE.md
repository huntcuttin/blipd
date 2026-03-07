# Blipd - Project Instructions

## Project Overview
Nintendo eShop price tracker & alert app. Mobile-first, dark theme with neon green (#00ff88) accent. Competitor: DekuDeals (desktop-focused).

## Working Style
- Response format: Requirements -> Data model -> Event rules -> Architecture -> MVP build plan -> Backlog
- MVP-first, mobile-first, explicit tradeoffs. No fluff. Direct answers only.
- Flag risks explicitly. Use tables for schemas and comparisons. Write copy-paste ready code.
- When in doubt, do less and do it right. Don't scaffold ahead of validated need.
- **SQL migrations:** Always paste the full SQL directly in chat for the user to copy-paste into Supabase SQL Editor. Never just reference a file path — the user cannot open migration files directly.

## Tech Stack
- Next.js 14 (App Router), React 18, TypeScript 5, Tailwind CSS 3.4
- Supabase (Postgres, Auth via magic link)
- Deployed on Vercel

## Commands
- `npm run dev` — local dev server (Next.js)
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — ESLint
- `npm run seed` — seed DB with test data (`tsx --env-file=.env.local scripts/seed.ts`)
- `npm run sync` — run initial catalog sync (`tsx --env-file=.env.local scripts/initial-sync.ts`)

## Directory Structure
```
src/
  app/                    # Next.js App Router pages
    api/cron/             # Vercel cron endpoints
    game/[slug]/          # Game detail page
    franchise/[name]/     # Franchise detail page
    onboarding/           # Console selection (post-auth, one-time)
    home/, sales/, alerts/, login/
  components/             # Shared UI components
  lib/
    supabase/             # client.ts, server.ts, types.ts, index.ts
    nintendo/             # client.ts, ingest.ts, transform.ts, alerts.ts, admin-client.ts, types.ts
    AuthContext.tsx        # Auth provider
    FollowContext.tsx      # Follow state provider
    queries.ts            # Supabase query helpers
    ranking.ts            # Game scoring/ranking
    types.ts              # App-level types
scripts/                  # seed.ts, initial-sync.ts
migrations/               # SQL migration files
```

## Coding Conventions
- Server components by default; `"use client"` only for interactive components
- PascalCase components, kebab-case utils
- Tailwind only — inline hex arbitrary values (`text-[#00ff88]`), no CSS vars, no component library
- Minimal barrel exports (only `supabase/index.ts`)
- Icons as inline SVG functions (heroicons style)
- Row mappers convert snake_case DB rows to camelCase TS models

## Supabase Patterns
- **Browser:** `createClient()` from `src/lib/supabase/client.ts`
- **Server:** `createServerClient()` from `src/lib/supabase/server.ts`
- **Admin:** `createAdminClient()` from `src/lib/nintendo/admin-client.ts` (service role)
- Never expose the service role key to the browser

## Environment Variables

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Admin operations (ingestion, seeds) |
| `CRON_SECRET` | server only | Auth header for Vercel cron endpoints |

## Data Model

### games
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, auto-generated |
| slug | text | Unique, URL-safe |
| title | text | |
| publisher | text | |
| franchise | text? | Nullable, auto-detected |
| cover_art | text | Image URL |
| current_price | numeric | Current selling price |
| original_price | numeric | MSRP |
| discount | numeric | Percentage off (0-100) |
| is_on_sale | boolean | |
| is_all_time_low | boolean | |
| release_date | text | ISO date string |
| release_status | enum | `released`, `upcoming`, `out_today` |
| metacritic_score | int? | |
| sale_end_date | text? | |
| price_history | jsonb | `[{date, price}]` array |
| nsuid | text? | Nintendo store ID, unique |
| nintendo_url | text? | |
| last_price_check | timestamptz? | For staleness ordering |
| switch2_nsuid | text? | nsuid of Switch 2 edition if exists |
| upgrade_pack_nsuid | text? | nsuid of upgrade pack if exists |
| upgrade_pack_price | numeric? | Price of upgrade pack |
| is_suppressed | boolean | Default false, hides duplicate SKUs from list views |
| created_at, updated_at | timestamptz | |

### franchises
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | Unique |
| game_count | int | |
| logo | text | |

### alerts
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| game_id | uuid | FK -> games |
| type | text | Alert type enum |
| headline | text | Display text |
| subtext | text | Secondary display text |
| created_at | timestamptz | |

### user_alert_status (current schema)
| Column | Type | Notes |
|---|---|---|
| user_id | uuid | |
| alert_id | uuid | FK -> alerts |
| read | boolean | Default false |
| dismissed | boolean | Default false |

> **Target state (not yet migrated):** UserAlertState.status valid values: 'seen' | 'remind' | 'dismissed'. 'remind' maps to "Remind me in a few days" — no other snooze mechanic.

### user_profiles
| Column | Type | Notes |
|---|---|---|
| user_id | uuid | PK, FK -> auth.users |
| console_preference | text? | 'switch' or 'switch2' |
| created_at, updated_at | timestamptz | |

### user_game_follows
| Column | Type | Notes |
|---|---|---|
| user_id | uuid | |
| game_id | uuid | |
| notify_release | boolean | Default true |
| notify_price | boolean | Default true |

### user_franchise_follows
| Column | Type | Notes |
|---|---|---|
| user_id | uuid | |
| franchise_id | uuid | |

## Design System

| Token | Value | Usage |
|---|---|---|
| Background | `#0a0a0a` | Page bg |
| Card | `#111111` | Card/surface bg |
| Border | `#222222` | Dividers, card borders |
| Accent | `#00ff88` | Primary action, followed state, CTAs |
| Secondary text | `#999999` | Subtitles, metadata |
| Inactive | `#666666` | Disabled/unfollowed icons |
| Price drop | `#00ff88` (green) | price_drop, all_time_low |
| Sale | `#ffaa00` (amber) | sale_started |
| Release | `#00aaff` (blue) | out_now, release_today |
| Announced | `#aa66ff` (purple) | announced |

- Font: Inter
- Max width: 430px centered container
- Glow: `shadow-[0_0_12px_rgba(0,255,136,0.3)]` on accent elements
- Safe-area-inset padding for bottom nav

## UX Rules
- No "Buy Now" CTAs — this is a price tracker, not a storefront
- Two notification categories: release + price (not per-alert-type toggles)
- "Remind me in a few days" is the only snooze-like label
- Optimistic UI for follow/unfollow
- 430px max-width, safe-area-inset, thumb-friendly tap targets

## Self-Audit Rules
- No per-alert toggles exist anywhere in the codebase — follow = all alert types
- No "Buy Now" CTA in any email template, component, or alert UI
- No follow caps, no Pro tier, no upsell banners, no paywalls anywhere in the codebase
- The only snooze-like action is labeled "Remind me in a few days" — never "snooze", never "dismiss later"
- UserAlertState.status valid values: 'seen' | 'remind' | 'dismissed' only

## Monetization
- App is free, no subscription, no paywalls
- Revenue plan: display advertising once user base is established (5k+ users)
- No affiliate links, no Pro tier, no follow caps
- Do not add any monetization gates, upsells, or paywalls without explicit instruction

## eShop Polling Architecture

### Data Sources
- **Algolia catalog API** — full game catalog (title, metadata, platform, nsuid)
- **Nintendo Price API** (`api.ec.nintendo.com/v1/price`) — current prices, sale status
- **CDN package updates** — leading indicator for releases (see CDN Pre-Detection below)

### Polling Schedule

| Time (PT) | What | Why |
|---|---|---|
| 8:55 AM | Price + catalog sync | Catches indie/third-party morning releases (~9 AM PT unlock) and daily sale changes |
| 8:55 PM | Price + catalog sync | Catches Nintendo first-party midnight ET unlocks (9 PM PT) |
| 2:00 AM | Full catalog resync | Off-peak deep sync for metadata changes, new listings, delisted titles |

These two burst times catch ~90% of all eShop drops.

**Optional additional coverage:**
- 6:00-7:00 AM PT — Global simultaneous launches (e.g. Silksong-style)
- Post-Direct window — Shadow drops; trigger burst sync when a Nintendo Direct is detected

### CDN Pre-Detection (Critical)

The Nintendo CDN updates 10-20 minutes BEFORE a title becomes playable. Monitoring eShop API + CDN package updates + price change signals can detect a release before unlock. This is how Deku Deals and other trackers get early signals.

**For Blipd:** CDN delta detection should be the trigger for "Out Now" alerts, not waiting for the playable status flag itself. Build the snapshot diff to watch for CDN/price record appearance as a leading indicator.

## eShop Release Timing

### Day-of-Week Patterns

| Day | Type |
|---|---|
| Friday | Major Nintendo first-party releases |
| Thursday | Most indie / digital releases (historic eShop refresh day) |
| Random weekday | Rare shadow drops, usually post-Direct |

### Unlock Time Patterns

**Nintendo first-party: Midnight ET / 9 PM PT (night before listed date)**

| Game | Release Date | Unlock Time |
|---|---|---|
| Zelda: Tears of the Kingdom | May 12, 2023 | 12:00 AM ET / 9:00 PM PT (May 11) |
| Super Mario Bros. Wonder | Oct 20, 2023 | 12:00 AM ET / 9:00 PM PT (Oct 19) |
| Xenoblade Chronicles 3 | Jul 29, 2022 | 12:00 AM ET / 9:00 PM PT (Jul 28) |
| Metroid Dread | Oct 8, 2021 | 12:00 AM ET / 9:00 PM PT (Oct 7) |

**Indie / third-party: Morning PT**

| Game | Unlock Time |
|---|---|
| Hollow Knight: Silksong | 7:00 AM PT / 10:00 AM ET |
| Most indie releases | 9:00 AM PT / 12:00 PM ET |
| Ports / AA titles | ~9:00 AM PT |

Publisher sets the time per Nintendo docs, but 9 AM PT is the dominant pattern.

## Alert Types
- `price_drop` — price decreased
- `all_time_low` — new lowest-ever price
- `out_now` — game just released / became playable
- `sale_started` — sale began
- `release_today` — game releases today
- `announced` — new game announced
- `switch2_edition_announced` — Switch 2 edition first linked to a game

| Alert Type | Color | Hex |
|---|---|---|
| price_drop | Green | `#00ff88` |
| all_time_low | Green | `#00ff88` |
| sale_started | Amber | `#ffaa00` |
| out_now | Blue | `#00aaff` |
| release_today | Blue | `#00aaff` |
| announced | Purple | `#aa66ff` |
| switch2_edition_announced | Blue | `#00aaff` |

## Ingestion Pipeline

### Catalog Sync (`runFullCatalogSync`)
1. Fetch all pages from Algolia catalog API
2. Filter: English-language only (`isEnglishGame`)
3. Filter: Quality gate — known publisher allowlist OR MSRP >= $30, must have cover art
4. Transform: `algoliaHitToGameRow` maps Algolia hits to DB schema
5. Deduplicate slugs (append nsuid for collisions)
6. Batch upsert (100/batch) — nsuid conflict for games with NSUIDs, slug conflict otherwise
7. Rebuild franchises table from `games.franchise` column

### Price Update (`runPriceUpdate`)
1. Select 500 stalest games (ordered by `last_price_check ASC NULLS FIRST`)
2. Fetch prices from Nintendo Price API
3. Compare old vs new price, detect: price drop, all-time low, sale start
4. Append to `price_history` jsonb array
5. Generate alerts with 24h dedup per game_id + type
6. Bulk update `last_price_check`

### Release Status (`runReleaseStatusUpdate`)
- `upcoming` -> `out_today` on release date (generates `release_today` alert)
- `upcoming`/`out_today` -> `released` after release date

### Alert Dedup
24-hour window per game_id + alert type. Checked via `hasRecentAlert()`.

## Console Onboarding
- One-time screen after magic link auth (`/onboarding`)
- Two options: Nintendo Switch / Nintendo Switch 2
- Stored in `user_profiles.console_preference`
- If already set, redirects straight to `/home`
- Auth callback redirects to `/onboarding` (which checks and skips if set)
- Switch 2 users default to "Switch 2 Only" platform filter on Discover

## Duplicate Game Suppression
- Games grouped by normalized title (strip "– Nintendo Switch 2 Edition", "Upgrade Pack", regional prefixes)
- Base game is the canonical entry; Switch 2 / upgrade pack / regional variants get `is_suppressed = true`
- Base game gets `switch2_nsuid`, `upgrade_pack_nsuid`, `upgrade_pack_price` linked from variants
- All list views (Trending, Upcoming, Out Now, Sales) filter `is_suppressed = true`
- GameCard shows [Switch 2] badge when `switch2_nsuid` exists
- Game detail page shows Switch 2 edition badge + upgrade pack price

## Trending Algorithm (`computeTrendingScore`)
| Signal | Points |
|---|---|
| release_date within 14 days | +50 |
| release_date within 30 days | +30 |
| Currently on sale | +25 |
| All-time low price | +20 |
| Nintendo publisher | +20 |
| Major franchise (Zelda, Mario, Pokemon, etc.) | +15 |
| Metacritic >= 85 | +10 |
| Released in last 30 days | +10 |
| Follow count (normalized 0-10) | +10 max |
| User follows this franchise (personalization) | +20 |

## Discover Tab Structure
- Sub-tabs: [Trending] [Upcoming] [Out Now]
- Platform filter: [All Platforms] [Switch 2 Only]
- Trending: top 20 released games by trending_score descending
- Upcoming: games releasing in next 60 days, sorted by date ascending
- Out Now: games released in last 30 days, sorted by date descending

## Follow System
- Unlimited game follows for all users — no caps, no tiers
- Unlimited franchise follows
- Default notify prefs: `notify_release: true`, `notify_price: true`
- Optimistic UI: state updates immediately, DB write fires async
- Context provider: `FollowContext.tsx` with `useFollow()` hook

## Cron Schedule

### Catalog Sync (`sync-catalog`, maxDuration 300s)
| Schedule (UTC) | PT equivalent | Notes |
|---|---|---|
| `55 3,15 * * *` | 8:55 AM/PM PDT | Catalog + franchise rebuild at release windows |
| `0 9 * * *` | 2:00 AM PDT | Off-peak deep resync |

### Price Check (`update-prices`, maxDuration 60s)
| Schedule (UTC) | PT equivalent | Notes |
|---|---|---|
| `*/10 * * * *` | Every 10 min | Base polling, all day |
| `45,50,55 3 * * *` | 8:45-8:55 PM PDT | First-party window ramp-up (midnight ET) |
| `0,5,10 4 * * *` | 9:00-9:10 PM PDT | First-party window |
| `45,50,55 15 * * *` | 8:45-8:55 AM PDT | Third-party window ramp-up |
| `0,5,10 16 * * *` | 9:00-9:10 AM PDT | Third-party window |

Burst windows fire every 5 min (filling gaps between the 10-min base) to catch releases faster during the two primary eShop drop windows.

Auth: `Bearer $CRON_SECRET` header, verified in route handler.

## Key Files
- `src/lib/nintendo/client.ts` — Algolia + Price API fetchers
- `src/lib/nintendo/ingest.ts` — sync pipeline (catalog -> transform -> upsert)
- `src/lib/nintendo/transform.ts` — raw API data -> DB schema mapping
- `src/lib/nintendo/alerts.ts` — alert generation from price/status diffs
- `src/lib/nintendo/admin-client.ts` — Supabase admin client (service role)
- `src/lib/nintendo/types.ts` — Algolia API response types
- `src/lib/queries.ts` — Supabase query helpers
- `src/lib/supabase/types.ts` — DB schema types (generated)
- `src/lib/AuthContext.tsx` — Auth state provider
- `src/lib/FollowContext.tsx` — follow state provider (unlimited follows)
- `src/lib/ranking.ts` — game scoring (franchise, publisher, price signals)
- `src/components/` — shared UI components (BottomNav, GameCard, etc.)
