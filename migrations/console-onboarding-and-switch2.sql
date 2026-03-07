-- 1. User profiles table for console preference
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  console_preference text CHECK (console_preference IN ('switch', 'switch2')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_profile" ON user_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_profile" ON user_profiles FOR UPDATE USING (auth.uid() = user_id);

-- 2. New columns on games for Switch 2 edition linking and suppression
ALTER TABLE games ADD COLUMN IF NOT EXISTS switch2_nsuid text;
ALTER TABLE games ADD COLUMN IF NOT EXISTS upgrade_pack_nsuid text;
ALTER TABLE games ADD COLUMN IF NOT EXISTS upgrade_pack_price numeric;
ALTER TABLE games ADD COLUMN IF NOT EXISTS is_suppressed boolean DEFAULT false;

-- 3. Index for filtering suppressed games in list views
CREATE INDEX IF NOT EXISTS idx_games_not_suppressed ON games (is_suppressed) WHERE is_suppressed = false;
