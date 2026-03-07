-- Add notification preference columns to user_game_follows
ALTER TABLE user_game_follows
  ADD COLUMN IF NOT EXISTS notify_release boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_price boolean NOT NULL DEFAULT true;
