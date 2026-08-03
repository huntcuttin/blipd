-- Nintendo's own catalog feed tags each listing's editions (Digital vs
-- Digital+Physical). Storing this lets the release-time page predict a
-- specific launch time per game instead of showing generic rules.
ALTER TABLE games ADD COLUMN IF NOT EXISTS has_physical_release boolean;
