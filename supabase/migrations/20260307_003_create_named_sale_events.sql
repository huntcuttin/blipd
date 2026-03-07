-- Create NamedSaleEvent table for tracking Nintendo sales
-- MIGRATION NEEDED: Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS named_sale_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  games_count integer NOT NULL DEFAULT 0
);

-- Index for finding active sales
CREATE INDEX IF NOT EXISTS idx_named_sale_events_active ON named_sale_events(active, detected_at DESC);

-- RLS: allow read access to all
ALTER TABLE named_sale_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Named sale events are viewable by everyone" ON named_sale_events
  FOR SELECT USING (true);
