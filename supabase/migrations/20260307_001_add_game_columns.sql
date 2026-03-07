-- Add missing columns to games table per CLAUDE.md target schema
-- MIGRATION NEEDED: Run in Supabase SQL Editor

-- Developer field
ALTER TABLE games ADD COLUMN IF NOT EXISTS developer text;

-- Catalog tier (top500 vs full)
ALTER TABLE games ADD COLUMN IF NOT EXISTS catalog_tier text DEFAULT 'full';

-- Platform
ALTER TABLE games ADD COLUMN IF NOT EXISTS platform text DEFAULT 'switch';

-- IGDB fields
ALTER TABLE games ADD COLUMN IF NOT EXISTS igdb_id integer;
ALTER TABLE games ADD COLUMN IF NOT EXISTS igdb_hype integer;

-- ITAD historical price data
ALTER TABLE games ADD COLUMN IF NOT EXISTS itad_historical_low numeric;
ALTER TABLE games ADD COLUMN IF NOT EXISTS itad_cache_updated_at timestamptz;

-- Sale end date (already used in UI but column was missing)
ALTER TABLE games ADD COLUMN IF NOT EXISTS sale_end_date text;
