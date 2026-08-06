# Build / Deps / Tests / Config Audit — 2026-08-05

Scope: package.json, tsconfig.json, next.config.mjs, tailwind.config.ts, postcss.config.mjs, .env.example, .gitignore, .vercelignore, public/, scripts/, fixes/, supabase/migrations/. Read-only. Known/deferred items (Next 14 freeze, sw.js offline fallback, price_snapshots, migration baseline, etc.) are excluded per instructions; where a known item was re-verified it is marked as such.

Finding count: **0 critical, 1 moderate, 6 minor, 3 informational.**

---

## Status checks (verbatim summaries)

### 1. `npx tsc --noEmit` — PASS

Zero errors, exit 0. Note the tsconfig `include: ["**/*.ts", ...]` also compiles the gitignored `scripts/` dir locally (scripts/audit.ts etc.) — it passed too.

### 2. `npm test` (`tsx --test "src/**/*.test.ts"`) — PASS, 51/51

```
ℹ tests 51
ℹ suites 0
ℹ pass 51
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 103.220375
```

The documented history of a "broken test invocation" (2026-08-02 overnight log: `vitest run` failing with missing config/alias) does **not** apply to the configured runner — `npm test` uses `tsx --test`, which resolves the `@/` alias fine and runs all 3 test files (`src/lib/nintendo/launch-window.test.ts`, `src/lib/notifications/batching.test.ts`, `src/lib/notifications/launch-digest-template.test.ts`). No vitest config is needed; the "broken" invocation was simply the wrong tool. No action required.

### 3. `npm audit --omit=dev` — 2 high (known-deferred, unchanged in count)

```
next  <=16.0.7   Severity: high   (21 advisories listed against 14.2.35)
postcss <=8.5.22 Severity: high   (bundled inside next)
2 high severity vulnerabilities
fix available via `npm audit fix --force`  → next@16.3.0 (breaking)
```

Both resolve only via the Next 16 major bump, which is deliberately frozen per the POC triage — matches the documented state ("2 high-severity issues that only resolve via a Next.js major bump"). Awareness note, not action: the advisory list against pinned 14.2.35 keeps growing and now includes several that are *not* purely self-hosted concerns (e.g. GHSA-vfv6-92ff-j949 RSC cache poisoning, GHSA-3g8h-86w9-wvmq middleware redirect cache poisoning, GHSA-955p-x3mx-jcvp unauthenticated disclosure of internal Server Function endpoints). The image-optimizer DoS advisories do **not** apply here — `next/image` is unused (see Finding 3). Nothing new against resend/svix/web-push/supabase deps (the old 16-vuln svix/ws chain is fully resolved).

### 4. `npx next lint` — PASS

`✔ No ESLint warnings or errors` — the 3 pre-existing warnings documented in the 2026-03-18 log are gone. `.eslintrc.json`'s `next/typescript` extend resolves correctly on eslint-config-next 14.2.35.

---

## Finding 1 (MODERATE): supabase/.temp is gitignored but still tracked — the audit-#32 fix was only half-applied

**Evidence:**
- `.gitignore` contains the entry (added since the 2026-08-02 audit):
  ```
  # Supabase CLI local cache (pooler host/ref, machine-specific)
  /supabase/.temp/
  ```
- But `git ls-files supabase/.temp` shows **8 files still tracked**: `cli-latest`, `gotrue-version`, `pooler-url`, `postgres-version`, `project-ref`, `rest-version`, `storage-migration`, `storage-version`.
- `git status` shows the live consequence: `M supabase/.temp/cli-latest` (the CLI bumped its cached version string v2.75.0 → v2.111.0 — pure machine churn).
- `supabase/.temp/pooler-url` still publishes `postgresql://postgres.cigsitwnhfnndtidrjjo@aws-1-us-east-1.pooler.supabase.com:5432/postgres` to github.com/huntcuttin/blipd.

**Why it matters:** `.gitignore` never untracks already-tracked files. The intent of the audit-#32 remediation (stop publishing machine-specific CLI cache + pooler host/ref) was not achieved — the files remain in the repo and on GitHub, and the perpetually-dirty `cli-latest` risks being swept into an unrelated commit (it sat modified in git status at the start of this session). Direct user impact is nil (the pooler host + project ref are not secrets and the ref is already in CLAUDE.md), hence moderate not critical — this is graded up from minor because it is an incomplete fix producing ongoing dirty-worktree state.

