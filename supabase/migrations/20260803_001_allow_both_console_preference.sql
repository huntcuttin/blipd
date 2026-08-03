-- Console preference gained a third value ("both") so users who own a
-- Switch and a Switch 2 aren't forced to pick one, but the existing CHECK
-- constraint only allowed 'switch'/'switch2' and silently 400'd any save
-- attempting to set 'both'.
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_console_preference_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_console_preference_check
  CHECK (console_preference = ANY (ARRAY['switch'::text, 'switch2'::text, 'both'::text]));
