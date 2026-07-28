-- 052: Fix admin_delete_user to handle all FK dependencies (mirrors 049 character deletion fix)

CREATE OR REPLACE FUNCTION admin_delete_user(p_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();

  -- Clean notifications first (both directions)
  DELETE FROM notifications WHERE recipient_id = p_id OR actor_id = p_id;

  -- Likes and thread_likes have ON DELETE CASCADE but explicit delete is safer for RLS edge cases
  DELETE FROM likes WHERE user_id = p_id;
  DELETE FROM thread_likes WHERE user_id = p_id;

  -- Follows
  DELETE FROM account_follows WHERE follower_id = p_id OR following_id = p_id;

  -- IP risks if any were stored per user id pattern (defensive)
  -- blocked_ips uses ip_address, not profile id, so skip unless pattern user:<uuid>
  DELETE FROM blocked_ips WHERE ip_address = ('user:' || p_id::text);

  -- Preserve content: null out author_id so posts/threads remain but become anonymous
  UPDATE posts SET author_id = NULL WHERE author_id = p_id;
  UPDATE threads SET author_id = NULL WHERE author_id = p_id;

  -- Finally delete profile (only non-AI, non-admin)
  DELETE FROM profiles WHERE id = p_id AND is_ai_character = false AND is_admin = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
