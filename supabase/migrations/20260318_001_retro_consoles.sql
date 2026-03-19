-- Retro console follow subscriptions
CREATE TABLE IF NOT EXISTS user_retro_follows (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  console text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, console)
);

-- Add retro_platform column to games
ALTER TABLE games ADD COLUMN IF NOT EXISTS retro_platform text;

-- RLS policies
ALTER TABLE user_retro_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own retro follows"
  ON user_retro_follows FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own retro follows"
  ON user_retro_follows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own retro follows"
  ON user_retro_follows FOR DELETE
  USING (auth.uid() = user_id);

-- Service role needs full access for notifications
CREATE POLICY "Service role full access retro follows"
  ON user_retro_follows FOR ALL
  USING (auth.role() = 'service_role');