**Fix:** `git rm -r --cached supabase/.temp && git commit` — the existing `.gitignore` entry then takes effect.

---

## Finding 2 (MINOR): postcss.config.mjs omits autoprefixer, and autoprefixer is not installed at all

**Evidence:**
- `postcss.config.mjs` plugins: `{ tailwindcss: {} }` only.
- `npm ls autoprefixer` → `(empty)` — not a dependency anywhere.
- A custom PostCSS config **replaces** Next.js's default chain (which includes autoprefixer + flexbugs fixes), so the app ships with zero build-time vendor prefixing. Standard Tailwind setup (`tailwindcss init -p`) includes both.

**Verified impact — low:** inspected the freshly built CSS (`.next/static/css/bacc244755d85c94.css`, built today): the prefixes that matter are already present because Tailwind 3.4 hardcodes them into its own utilities/preflight (`-webkit-backdrop-filter`, `-webkit-line-clamp`, `-webkit-appearance`, `-webkit-tap-highlight-color`, etc. all found in the output). `backdrop-blur` (used in `BackButton.tsx`, `BottomNav.tsx`) is covered. So this is a deviation-from-recommended-setup with no currently-observable breakage — but any future *hand-written* CSS in `globals.css` needing prefixes would silently ship unprefixed.

**Fix (optional, 2 min):** `npm i -D autoprefixer` and add `autoprefixer: {}` to postcss.config.mjs. Or consciously leave as-is and note it.

---

## Finding 3 (MINOR): next.config.mjs `images.remotePatterns` is dead config — `next/image` is used nowhere

**Evidence:**
- `next.config.mjs` declares remotePatterns for `assets.nintendo.com`, `*.nintendo.com`, `images.igdb.com`.
- `grep -rn "from ['\"]next/image" src` → zero matches. No `<Image` component anywhere in src (the only "next/image" string in the codebase is the middleware matcher comment). All cover art renders via plain `<img>` / `GameCoverImage`.

**Why it matters:** harmless at runtime, but misleading — it implies image optimization is in play (it isn't), and it is the config that would make the Next image-optimizer DoS advisories relevant if `next/image` were ever adopted (the `*.nintendo.com` wildcard is the exact pattern GHSA-9g9p-9gw9-jx7f concerns for self-hosters; moot on Vercel, and moot while unused).

**Fix:** either delete the `images` block (documenting that the app deliberately uses `<img>`), or leave with a comment. No behavior change either way today.

---

## Finding 4 (MINOR): public/images/ ships 2.0MB of unreferenced March-era assets in every deploy

**Evidence:**
- `public/images/covers/` (28 entries) + `public/images/franchises/` (6 entries), 2.0MB total, last touched 2026-03-04.
- `grep -rn "images/covers\|images/franchises" src` → zero references. Cover art comes from `games.cover_art` URLs (Nintendo/IGDB CDNs), franchise logos from `franchises.logo`.

**Fix:** delete `public/images/` (or move out of public/). Pure dead weight in the deploy bundle and repo.

---

## Finding 5 (MINOR): playwright and dotenv devDependencies' only consumers are gitignored — unused on a fresh clone

**Evidence (per-dep import check, scope item 4):**
- **svix** — genuinely used: `src/app/api/webhooks/resend/route.ts:2` (`import { Webhook } from "svix"`). Keep.
- **web-push** — genuinely used: `src/lib/notifications/push.ts:1`. Keep (push layer exists even if 0 subscribers).
- **playwright** (devDep) — only import in the repo: `scripts/audit.ts:1`. `scripts/` is gitignored (`.gitignore:39:/scripts/`), so on a fresh clone playwright is a pure ~50MB+ unused install.
- **dotenv** (devDep) — only imports live in `scripts/` (seed.ts, initial-sync.ts, seed-catalog.ts, test-pipeline.ts, 2 .mjs files) — same gitignored dir. Zero imports in src/ or fixes/.

**Fix:** uninstall both, or (better, see Finding 6-adjacent note) un-ignore the 2-3 scripts that package.json actually depends on. Low priority; POC.

**Related known-open item (re-verified, not re-counted):** `npm run seed` / `npm run sync` still point at `scripts/seed.ts` / `scripts/initial-sync.ts` inside the gitignored `scripts/` dir — broken on fresh clone, exactly as audit #32 documented. Unchanged.

---

## Finding 6 (MINOR): 3 of 5 tracked fixes/ scripts hardcode this machine's absolute .env.local path

**Evidence:**
- `fixes/backfill_product_type.py:30`, `fixes/fix_fabricated_release_dates.py:31`, `fixes/sync_nintendo_first_party_slate.py:28` all hardcode `ENV_PATH = "/Users/huntcuttin/Documents/GitHub/blipd/.env.local"`; `fixes/dedup_duplicate_alerts.py:5-6` shells out with the same absolute path.
- `fixes/verify_catalog_surfaces.sh` does it right (`cd "$(dirname "$0")/.."` then relative `.env.local`).

**Why it matters:** the whole point of `fixes/` (per Zero-Touch Operations) is saved, re-runnable levers — these break on any other checkout path/machine. Trivial fix: copy the shell script's relative-path pattern.

**Credential scan of tracked fixes/ and supabase/ — CLEAN.** No Supabase keys, JWTs, Resend keys, or tokens hardcoded in any tracked file. The one hardcoded key, `ALGOLIA_API_KEY = "a29c6927638bfd8cee23993e51e721c9"` (`fixes/backfill_product_type.py:36`), is Nintendo's own public client-side Algolia search-only key (shipped in nintendo.com's frontend) — not a Blippd credential, not sensitive.

