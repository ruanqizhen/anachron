-- 055: Remove AI character prompt fields (personality_prompt, comedy_notes, writing_style)
-- These fields are no longer used; LLM generates replies from base knowledge of the historical figure.

ALTER TABLE ai_characters DROP COLUMN IF EXISTS personality_prompt;
ALTER TABLE ai_characters DROP COLUMN IF EXISTS comedy_notes;
ALTER TABLE ai_characters DROP COLUMN IF EXISTS writing_style;

-- Recreate admin_get_all_characters without the removed columns
DROP FUNCTION IF EXISTS admin_get_all_characters();
CREATE OR REPLACE FUNCTION admin_get_all_characters()
RETURNS TABLE(
  id UUID, era TEXT, tags TEXT[], birth_year INT, death_year INT,
  is_active BOOLEAN, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  username TEXT, bio TEXT, avatar_url TEXT
) AS $$
BEGIN
  PERFORM check_admin_access();
  RETURN QUERY
  SELECT ac.id, ac.era, ac.tags, ac.birth_year, ac.death_year,
    ac.is_active, ac.created_at, ac.updated_at,
    p.username, p.bio, p.avatar_url
  FROM ai_characters ac
  JOIN profiles p ON p.id = ac.id
  ORDER BY ac.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate admin_update_character without prompt fields
DROP FUNCTION IF EXISTS admin_update_character(UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS admin_update_character(UUID, BOOLEAN, TEXT);
CREATE OR REPLACE FUNCTION admin_update_character(
  p_id UUID,
  p_is_active BOOLEAN,
  p_bio TEXT
) RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();
  UPDATE ai_characters SET
    is_active = p_is_active,
    updated_at = now()
  WHERE id = p_id;
  UPDATE profiles SET bio = p_bio WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate admin_create_character without prompt fields
DROP FUNCTION IF EXISTS admin_create_character(TEXT, TEXT, INT, INT, TEXT[], TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS admin_create_character(TEXT, TEXT, INT, INT, TEXT[]);
CREATE OR REPLACE FUNCTION admin_create_character(
  p_username TEXT, p_era TEXT, p_birth_year INT, p_death_year INT,
  p_tags TEXT[]
) RETURNS UUID AS $$
DECLARE
  v_id UUID := gen_random_uuid();
BEGIN
  PERFORM check_admin_access();
  INSERT INTO profiles (id, username, bio, is_ai_character, is_admin)
  VALUES (v_id, p_username, '', true, false);
  INSERT INTO ai_characters (id, era, tags, birth_year, death_year, is_active)
  VALUES (v_id, p_era, p_tags, p_birth_year, p_death_year, true);
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
