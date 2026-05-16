-- Update admin_update_user to include avatar_url
CREATE OR REPLACE FUNCTION admin_update_user(
  p_id UUID, p_username TEXT, p_bio TEXT, p_avatar_url TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  UPDATE profiles 
  SET username = p_username, bio = p_bio, avatar_url = COALESCE(p_avatar_url, avatar_url)
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update admin_create_virtual_user to include avatar_url
CREATE OR REPLACE FUNCTION admin_create_virtual_user(
  p_username TEXT, p_bio TEXT DEFAULT '', p_avatar_url TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID := gen_random_uuid();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  INSERT INTO profiles (id, username, bio, avatar_url, is_ai_character, is_admin)
  VALUES (v_id, p_username, p_bio, p_avatar_url, false, false);
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
