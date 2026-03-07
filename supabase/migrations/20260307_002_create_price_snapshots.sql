-- Create PriceSnapshot table for price history tracking
-- MIGRATION NEEDED: Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS price_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  price numeric NOT NULL,
  msrp numeric NOT NULL,
  discount_pct integer NOT NULL DEFAULT 0,
  is_on_sale boolean NOT NULL DEFAULT false,
  captured_at timestamptz NOT NULL DEFAULT now(),
  sale_id uuid REFERENCES named_sale_events(id)
);

-- Index for querying price history by game
CREATE INDEX IF NOT EXISTS idx_price_snapshots_game_id ON price_snapshots(game_id, captured_at DESC);

-- Index for finding latest snapshot per game
CREATE INDEX IF NOT EXISTS idx_price_snapshots_latest ON price_snapshots(game_id, captured_at DESC);

-- RLS: allow read access to all, write only via service role
ALTER TABLE price_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Price snapshots are viewable by everyone" ON price_snapshots
  FOR SELECT USING (true);
