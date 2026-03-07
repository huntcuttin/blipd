-- One-time cleanup: remove corrupted '[]' franchise
-- Run via Supabase SQL Editor or psql

-- Remove the '[]' franchise entry
DELETE FROM franchises WHERE name = '[]';

-- Clear franchise on games so detectFranchise can re-assign on next sync
UPDATE games SET franchise = NULL WHERE franchise = '[]';
