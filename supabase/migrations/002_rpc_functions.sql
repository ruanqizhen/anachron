-- RPC functions for post/thread creation.
-- These are SECURITY DEFINER so they bypass RLS, serving as the fallback
-- when the post-handler Edge Function is not deployed.
-- The Edge Function (with Turnstile verification) is the primary path.

-- Create a thread (with author or guest)
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

-- Create a post (reply)
CREATE OR REPLACE FUNCTION create_post_rpc(
  p_thread_id UUID,
  p_content TEXT,
  p_author_id UUID DEFAULT NULL,
  p_parent_post_id UUID DEFAULT NULL
) RETURNS SETOF posts AS $$
BEGIN
  RETURN QUERY
  INSERT INTO posts (thread_id, content, author_id, parent_post_id, status)
  VALUES (p_thread_id, p_content, p_author_id, p_parent_post_id, 'published')
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
