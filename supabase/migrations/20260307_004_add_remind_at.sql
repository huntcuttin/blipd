-- Add remind_at column to user_alert_status for "Remind me in a few days"
-- MIGRATION NEEDED: Run in Supabase SQL Editor

ALTER TABLE user_alert_status ADD COLUMN IF NOT EXISTS remind_at timestamptz;
