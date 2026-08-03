-- Extends the allowlist again after fixing several Nintendo Classics
-- subscription tiers and F2P spinoffs that were wrongly marked
-- release_status='upcoming' (see CLAUDE.md session log 2026-08-03,
-- WarioWare/Fortune's Weave investigation). Flipping their status to
-- 'released' newly exposed them to this check for the first time --
-- they were previously invisible to it while marked 'upcoming'. All 18
-- confirmed genuinely free via the live Nintendo price API.
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
      '70010000046673', -- Capcom Arcade 2nd Stadium (free base hub, games sold individually)
      '70010000062478', -- Game Boy - Nintendo Classics (NSO membership tier)
      '70010000003482', -- Pokemon Quest (F2P)
      '70010000046988', -- SEGA Genesis - Nintendo Switch Online (NSO membership tier)
      '70010000012879', -- NES - Nintendo Classics (NSO membership tier)
      '70010000022951', -- Super Kirby Clash (F2P)
      '70010000046983', -- N64 - Nintendo Classics (NSO membership tier)
      '70010000018547', -- Tetris 99 (free NSO-exclusive)
      '70010000103930', -- Overwatch (F2P)
      '70010000028523', -- Pokemon HOME (F2P)
      '70010000074094', -- N64 - Nintendo Classics: MATURE 17+ (NSO membership tier)
      '70010000096799', -- GameCube - Nintendo Classics (NSO membership tier)
      '70010000032076', -- Roller Champions (F2P)
      '70010000034186', -- Yu-Gi-Oh! Master Duel (F2P)
      '70010000116685', -- Virtual Boy - Nintendo Classics (NSO membership tier)
      '70010000062483', -- Game Boy Advance - Nintendo Classics (NSO membership tier)
      '70010000032445', -- Pokemon Cafe ReMix (F2P)
      '70010000023176', -- SNES - Nintendo Classics (NSO membership tier)
      '70010000004519'  -- Pokemon Champions (F2P)
    )
  ORDER BY g.last_price_check DESC;
$$;