---

## Finding 7 (INFORMATIONAL): revoked legacy service_role JWT still sits in 8 untracked local scripts/*.py

**Evidence:** `scripts/assign_franchises.py:10`, `price_sync.py:16`, `fix_data_quality.py:16`, `backfill_cover_art.py:24`, `price_sync_manual.py:13`, `suppress_dlc.py:14`, `db_maintenance_batch2.py:14`, `db_maintenance_batch5.py:16` all still contain the full legacy `eyJ...service_role...` JWT.

**Why only informational:** this is the exact key from audit #1 — rotated 2026-08-02, and Supabase disabled all legacy JWT keys project-wide on 2026-08-03, so the string is dead. The files are untracked (`scripts/` gitignored). Residual local hygiene only: worth scrubbing next time someone touches `scripts/` so a dead credential doesn't get copy-pasted into something new or accidentally re-tracked.

---

## Finding 8 (INFORMATIONAL): manifest.json `start_url: "/home"` points a signed-out PWA install at an auth-gated page

**Evidence:** `public/manifest.json:5`. A user who installs the PWA before signing in opens to the empty/redirecting personal dashboard rather than the landing page. PWA install flow is explicitly post-retention-gate (Bible Addendum 2), so this is a note for whenever that work unfreezes, not action now. Rest of manifest + sw.js sanity: fine — `skipWaiting`/`clients.claim` present, PNG notification icons, icons array valid, single manifest (no dual-manifest issue; `src/app/manifest.ts` confirmed gone, `layout.tsx:30` references `/manifest.json`).

---

## Finding 9 (INFORMATIONAL): migration + env-var checks came back clean

- **supabase/migrations/ (scope item 7):** newest file is `20260804_001_add_alerts_dispatched_at.sql` — documented in CLAUDE.md as applied live and verified (audit #11 durable dispatch, commit `568996b`). **No migration dated after 20260804 exists.** The 2026-08-03 files (005/006 allowlist extensions, 007 product_type) all correspond to documented applied-live work. The stale duplicate root-level `migrations/` dir (5 March-era files) is the known two-competing-dirs item — unchanged, deferred.
- **.env.example vs src (scope item 5):** all **15** `process.env.*` reads across src/ (`ADMIN_EMAIL, ANTHROPIC_API_KEY, CRON_JOB_ORG_API_KEY, CRON_SECRET, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_VAPID_PUBLIC_KEY, RESEND_API_KEY, RESEND_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, VAPID_EMAIL, VAPID_PRIVATE_KEY`) are present in `.env.example`. `TEST_EMAIL` is example-documented and used only by the local `scripts/test-pipeline.ts`. No missing var, no phantom var.
- **.vercelignore:** contains only `mobile/` — correct and sufficient (everything else undesirable is untracked, and git-based Vercel deploys only see tracked files).
- **tailwind.config.ts / tsconfig.json:** sane; `mobile/` correctly excluded from tsconfig; `@/*` alias correct. tailwind `content` globs cover src/ fully.
