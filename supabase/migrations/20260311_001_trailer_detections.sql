-- Trailer detections table
-- Stores YouTube videos detected from Nintendo's channel + Claude match results
-- MIGRATION NEEDED: Run in Supabase SQL Editor

CREATE TYPE trailer_status AS ENUM ('pending', 'auto_published', 'approved', 'rejected');

CREATE TABLE IF NOT EXISTS trailer_detections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  published_at timestamptz NOT NULL,
  thumbnail_url text,

  -- Claude match results
  matched_game_id uuid REFERENCES games(id) ON DELETE SET NULL,
  matched_game_slug text,
  matched_game_title text,
  matched_franchise text,
  confidence float CHECK (confidence >= 0 AND confidence <= 1),
  claude_reasoning text,

  -- Workflow
  status trailer_status DEFAULT 'pending' NOT NULL,
  alert_id uuid REFERENCES alerts(id) ON DELETE SET NULL,
  detected_at timestamptz DEFAULT now() NOT NULL,
  reviewed_at timestamptz,
  reviewed_by text
);

CREATE INDEX IF NOT EXISTS idx_trailer_detections_status ON trailer_detections(status);
CREATE INDEX IF NOT EXISTS idx_trailer_detections_video_id ON trailer_detections(video_id);
CREATE INDEX IF NOT EXISTS idx_trailer_detections_detected_at ON trailer_detections(detected_at DESC);
