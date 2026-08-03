-- user_game_follows and user_franchise_follows both had SELECT/INSERT/DELETE
-- policies but no UPDATE policy. RLS enabled + no matching policy for a given
-- command means PostgREST's WHERE clause matches zero rows for that
-- command -- not an error, just a silent no-op update -- so
-- updateGameFollowPrefs(), setTargetPrice(), and updateFranchiseFollowPrefs()
-- have been silently failing to persist anything for any authenticated
-- (non-service-role) user since these tables' RLS was set up. Confirmed live:
-- 0 of 19 user_game_follows rows have any non-default notify_* value or a
-- non-null target_price, despite both features being documented as shipped
-- since 2026-03-17.
CREATE POLICY "Users can update own game follows" ON user_game_follows
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own franchise follows" ON user_franchise_follows
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
