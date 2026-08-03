-- Overlapping cron runs (the Price Burst windows deliberately overlap the
-- base 10-min schedule during known drop windows) can both pass the app-level
-- 24h hasRecentAlert check before either has inserted, creating duplicate
-- alert rows for the same game+type. This unique index is a backstop, not
-- the primary dedup mechanism — insertAndDispatch() already treats an insert
-- failure as "don't count as sent" gracefully, so no application code needs
-- to change once this exists.
CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_dedup_game_type_day
  ON alerts (game_id, type, (created_at::date));
