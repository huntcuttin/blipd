-- Migration: Add structured price fields to alerts table
-- Run this in Supabase SQL Editor before deploying the code changes

-- Add structured price/sale columns to alerts
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS new_price numeric;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS old_price numeric;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS discount integer;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS sale_end_date text;

-- Add missing popularity_score to franchises
ALTER TABLE franchises ADD COLUMN IF NOT EXISTS popularity_score integer NOT NULL DEFAULT 0;
