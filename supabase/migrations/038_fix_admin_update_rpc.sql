-- Fix Admin Update RPCs to handle optional timestamps
-- This resolves the "could not find function" error when admins edit without changing the time.

-- 1. Fix admin_update_post
CREATE OR REPLACE FUNCTION admin_update_post(
  p_post_id UUID,
  p_content TEXT,
  p_created_at TIMESTAMPTZ DEFAULT NULL
) RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  
  UPDATE posts SET 
    content = p_content, 
    created_at = COALESCE(p_created_at, created_at), 
    edited_at = now()
  WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix admin_update_thread
CREATE OR REPLACE FUNCTION admin_update_thread(
  p_thread_id UUID,
  p_title TEXT,
  p_content TEXT,
  p_board_id UUID,
  p_created_at TIMESTAMPTZ DEFAULT NULL
) RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  UPDATE threads SET 
    title = p_title, 
    content = p_content, 
    board_id = p_board_id,
    created_at = COALESCE(p_created_at, created_at), 
    edited_at = now()
  WHERE id = p_thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
