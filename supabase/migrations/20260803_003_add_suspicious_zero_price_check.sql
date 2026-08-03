-- Supports health-check's monitoring signal for games whose current price
-- reads $0 despite real historical pricing (see health-check/route.ts for
-- the full incident writeup -- confirmed live 2026-08-02: Nintendo's price
-- API can return a well-formed but wrong $0 for a game that's genuinely
-- still paid). SECURITY DEFINER + a fixed search_path so this runs with
-- the privileges needed to read all games regardless of caller, without
-- being callable in a way that lets the search_path be hijacked.
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
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(g.price_history) elem
      WHERE (elem->>'price')::numeric > 5
    )
  ORDER BY g.last_price_check DESC;
$$;
