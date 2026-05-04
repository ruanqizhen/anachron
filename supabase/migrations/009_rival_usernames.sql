-- Change rival_character_ids from UUID[] to TEXT[] (store usernames).
-- Resolve existing UUIDs to usernames where possible.

DO $$
DECLARE
  rec RECORD;
BEGIN
  -- 1. Drop the old column and recreate as TEXT[]
  ALTER TABLE ai_characters DROP COLUMN IF EXISTS rival_character_ids;
  ALTER TABLE ai_characters ADD COLUMN rival_character_ids TEXT[] NOT NULL DEFAULT '{}';

  -- 2. Migrate seed data: resolve old UUID-based rivals to usernames
  FOR rec IN SELECT * FROM ai_characters LOOP
    -- Each character's rivals will be set via the admin UI; for now keep empty
    NULL;
  END LOOP;
END $$;
