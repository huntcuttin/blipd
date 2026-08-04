# fixes/

Saved one-off scripts for predictable, recurring exceptions that don't
warrant ongoing automation — the zero-touch answer to "something
predictable broke, fix it once, move on." See CLAUDE.md's Zero-Touch
Operations section.

- `dedup_duplicate_alerts.py` — one-off cleanup for pre-existing duplicate
  alert rows (found 2026-08-02 when a unique index creation failed with a
  real data conflict — 292 genuine duplicate (game_id, type, day) alert
  rows existed from before this session's dedup fixes). Deletes dependent
  user_alert_status/notification_log rows first, then the duplicate alert
  rows, keeping the earliest row per group. Re-run only if the same
  conflict recurs (it shouldn't, now that #15's dedup fixes are shipped).
  **Note (2026-08-02 overnight):** the cleanup itself clearly ran (0 dupe
  rows found live), but `idx_alerts_dedup_game_type_day` — the actual
  point of doing the cleanup — was never applied afterward (same
  migration-exists-but-never-ran pattern as `onboarding_completed`
  earlier this session). Applied live via the Management API; confirmed
  present in `pg_indexes`. If a future session finds this index missing
  again, check whether the migration just needs re-running before
  re-running this script — a missing index isn't the same problem as a
  data conflict.

- `backfill_product_type.py` — one-time classification of `games.product_type`
  (added 20260803_007) via Nintendo's own Algolia data. Ongoing catalog sync
  can never label most junk itself: `isStandaloneGame()` drops ADD_ON_CONTENT
  hits *before* the row is ever created, so the DB rows that *are* that
  content predate the filter and are structurally invisible to it. Run
  2026-08-03: 2,869 NULL rows classified — 1,153 ADD_ON_CONTENT, 374 BUNDLE,
  1,251 TITLE, 157 UNKNOWN (unresolvable — mostly nsuid-null placeholder
  listings). Only ever touches rows where `product_type IS NULL`, so it's
  safe to re-run periodically as a catch-up sweep for anything that slips
  through ingest uncounted (e.g. Algolia transient errors during a prior
  run — those get written as UNKNOWN, not left NULL, so re-running won't
  double-count them; if you want to re-attempt UNKNOWN rows specifically,
  reset them to NULL first). First run hit a `ConnectionResetError` that
  crashed the whole batch ~2000 rows in (a script bug, not a data issue) —
  fixed by broadening the retry's exception handling; if this script ever
  crashes again with a raw traceback rather than printing its own summary,
  that's the bug to look for again, not evidence of a new problem.

- `verify_catalog_surfaces.sh` — per the audit's change-discipline rule
  (`docs/AUDIT-2026-08-03.md` §F): run this after any edit touching a shared
  catalog signal (`is_suppressed`, `product_type`, `release_date`
  semantics/placeholders) and eyeball the top-20 output for each of the
  three real user-facing surfaces (Out Now, Coming Soon, Deals) before
  committing. Replicates each surface's actual filter/order clauses
  against the live REST API — not a literal re-run of the TypeScript
  queries, but faithful to their WHERE/ORDER conditions. Read-only, safe to
  run anytime, no side effects.
