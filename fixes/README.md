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
