-- Migration: Add Nintendo eShop integration columns to games table
-- Run this in your Supabase SQL Editor

ALTER TABLE games ADD COLUMN IF NOT EXISTS nsuid text UNIQUE;
ALTER TABLE games ADD COLUMN IF NOT EXISTS nintendo_url text;
ALTER TABLE games ADD COLUMN IF NOT EXISTS last_price_check timestamptz;
ALTER TABLE games ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_games_nsuid ON games (nsuid) WHERE nsuid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_games_last_price_check ON games (last_price_check ASC NULLS FIRST);
