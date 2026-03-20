-- Add genres array column to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS genres text[] DEFAULT '{}';

-- Index for genre filtering (GIN index for array containment queries)
CREATE INDEX IF NOT EXISTS idx_games_genres ON games USING GIN (genres);
