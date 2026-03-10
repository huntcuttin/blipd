-- Games I Own collection table
-- MIGRATION NEEDED: Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_game_owns (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_user_game_owns_user ON user_game_owns(user_id);

-- RLS
ALTER TABLE user_game_owns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own collection"
  ON user_game_owns
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
