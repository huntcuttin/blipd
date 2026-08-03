-- Extends the allowlist from 20260803_004 with 8 more nsuids confirmed
-- genuinely free via the live Nintendo price API on 2026-08-03: F2P titles
-- (MY HERO ULTRA RUMBLE, F-ZERO 99, Brawlhalla) and free base-hub apps whose
-- individual games are sold separately (Capcom Arcade Stadium, Capcom
-- Arcade 2nd Stadium), plus free tech demos/companion apps (Jump Rope
-- Challenge, Hello Mario!, Mario Kart Live: Home Circuit). This is expected,
-- healthy behavior for the allowlist design -- new legitimately-free
-- listings will keep surfacing over time and each needs a one-time addition
-- here, which is the intended tradeoff for not silently masking real
-- corruption with an overly broad heuristic.
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
      '70050000069063', -- Hollow Knight nsuid -- Switch 2 upgrade pack listing, price ambiguous
      '70010000064912', -- MY HERO ULTRA RUMBLE (F2P)
      '70010000034733', -- Capcom Arcade Stadium (free base hub, games sold individually)
      '70010000072186', -- F-ZERO 99 (free NSO-exclusive)
      '70010000012098', -- Brawlhalla (F2P)
      '70010000032653', -- Jump Rope Challenge (free Nintendo tech demo)
      '70010000117571', -- Hello, Mario! (free app)
      '70010000012352', -- Mario Kart Live: Home Circuit (free digital listing tied to physical hardware)
      '70010000046673'  -- Capcom Arcade 2nd Stadium (free base hub, games sold individually)
    )
  ORDER BY g.last_price_check DESC;
$$;
