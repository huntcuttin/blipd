# Blippd

A launch and price alert app for Nintendo eShop games. Follow the games you
care about — when one launches, goes on sale, or hits an all-time low, you
find out immediately. That's the whole product: not a store, not a
discovery feed, just the alert.

Live at [blippd.app](https://www.blippd.app).

## Stack

- Next.js 14 (App Router) on Vercel
- Supabase (Postgres + magic-link auth)
- Resend for transactional email
- cron-job.org for scheduled polling/dispatch (see `CLAUDE.md` for the full list)
- Data: Nintendo eShop Algolia catalog, IGDB (release dates, hype, ratings)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Copy `.env.example` to
`.env.local` and fill in real values — most features (auth, price data, push,
IGDB sync) no-op or fail without their corresponding env vars.

## Project context

`CLAUDE.md` at the repo root is the living project document — product
philosophy, database schema, cron architecture, roadmap, and session history.
Read it before making non-trivial changes.

`fixes/` holds saved one-off scripts for predictable, recurring exceptions
(delisted games, duplicate data cleanup, etc.) rather than one-time fixes
living only in a chat transcript.

## Deployment

Deploys to Vercel on push to `main`. Cron jobs run via cron-job.org (not
Vercel Cron) hitting `/api/cron/*` routes, authenticated with a bearer token
(`CRON_SECRET`).
