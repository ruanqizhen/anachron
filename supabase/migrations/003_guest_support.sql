-- Guest session support and RLS fixes.
-- Allows guest posting with custom display names,
-- and fixes guest_sessions visibility for display purposes.

-- Allow reading guest session info (usernames are public)
DROP POLICY IF EXISTS "guest_sessions_deny" ON guest_sessions;
CREATE POLICY "guest_sessions_select" ON guest_sessions FOR SELECT USING (true);

-- Create a guest session (RPC, bypasses IP requirement via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION create_guest_rpc(
  p_username TEXT
) RETURNS UUID AS $$
DECLARE
  v_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO guest_sessions (id, username, session_token, ip_address)
  VALUES (v_id, p_username, gen_random_uuid()::text, '0.0.0.0'::inet);
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update create_thread_rpc to support guest
CREATE OR REPLACE FUNCTION create_thread_rpc(
  p_board_id UUID,
  p_title TEXT,
  p_content TEXT,
  p_author_id UUID DEFAULT NULL,
  p_guest_id UUID DEFAULT NULL
) RETURNS SETOF threads AS $$
BEGIN
  RETURN QUERY
  INSERT INTO threads (board_id, title, content, author_id, guest_id, status)
  VALUES (p_board_id, p_title, p_content, p_author_id, p_guest_id, 'published')
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update create_post_rpc to support guest
CREATE OR REPLACE FUNCTION create_post_rpc(
  p_thread_id UUID,
  p_content TEXT,
  p_author_id UUID DEFAULT NULL,
  p_guest_id UUID DEFAULT NULL,
  p_parent_post_id UUID DEFAULT NULL
) RETURNS SETOF posts AS $$
BEGIN
  RETURN QUERY
  INSERT INTO posts (thread_id, content, author_id, guest_id, parent_post_id, status)
  VALUES (p_thread_id, p_content, p_author_id, p_guest_id, p_parent_post_id, 'published')
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
