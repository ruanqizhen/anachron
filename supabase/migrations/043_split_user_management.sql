-- ─── New RPCs for split user management ───

-- Get Registered Users (Those who have a record in auth.users)
CREATE OR REPLACE FUNCTION admin_get_registered_users()
RETURNS TABLE(id UUID, username TEXT, bio TEXT, avatar_url TEXT, created_at TIMESTAMPTZ) AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  RETURN QUERY
  SELECT p.id, p.username, p.bio, p.avatar_url, p.created_at
  FROM profiles p
  WHERE p.is_ai_character = false 
    AND p.is_admin = false
    AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get Virtual Users (Those who do NOT have a record in auth.users, and are not AI characters)
CREATE OR REPLACE FUNCTION admin_get_virtual_users()
RETURNS TABLE(id UUID, username TEXT, bio TEXT, avatar_url TEXT, created_at TIMESTAMPTZ) AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  RETURN QUERY
  SELECT p.id, p.username, p.bio, p.avatar_url, p.created_at
  FROM profiles p
  WHERE p.is_ai_character = false 
    AND p.is_admin = false
    AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
