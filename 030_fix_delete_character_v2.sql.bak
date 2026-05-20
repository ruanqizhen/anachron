-- Fix: admin_delete_character now also cleans up character_daily_stats
-- This prevents foreign key violations when deleting a character that has activity stats

CREATE OR REPLACE FUNCTION admin_delete_character(p_id UUID)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  -- 1. Nullify references in social/content tables
  UPDATE posts SET author_id = NULL WHERE author_id = p_id;
  UPDATE threads SET author_id = NULL WHERE author_id = p_id;
  DELETE FROM likes WHERE user_id = p_id;
  DELETE FROM thread_likes WHERE user_id = p_id;
  DELETE FROM notifications WHERE recipient_id = p_id OR actor_id = p_id;

  -- 2. Delete from AI-specific queues and stats
  DELETE FROM ai_response_queue WHERE character_id = p_id;
  DELETE FROM character_daily_stats WHERE character_id = p_id;
  
  -- 3. Delete from the core character and profile tables
  DELETE FROM ai_characters WHERE id = p_id;
  DELETE FROM profiles WHERE id = p_id AND is_ai_character = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
