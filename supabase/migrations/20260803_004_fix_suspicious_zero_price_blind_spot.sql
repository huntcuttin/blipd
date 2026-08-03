-- The original find_suspicious_zero_priced_games() (20260803_003) required a
-- price_history entry >5 as evidence a $0 game was "once real" -- but
-- price_history only retains the current month's bucket, which itself
-- already gets overwritten with the corrupted 0, destroying the evidence.
-- Confirmed live 2026-08-03: this blind spot hid 89 of 92 real corrupted
-- rows (rpc_visible=3, rpc_blind=89) -- including 8 of the founder's own 18
-- followed games (Metroid Dread, Super Mario Maker 2, Captain Toad, Donkey
-- Kong Country Returns HD, Fire Emblem Warriors: Three Hopes, Mario vs.
-- Donkey Kong, Pikmin 2, Pokemon Mystery Dungeon: Rescue Team DX -- all
-- confirmed via direct Nintendo price API to have real positive prices).
-- All 92 were manually re-priced from live ground truth in the same
-- session; this migration fixes the monitoring gap so it doesn't recur
-- silently again.
--
-- Replaces the price_history heuristic with an explicit allowlist of
-- nsuids confirmed genuinely $0 via the live Nintendo price API on
-- 2026-08-03 (F2P titles, plus two rows wrongly marked release_status=
-- 'released' that are actually still unreleased per Nintendo -- tracked
-- separately, not a price bug). Anything else at $0/$0 is now correctly
-- visible to health-check regardless of what price_history contains.
CREATE OR REPLACE FUNCTION find_suspicious_zero_priced_games()
RETURNS TABLE (title text, nsuid text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.title, g.nsuid
  FROM games g
  WHERE g.current_price = 0
    AND g.original_price = 0
    AND g.nsuid IS NOT NULL
    AND g.release_status = 'released'
    AND g.nsuid NOT IN (
      '70010000000457', -- Rocket League (F2P)
      '70010000002743', -- Ninjala (F2P)
      '70010000008535', -- Fantasy Strike (F2P)
      '70010000009425', -- Warframe (F2P)
      '70010000043292', -- Pokemon UNITE (F2P)
      '70010000064806', -- Palia (F2P)
      '70010000096855', -- Fortnite (F2P)
      '70050000069469', -- Subnautica (F2P)
      '70010000100816', -- Mina the Hollower (actually unreleased per Nintendo, release_status wrong)
      '70010000112751', -- Bluey's Happy Snaps (actually unreleased per Nintendo, release_status wrong)
      '70050000069063'  -- Hollow Knight nsuid -- catalog shows this is a Switch 2 upgrade pack listing, price ambiguous, leave alone
    )
  ORDER BY g.last_price_check DESC;
$$;
