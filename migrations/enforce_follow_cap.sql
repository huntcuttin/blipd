-- Remove follow cap — all users get unlimited follows.
DROP TRIGGER IF EXISTS check_game_follow_cap ON user_game_follows;
DROP FUNCTION IF EXISTS enforce_game_follow_cap();
