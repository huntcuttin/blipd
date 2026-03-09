-- Nintendo Direct detection table
-- MIGRATION NEEDED: Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS nintendo_directs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id text UNIQUE NOT NULL,
  title text NOT NULL,
  published_at timestamptz NOT NULL,
  detected_at timestamptz DEFAULT now(),
  active boolean DEFAULT true,
  expires_at timestamptz NOT NULL
);

-- Index for active directs lookup
CREATE INDEX IF NOT EXISTS idx_nintendo_directs_active ON nintendo_directs (active) WHERE active = true;
