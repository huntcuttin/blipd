-- Durable dispatch (audit Phase 1 #11, finally unblocked 2026-08-04 once a
-- working Supabase Management API token was available). Replaces the
-- dispatch cron's time-window lookback (which silently drops an alert
-- forever if dispatch-notifications is down/erroring for longer than the
-- window -- no retry, no visibility) with a true undelivered-work query.
-- dispatched_at is set once an alert's full follower resolution + send
-- attempt has actually run; the dispatch query becomes "alerts with
-- dispatched_at IS NULL" instead of a time window, so any gap -- a missed
-- cron tick, a deploy outage, a Resend rate-limit stop -- self-heals on
-- the next run regardless of how long the gap was.
--
-- Existing rows are backfilled to their own created_at so this doesn't
-- retroactively resurface months of historic alerts to whoever follows
-- those games today.
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS dispatched_at timestamptz;

UPDATE alerts SET dispatched_at = created_at WHERE dispatched_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_alerts_undispatched
  ON alerts (created_at) WHERE dispatched_at IS NULL;
