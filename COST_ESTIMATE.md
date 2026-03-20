# Blippd Codebase Cost Estimate

**Project**: Blippd — Nintendo eShop Price Alert App
**Scan date**: 2026-03-20
**Total files**: 100+ source | **Total LOC**: 13,186 (src/) + 3,194 (mobile/) | **Languages**: TypeScript, TSX, CSS, SQL

---

## Tech Stack Detected

| Layer | Technology | Complexity Signal |
|-------|-----------|------------------|
| Frontend | Next.js 14 App Router, React 18, Tailwind CSS 3.4 | SSR + ISR + client components, 18 routes, PWA |
| Backend | Next.js API routes (12 endpoints) | 9 cron jobs, admin API, push subscription |
| Database | Supabase (Postgres), 13 migrations | 13+ tables, jsonb price history, UNIQUE dedup keys |
| Auth | Supabase magic link + Google + Apple OAuth | 3 providers, session persistence, onboarding flow |
| Email | Resend (alerts@blippd.app) | 6 HTML templates, batching, weekly digest |
| Push | Web Push (VAPID) | Service worker, subscription management |
| AI | Claude API (@anthropic-ai/sdk) | Trailer-to-game matching, 0.85 confidence threshold |
| Hosting | Vercel (free tier) | Zero-config deploy |
| Cron | cron-job.org (9 jobs) | Bearer auth, 5min-weekly frequencies |
| Mobile | Expo / React Native (in progress) | Mirrors web architecture, 3,194 LOC |

## Integrations & APIs

| Integration | Type | Complexity | Est. Hours |
|------------|------|-----------|-----------|
| Nintendo eShop (Algolia + Price API) | External API | Expert | 48 |
| IGDB (Twitch OAuth + GraphQL) | External API | Complex | 32 |
| YouTube RSS (Direct + Trailer detection) | External API | Complex | 28 |
| Claude API (trailer matching) | AI/ML | Complex | 24 |
| Resend (transactional email) | External API | Standard | 20 |
| Web Push (VAPID notifications) | External API | Standard | 16 |
| Supabase Auth (magic link + OAuth) | Auth | Standard | 24 |
| **Integration subtotal** | | | **192** |

## Component Breakdown

| Component | Files | LOC | Complexity | Est. Hours |
|-----------|-------|-----|-----------|-----------|
| Landing + marketing pages (/, /deals, /vs/nt-deals, /privacy, /terms) | 5 | 505 | Simple | 24 |
| Auth system (magic link + Google + Apple + callback + onboarding) | 4 | 748 | Standard | 32 |
| Database schema + migrations | 13 | 208 | Standard | 28 |
| Home page (Discover/My Games tabs, search, swipe, infinite scroll) | 1 | 450 | Complex | 40 |
| Game detail page (price, chart, follow, own, share, notify prefs) | 2 | 518 | Complex | 44 |
| Sales page (filters, sort, named event banners, ATL section) | 2 | 298 | Standard | 24 |
| Feed page (trailers, directs, releases, demos, sorting) | 2 | 442 | Standard | 24 |
| Alerts page (time grouping, filters, mark read, remind) | 1 | 255 | Standard | 20 |
| Profile + Settings pages | 2 | 573 | Standard | 28 |
| Release-time SEO pages (countdown, timezone converter, launch rules) | 2 | 308 | Complex | 32 |
| Admin trailers page (approval queue) | 2 | 320 | Standard | 16 |
| Franchise detail page | 2 | 235 | Simple | 12 |
| GameCard component (4 variants + skeleton) | 1 | 303 | Complex | 28 |
| Shared components (19 files: FollowButton, SearchBar, BottomNav, etc.) | 18 | 1,242 | Standard | 48 |
| Notification pipeline (dispatch, batch, templates, email, push) | 11 | 1,116 | Expert | 64 |
| Price polling + alert generation (ingest.ts) | 1 | 891 | Expert | 56 |
| Named sale event detection + two-tier notification | 3 | 350 | Expert | 40 |
| Nintendo catalog sync (Algolia → transform → quality filter → dedup) | 5 | 1,396 | Expert | 48 |
| IGDB integration (hype, ratings, release dates, circuit breaker) | 1 | 413 | Complex | 32 |
| Nintendo Direct detection (YouTube RSS → banner) | 3 | 283 | Standard | 20 |
| Trailer detection (YouTube RSS → Claude AI → admin queue) | 3 | 551 | Expert | 40 |
| Ranking + deduplication system | 1 | 258 | Complex | 24 |
| Cron endpoints (9 jobs) | 9 | 988 | Complex | 36 |
| AuthContext + FollowContext (state management) | 2 | 410 | Complex | 28 |
| PWA (service worker, manifest, icons, pull-to-refresh) | 4 | 250 | Standard | 16 |
| SEO (sitemap, robots, OG metadata, schema.org JSON-LD) | 4 | 180 | Standard | 12 |
| Retry/timeout/reliability infrastructure | 1 | 88 | Standard | 8 |
| Format + type utilities | 2 | 174 | Simple | 6 |
| Middleware (auth session refresh) | 1 | 32 | Simple | 4 |
| **Subtotal (engineering)** | | | | **892** |
| Testing (+20% — currently zero automated tests) | | | | 178 |
| Documentation (+10%) | | | | 89 |
| **Total base hours** | | | | **1,159** |

---

## Cost by Team Profile

| Metric | Solo | Lean Startup | Growth Co | Enterprise |
|--------|------|-------------|-----------|-----------|
| Base hours | 1,159 | 1,159 | 1,159 | 1,159 |
| Overhead | 0% | +45% | +120% | +165% |
| **Total hours** | **1,159** | **1,681** | **2,550** | **3,071** |
| Blended rate | $125/hr | $110/hr | $125/hr | $125/hr |
| **Total cost** | **$144,875** | **$184,910** | **$318,750** | **$383,875** |
| Calendar time | ~7.2 months | ~4.7 months | ~4.0 months | ~3.2 months |

*(Calendar time assumes 160 productive hours/month solo, scaling with team parallelism)*

---

## The Headline

*A solo senior developer would need ~7 months and ~$145K to build Blippd from scratch. A growth-stage team would spend ~$319K over 4 months. The app's real cost driver is integration density — 6 external APIs, 9 cron jobs, and a two-tier notification pipeline account for over half the engineering hours.*

---

## Assumptions

1. Rates based on US market averages (2025-2026), senior full-stack developer (5+ years)
2. Estimates include the mobile app (Expo, 3,194 LOC) at roughly 120 additional hours
3. **No automated test suite exists** — the 20% testing add-on represents what production-quality testing would cost (unit + integration + E2E). Currently relies on manual audit scripts.
4. Does not include: marketing, legal, app store fees, hosting/infrastructure costs, or ongoing maintenance
5. Nintendo eShop integration rated Expert complexity due to: undocumented Algolia API, price polling orchestration, quality filtering (50+ publisher whitelist), sale event detection with dedup, and franchise linking
6. The notification pipeline alone (dispatch + batching + templates + email + push) is 1,116 LOC — more code than many entire MVPs
7. Calendar time estimates assume dedicated, uninterrupted work. Real-world projects typically take 1.5-2x longer due to requirement changes, debugging, and deployment issues
