-- Overlapping cron runs (the Price Burst windows deliberately overlap the
-- base 10-min schedule during known drop windows) can both pass the app-level
-- 24h hasRecentAlert check before either has inserted, creating duplicate
-- alert rows for the same game+type. This unique index is a backstop, not
-- the primary dedup mechanism — insertAndDispatch() already treats an insert
-- failure as "don't count as sent" gracefully, so no application code needs
-- to change once this exists.
--
-- created_at::date can't be used directly in an index expression — Postgres
-- classifies timestamptz -> date casts as timezone-dependent ("STABLE", not
-- "IMMUTABLE"), so CREATE INDEX rejects it with 42P17. Wrapping the epoch
-- extraction (timezone-independent by construction — timestamptz is stored
-- as an absolute UTC instant) in an explicitly-IMMUTABLE function sidesteps
-- this. The bucket boundary lands on UTC-day lines rather than any specific
-- local timezone, which is fine for a defense-in-depth backstop.
CREATE OR REPLACE FUNCTION day_bucket_utc(ts timestamptz) RETURNS bigint AS $$
  SELECT floor(extract(epoch FROM ts) / 86400)::bigint;
$$ LANGUAGE sql IMMUTABLE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_dedup_game_type_day
  ON alerts (game_id, type, day_bucket_utc(created_at));
