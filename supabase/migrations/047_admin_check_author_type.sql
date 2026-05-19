-- Migration 047: Admin Custom Author Check RPC
-- Supports checking if a username is an AI character or Virtual user (profile exists but has no auth record).

CREATE OR REPLACE FUNCTION admin_check_author_type(p_username TEXT)
RETURNS TABLE (
  is_ai BOOLEAN,
  is_virtual BOOLEAN,
  profile_id UUID
) AS $$
BEGIN
  -- Restrict to administrators
  PERFORM check_admin_access();
  
  RETURN QUERY
  SELECT 
    p.is_ai_character AS is_ai,
    (p.is_ai_character = false AND p.is_admin = false AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)) AS is_virtual,
    p.id AS profile_id
  FROM profiles p
  WHERE p.username = p_username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
