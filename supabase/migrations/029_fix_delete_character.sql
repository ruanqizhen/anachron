-- Fix: admin_delete_character now handles foreign key constraints
-- by nullifying references in posts, threads, and other tables before deleting

CREATE OR REPLACE FUNCTION admin_delete_character(p_id UUID)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  -- Nullify references in dependent tables
  UPDATE posts SET author_id = NULL WHERE author_id = p_id;
  UPDATE threads SET author_id = NULL WHERE author_id = p_id;
  DELETE FROM likes WHERE user_id = p_id;
  DELETE FROM thread_likes WHERE user_id = p_id;
  DELETE FROM ai_response_queue WHERE character_id = p_id;
  DELETE FROM daily_ai_stats WHERE character_id = p_id;
  DELETE FROM notifications WHERE recipient_id = p_id OR actor_id = p_id;

  -- Delete character tables
  DELETE FROM ai_characters WHERE id = p_id;
  DELETE FROM profiles WHERE id = p_id AND is_ai_character = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
