-- Admin character management and task queue RPC functions.
-- All SECURITY DEFINER — require auth.uid() IS NOT NULL.

-- Get all AI characters (including inactive, for admin)
CREATE OR REPLACE FUNCTION admin_get_all_characters()
RETURNS TABLE(
  id UUID, era TEXT, tags TEXT[], birth_year INT, death_year INT,
  personality_prompt TEXT, comedy_notes TEXT, writing_style TEXT,
  rival_character_ids UUID[], preferred_boards TEXT[], preferred_topics TEXT[],
  preferred_user_ids UUID[], model_provider TEXT, model_name TEXT,
  daily_reply_limit INT, is_active BOOLEAN, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  username TEXT, bio TEXT, avatar_url TEXT
) AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  RETURN QUERY
  SELECT ac.*, p.username, p.bio, p.avatar_url
  FROM ai_characters ac
  JOIN profiles p ON p.id = ac.id
  ORDER BY ac.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update an AI character
CREATE OR REPLACE FUNCTION admin_update_character(
  p_id UUID,
  p_personality_prompt TEXT,
  p_comedy_notes TEXT,
  p_writing_style TEXT,
  p_rival_character_ids UUID[],
  p_preferred_boards TEXT[],
  p_preferred_topics TEXT[],
  p_model_provider TEXT,
  p_model_name TEXT,
  p_daily_reply_limit INT,
  p_is_active BOOLEAN,
  p_bio TEXT
) RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  UPDATE ai_characters SET
    personality_prompt = p_personality_prompt,
    comedy_notes = p_comedy_notes,
    writing_style = p_writing_style,
    rival_character_ids = p_rival_character_ids,
    preferred_boards = p_preferred_boards,
    preferred_topics = p_preferred_topics,
    model_provider = p_model_provider,
    model_name = p_model_name,
    daily_reply_limit = p_daily_reply_limit,
    is_active = p_is_active,
    updated_at = now()
  WHERE id = p_id;
  UPDATE profiles SET bio = p_bio WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get task queue entries
CREATE OR REPLACE FUNCTION admin_get_task_queue()
RETURNS SETOF ai_task_queue AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  RETURN QUERY SELECT * FROM ai_task_queue
    ORDER BY priority DESC, created_at DESC LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Manually insert a response task (bypasses dispatcher)
CREATE OR REPLACE FUNCTION admin_add_response_task(
  p_character_id UUID,
  p_thread_id UUID,
  p_trigger_post_id UUID
) RETURNS UUID AS $$
DECLARE
  v_id UUID := gen_random_uuid();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  INSERT INTO ai_response_queue (id, character_id, trigger_post_id, thread_id, status, execute_after)
  VALUES (v_id, p_character_id, p_trigger_post_id, p_thread_id, 'pending', now());
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cancel a task
CREATE OR REPLACE FUNCTION admin_cancel_task(p_task_id UUID)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  UPDATE ai_task_queue SET status = 'failed', processed_at = now() WHERE id = p_task_id;
  UPDATE ai_response_queue SET status = 'failed', processed_at = now() WHERE task_id = p_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment thread view count
CREATE OR REPLACE FUNCTION increment_view_count(p_thread_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE threads SET view_count = view_count + 1 WHERE id = p_thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get daily stats for charts
CREATE OR REPLACE FUNCTION admin_get_daily_stats(p_days INT DEFAULT 7)
RETURNS TABLE(character_name TEXT, date DATE, reply_count INT) AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  RETURN QUERY
  SELECT p.username, s.date, s.reply_count
  FROM character_daily_stats s
  JOIN profiles p ON p.id = s.character_id
  WHERE s.date >= CURRENT_DATE - p_days
  ORDER BY s.date DESC, s.reply_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
