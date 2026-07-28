-- 052: Fix admin_delete_user to handle all FK dependencies (mirrors 049 character deletion fix)

CREATE OR REPLACE FUNCTION admin_delete_user(p_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();

  DELETE FROM notifications WHERE recipient_id = p_id OR actor_id = p_id;
  DELETE FROM likes WHERE user_id = p_id;
  DELETE FROM thread_likes WHERE user_id = p_id;
  DELETE FROM account_follows WHERE follower_id = p_id OR following_id = p_id;
  DELETE FROM reports WHERE reporter_id = p_id;

  -- blocked_ips is INET type, 'user:<uuid>' pattern was invalid and caused transaction abort
  -- Do not attempt to delete from blocked_ips here; IP blocking is separate concern.
  -- If needed in future, store user ref in reason column and clean via reason LIKE.

  UPDATE posts SET author_id = NULL WHERE author_id = p_id;
  UPDATE threads SET author_id = NULL WHERE author_id = p_id;

  DELETE FROM profiles WHERE id = p_id AND is_ai_character = false AND is_admin = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
