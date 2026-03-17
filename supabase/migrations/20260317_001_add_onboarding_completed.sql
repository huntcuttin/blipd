-- Add onboarding_completed flag to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
