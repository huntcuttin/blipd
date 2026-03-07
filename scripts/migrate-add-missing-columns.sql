-- ══════════════════════════════════════════════════════════════
-- Migration: Add missing columns referenced by code
-- Run this in Supabase SQL Editor if columns don't exist yet
-- Safe to run multiple times (uses IF NOT EXISTS / exception handling)
-- ══════════════════════════════════════════════════════════════

-- Games table: Switch 2 edition links, suppression, release date source
DO $$ BEGIN
  ALTER TABLE games ADD COLUMN switch2_nsuid text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE games ADD COLUMN upgrade_pack_nsuid text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE games ADD COLUMN upgrade_pack_price numeric(10,2);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE games ADD COLUMN is_suppressed boolean not null default false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE games ADD COLUMN release_date_source text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- User alert status: remind_at for "Remind me in a few days"
DO $$ BEGIN
  ALTER TABLE user_alert_status ADD COLUMN remind_at timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
