-- Add per-category notification preferences to game and franchise follows
-- Default all true so existing follows keep getting all alerts

-- Game follows
ALTER TABLE user_game_follows ADD COLUMN IF NOT EXISTS notify_announcements boolean not null default true;
ALTER TABLE user_game_follows ADD COLUMN IF NOT EXISTS notify_sales boolean not null default true;
ALTER TABLE user_game_follows ADD COLUMN IF NOT EXISTS notify_all_time_low boolean not null default true;
ALTER TABLE user_game_follows ADD COLUMN IF NOT EXISTS notify_releases boolean not null default true;

-- Franchise follows
ALTER TABLE user_franchise_follows ADD COLUMN IF NOT EXISTS notify_announcements boolean not null default true;
ALTER TABLE user_franchise_follows ADD COLUMN IF NOT EXISTS notify_sales boolean not null default true;
ALTER TABLE user_franchise_follows ADD COLUMN IF NOT EXISTS notify_all_time_low boolean not null default true;
ALTER TABLE user_franchise_follows ADD COLUMN IF NOT EXISTS notify_releases boolean not null default true;

-- Franchise popularity score (computed by catalog sync)
ALTER TABLE franchises ADD COLUMN IF NOT EXISTS popularity_score integer not null default 0;
