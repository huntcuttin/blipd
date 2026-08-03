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
