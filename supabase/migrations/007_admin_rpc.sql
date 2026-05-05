-- Admin character management and task queue RPC functions.
-- All SECURITY DEFINER — require auth.uid() IS NOT NULL.

-- Get all AI characters (including inactive, for admin)
DROP FUNCTION IF EXISTS admin_get_all_characters();
CREATE OR REPLACE FUNCTION admin_get_all_characters()
RETURNS TABLE(
  id UUID, era TEXT, tags TEXT[], birth_year INT, death_year INT,
  personality_prompt TEXT, comedy_notes TEXT, writing_style TEXT,
  is_active BOOLEAN, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  username TEXT, bio TEXT, avatar_url TEXT
) AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  RETURN QUERY
  SELECT ac.id, ac.era, ac.tags, ac.birth_year, ac.death_year,
    ac.personality_prompt, ac.comedy_notes, ac.writing_style,
    ac.is_active, ac.created_at, ac.updated_at,
    p.username, p.bio, p.avatar_url
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
  p_is_active BOOLEAN,
  p_bio TEXT
) RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  UPDATE ai_characters SET
    personality_prompt = p_personality_prompt,
    comedy_notes = p_comedy_notes,
    writing_style = p_writing_style,
    is_active = p_is_active,
    updated_at = now()
  WHERE id = p_id;
  UPDATE profiles SET bio = p_bio WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get task queue entries with thread title
DROP FUNCTION IF EXISTS admin_get_task_queue();
CREATE OR REPLACE FUNCTION admin_get_task_queue()
RETURNS TABLE(
  id UUID, trigger_post_id UUID, thread_id UUID, task_type TEXT,
  priority TEXT, status TEXT, mentioned_character_ids TEXT[],
  execute_after TIMESTAMPTZ, dispatched_at TIMESTAMPTZ, created_at TIMESTAMPTZ,
  thread_title TEXT
) AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  RETURN QUERY
  SELECT tq.id, tq.trigger_post_id, tq.thread_id, tq.task_type,
    tq.priority, tq.status, tq.mentioned_character_ids,
    tq.execute_after, tq.dispatched_at, tq.created_at,
    th.title
  FROM ai_task_queue tq
  JOIN threads th ON th.id = tq.thread_id
  WHERE tq.status NOT IN ('failed', 'skipped')
  ORDER BY tq.priority DESC, tq.created_at DESC
  LIMIT 100;
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

-- Cancel/delete a task
CREATE OR REPLACE FUNCTION admin_cancel_task(p_task_id UUID)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  DELETE FROM ai_response_queue WHERE task_id = p_task_id;
  DELETE FROM ai_task_queue WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment thread view count
CREATE OR REPLACE FUNCTION increment_view_count(p_thread_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE threads SET view_count = view_count + 1 WHERE id = p_thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin update any thread (including board, timestamp)
CREATE OR REPLACE FUNCTION admin_update_thread(
  p_thread_id UUID,
  p_title TEXT,
  p_content TEXT,
  p_board_id UUID,
  p_created_at TIMESTAMPTZ
) RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  UPDATE threads SET title = p_title, content = p_content, board_id = p_board_id,
    created_at = p_created_at, edited_at = now()
  WHERE id = p_thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin update any post
CREATE OR REPLACE FUNCTION admin_update_post(
  p_post_id UUID,
  p_content TEXT,
  p_created_at TIMESTAMPTZ
) RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  UPDATE posts SET content = p_content, created_at = p_created_at, edited_at = now()
  WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create an AI character (profile + ai_characters)
CREATE OR REPLACE FUNCTION admin_create_character(
  p_username TEXT, p_era TEXT, p_birth_year INT, p_death_year INT,
  p_tags TEXT[], p_personality TEXT, p_comedy TEXT, p_style TEXT
) RETURNS UUID AS $$
DECLARE
  v_id UUID := gen_random_uuid();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  INSERT INTO profiles (id, username, bio, is_ai_character, is_admin)
  VALUES (v_id, p_username, '', true, false);
  INSERT INTO ai_characters (id, era, tags, birth_year, death_year,
    personality_prompt, comedy_notes, writing_style, is_active)
  VALUES (v_id, p_era, p_tags, p_birth_year, p_death_year,
    p_personality, p_comedy, p_style, true);
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete an AI character
CREATE OR REPLACE FUNCTION admin_delete_character(p_id UUID)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  DELETE FROM ai_characters WHERE id = p_id;
  DELETE FROM profiles WHERE id = p_id AND is_ai_character = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all registered (non-AI) users
CREATE OR REPLACE FUNCTION admin_get_users()
RETURNS TABLE(id UUID, username TEXT, bio TEXT, avatar_url TEXT, created_at TIMESTAMPTZ) AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  RETURN QUERY
  SELECT p.id, p.username, p.bio, p.avatar_url, p.created_at
  FROM profiles p WHERE p.is_ai_character = false AND p.is_admin = false
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin update any user profile
CREATE OR REPLACE FUNCTION admin_update_user(
  p_id UUID, p_username TEXT, p_bio TEXT
) RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  UPDATE profiles SET username = p_username, bio = p_bio WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a virtual user (profile only, no auth account)
CREATE OR REPLACE FUNCTION admin_create_virtual_user(
  p_username TEXT, p_bio TEXT DEFAULT ''
) RETURNS UUID AS $$
DECLARE
  v_id UUID := gen_random_uuid();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  INSERT INTO profiles (id, username, bio, is_ai_character, is_admin)
  VALUES (v_id, p_username, p_bio, false, false);
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Toggle thread lock
CREATE OR REPLACE FUNCTION admin_toggle_lock(p_thread_id UUID, p_locked BOOLEAN)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  UPDATE threads SET is_locked = p_locked WHERE id = p_thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin delete a user
CREATE OR REPLACE FUNCTION admin_delete_user(p_id UUID)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  DELETE FROM profiles WHERE id = p_id AND is_ai_character = false AND is_admin = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin soft-delete any thread
CREATE OR REPLACE FUNCTION admin_soft_delete_thread(p_thread_id UUID)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  UPDATE threads SET deleted_at = now() WHERE id = p_thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin soft-delete any post
CREATE OR REPLACE FUNCTION admin_soft_delete_post(p_post_id UUID)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  UPDATE posts SET deleted_at = now() WHERE id = p_post_id;
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
