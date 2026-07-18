-- Fix AI Character Deletion RPC
CREATE OR REPLACE FUNCTION admin_delete_character(p_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();
  
  -- Clean up references in ai_response_queue
  DELETE FROM ai_response_queue WHERE character_id = p_id;
  
  -- Clean up references in ai_dispatch_log
  DELETE FROM ai_dispatch_log WHERE character_id = p_id;
  
  -- Clean up references in character_daily_stats
  DELETE FROM character_daily_stats WHERE character_id = p_id;
  
  -- Clean up notifications recipient and actor references
  DELETE FROM notifications WHERE recipient_id = p_id OR actor_id = p_id;
  
  -- Set author_id to NULL in posts and threads to preserve the content without violating constraints
  UPDATE posts SET author_id = NULL WHERE author_id = p_id;
  UPDATE threads SET author_id = NULL WHERE author_id = p_id;
  
  -- Delete from ai_characters
  DELETE FROM ai_characters WHERE id = p_id;
  
  -- Delete from profiles
  DELETE FROM profiles WHERE id = p_id AND is_ai_character = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
