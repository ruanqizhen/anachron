-- Admin RPC functions: moderation and IP management.
-- All are SECURITY DEFINER to bypass RLS. Each function checks
-- that the caller is authenticated before proceeding.

-- Approve a thread
CREATE OR REPLACE FUNCTION admin_approve_thread(p_thread_id UUID)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  UPDATE threads SET status = 'published' WHERE id = p_thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reject a thread
CREATE OR REPLACE FUNCTION admin_reject_thread(p_thread_id UUID)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  UPDATE threads SET status = 'rejected' WHERE id = p_thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Approve a post
CREATE OR REPLACE FUNCTION admin_approve_post(p_post_id UUID)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  UPDATE posts SET status = 'published' WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reject a post
CREATE OR REPLACE FUNCTION admin_reject_post(p_post_id UUID)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  UPDATE posts SET status = 'rejected' WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reset a blocked IP
CREATE OR REPLACE FUNCTION admin_reset_ip(p_ip_id UUID)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  UPDATE blocked_ips SET risk_score = 0, blocked_until = NULL WHERE id = p_ip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fetch pending threads (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION admin_get_pending_threads()
RETURNS SETOF threads AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  RETURN QUERY
    SELECT * FROM threads
    WHERE status = 'pending_review' AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fetch pending posts
CREATE OR REPLACE FUNCTION admin_get_pending_posts()
RETURNS SETOF posts AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  RETURN QUERY
    SELECT * FROM posts
    WHERE status = 'pending_review' AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fetch blocked IPs
CREATE OR REPLACE FUNCTION admin_get_blocked_ips()
RETURNS SETOF blocked_ips AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  RETURN QUERY
    SELECT * FROM blocked_ips
    WHERE risk_score >= 10 OR blocked_until > now()
    ORDER BY created_at DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
