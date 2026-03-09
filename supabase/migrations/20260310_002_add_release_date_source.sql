-- Add release_date_source column to games table
-- MIGRATION NEEDED: Run in Supabase SQL Editor

ALTER TABLE games ADD COLUMN IF NOT EXISTS release_date_source text;
ALTER TABLE games ADD COLUMN IF NOT EXISTS release_status text;
