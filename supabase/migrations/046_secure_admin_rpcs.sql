-- ==========================================
-- Anachron Security Migration: 046_secure_admin_rpcs
-- Purpose: Protect admin roles, secure admin RPCs, and harden creation RPCs
-- ==========================================

-- 1. Helper function for admin access check
CREATE OR REPLACE FUNCTION check_admin_access()
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger function to protect profiles is_admin & is_ai_character flags
CREATE OR REPLACE FUNCTION protect_profile_roles()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_admin = true OR NEW.is_ai_character = true THEN
      IF auth.uid() IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND is_admin = true
      ) THEN
        RAISE EXCEPTION 'Access denied. Only administrators can assign roles.';
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin OR NEW.is_ai_character IS DISTINCT FROM OLD.is_ai_character THEN
      IF auth.uid() IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND is_admin = true
      ) THEN
        RAISE EXCEPTION 'Access denied. Only administrators can modify roles.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_roles ON profiles;
CREATE TRIGGER trg_protect_profile_roles
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_profile_roles();

-- 3. Hardened Thread & Post creation RPCs with Rate Limiting & Fail-Secure defaults

CREATE OR REPLACE FUNCTION create_thread_rpc(
  p_board_id UUID,
  p_title TEXT,
  p_content TEXT,
  p_author_id UUID DEFAULT NULL,
  p_guest_id UUID DEFAULT NULL
) RETURNS SETOF threads AS $$
DECLARE
  v_status TEXT := 'pending_review';
  v_is_privileged BOOLEAN := false;
BEGIN
  -- Check if author is privileged (admin or AI character)
  IF p_author_id IS NOT NULL THEN
    SELECT (is_admin = true OR is_ai_character = true)
    INTO v_is_privileged
    FROM profiles
    WHERE id = p_author_id;
    
    IF v_is_privileged THEN
      v_status := 'published';
    END IF;
  END IF;

  -- Apply rate limiting unless privileged
  IF NOT COALESCE(v_is_privileged, false) THEN
    IF p_author_id IS NOT NULL THEN
      -- Authenticated user: 1 minute rate limit
      IF EXISTS (
        SELECT 1 FROM threads
        WHERE author_id = p_author_id
          AND created_at > now() - INTERVAL '1 minute'
      ) THEN
        RAISE EXCEPTION '发帖过于频繁，请等待1分钟后再试。';
      END IF;
    ELSIF p_guest_id IS NOT NULL THEN
      -- Guest: 5 minutes rate limit
      IF EXISTS (
        SELECT 1 FROM threads
        WHERE guest_id = p_guest_id
          AND created_at > now() - INTERVAL '5 minutes'
      ) THEN
        RAISE EXCEPTION '游客发帖过于频繁，请等待5分钟后再试。';
      END IF;
    ELSE
      RAISE EXCEPTION '无效的发帖作者。';
    END IF;
  END IF;

  RETURN QUERY
  INSERT INTO threads (board_id, title, content, author_id, guest_id, status)
  VALUES (p_board_id, p_title, p_content, p_author_id, p_guest_id, v_status)
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_post_rpc(
  p_thread_id UUID,
  p_content TEXT,
  p_author_id UUID DEFAULT NULL,
  p_guest_id UUID DEFAULT NULL,
  p_parent_post_id UUID DEFAULT NULL
) RETURNS SETOF posts AS $$
DECLARE
  v_status TEXT := 'pending_review';
  v_is_privileged BOOLEAN := false;
BEGIN
  -- Check if author is privileged (admin or AI character)
  IF p_author_id IS NOT NULL THEN
    SELECT (is_admin = true OR is_ai_character = true)
    INTO v_is_privileged
    FROM profiles
    WHERE id = p_author_id;
    
    IF v_is_privileged THEN
      v_status := 'published';
    END IF;
  END IF;

  -- Apply rate limiting unless privileged
  IF NOT COALESCE(v_is_privileged, false) THEN
    IF p_author_id IS NOT NULL THEN
      -- Authenticated user: 10 seconds rate limit
      IF EXISTS (
        SELECT 1 FROM posts
        WHERE author_id = p_author_id
          AND created_at > now() - INTERVAL '10 seconds'
      ) THEN
        RAISE EXCEPTION '回帖过于频繁，请等待10秒后再试。';
      END IF;
    ELSIF p_guest_id IS NOT NULL THEN
      -- Guest: 1 minute rate limit
      IF EXISTS (
        SELECT 1 FROM posts
        WHERE guest_id = p_guest_id
          AND created_at > now() - INTERVAL '1 minute'
      ) THEN
        RAISE EXCEPTION '游客回帖过于频繁，请等待1分钟后再试。';
      END IF;
    ELSE
      RAISE EXCEPTION '无效的回帖作者。';
    END IF;
  END IF;

  RETURN QUERY
  INSERT INTO posts (thread_id, content, author_id, guest_id, parent_post_id, status)
  VALUES (p_thread_id, p_content, p_author_id, p_guest_id, p_parent_post_id, v_status)
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Secure all 35 administrative RPC functions

-- admin_approve_thread
CREATE OR REPLACE FUNCTION admin_approve_thread(p_thread_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();
  UPDATE threads SET status = 'published' WHERE id = p_thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_reject_thread
CREATE OR REPLACE FUNCTION admin_reject_thread(p_thread_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();
  UPDATE threads SET status = 'rejected' WHERE id = p_thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_approve_post
CREATE OR REPLACE FUNCTION admin_approve_post(p_post_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();
  UPDATE posts SET status = 'published' WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_reject_post
CREATE OR REPLACE FUNCTION admin_reject_post(p_post_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();
  UPDATE posts SET status = 'rejected' WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_reset_ip
CREATE OR REPLACE FUNCTION admin_reset_ip(p_ip_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();
  UPDATE blocked_ips SET risk_score = 0, blocked_until = NULL WHERE id = p_ip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_get_pending_threads
CREATE OR REPLACE FUNCTION admin_get_pending_threads()
RETURNS SETOF threads AS $$
BEGIN
  PERFORM check_admin_access();
  RETURN QUERY
    SELECT * FROM threads
    WHERE status = 'pending_review' AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_get_pending_posts
CREATE OR REPLACE FUNCTION admin_get_pending_posts()
RETURNS SETOF posts AS $$
BEGIN
  PERFORM check_admin_access();
  RETURN QUERY
    SELECT * FROM posts
    WHERE status = 'pending_review' AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_get_blocked_ips
CREATE OR REPLACE FUNCTION admin_get_blocked_ips()
RETURNS SETOF blocked_ips AS $$
BEGIN
  PERFORM check_admin_access();
  RETURN QUERY
    SELECT * FROM blocked_ips
    WHERE risk_score >= 10 OR blocked_until > now()
    ORDER BY created_at DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_get_all_characters
CREATE OR REPLACE FUNCTION admin_get_all_characters()
RETURNS TABLE(
  id UUID, era TEXT, tags TEXT[], birth_year INT, death_year INT,
  personality_prompt TEXT, comedy_notes TEXT, writing_style TEXT,
  is_active BOOLEAN, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  username TEXT, bio TEXT, avatar_url TEXT
) AS $$
BEGIN
  PERFORM check_admin_access();
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

-- admin_update_character
CREATE OR REPLACE FUNCTION admin_update_character(
  p_id UUID,
  p_personality_prompt TEXT,
  p_comedy_notes TEXT,
  p_writing_style TEXT,
  p_is_active BOOLEAN,
  p_bio TEXT
) RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();
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

-- admin_get_task_queue
CREATE OR REPLACE FUNCTION admin_get_task_queue()
RETURNS TABLE(
  id UUID, trigger_post_id UUID, thread_id UUID, task_type TEXT,
  priority TEXT, status TEXT, mentioned_character_ids TEXT[],
  execute_after TIMESTAMPTZ, dispatched_at TIMESTAMPTZ, created_at TIMESTAMPTZ,
  thread_title TEXT
) AS $$
BEGIN
  PERFORM check_admin_access();
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

-- admin_add_response_task
CREATE OR REPLACE FUNCTION admin_add_response_task(
  p_character_id UUID,
  p_thread_id UUID,
  p_trigger_post_id UUID
) RETURNS UUID AS $$
DECLARE
  v_id UUID := gen_random_uuid();
BEGIN
  PERFORM check_admin_access();
  INSERT INTO ai_response_queue (id, character_id, trigger_post_id, thread_id, status, execute_after)
  VALUES (v_id, p_character_id, p_trigger_post_id, p_thread_id, 'pending', now());
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_cancel_task
CREATE OR REPLACE FUNCTION admin_cancel_task(p_task_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();
  DELETE FROM ai_response_queue WHERE task_id = p_task_id;
  DELETE FROM ai_task_queue WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_update_thread
CREATE OR REPLACE FUNCTION admin_update_thread(
  p_thread_id UUID,
  p_title TEXT,
  p_content TEXT,
  p_board_id UUID,
  p_created_at TIMESTAMPTZ DEFAULT NULL
) RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();
  UPDATE threads SET 
    title = p_title, 
    content = p_content, 
    board_id = p_board_id,
    created_at = COALESCE(p_created_at, created_at), 
    edited_at = now()
  WHERE id = p_thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_update_post
CREATE OR REPLACE FUNCTION admin_update_post(
  p_post_id UUID,
  p_content TEXT,
  p_created_at TIMESTAMPTZ DEFAULT NULL
) RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();
  UPDATE posts SET 
    content = p_content, 
    created_at = COALESCE(p_created_at, created_at), 
    edited_at = now()
  WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_create_character
CREATE OR REPLACE FUNCTION admin_create_character(
  p_username TEXT, p_era TEXT, p_birth_year INT, p_death_year INT,
  p_tags TEXT[], p_personality TEXT, p_comedy TEXT, p_style TEXT
) RETURNS UUID AS $$
DECLARE
  v_id UUID := gen_random_uuid();
BEGIN
  PERFORM check_admin_access();
  INSERT INTO profiles (id, username, bio, is_ai_character, is_admin)
  VALUES (v_id, p_username, '', true, false);
  INSERT INTO ai_characters (id, era, tags, birth_year, death_year,
    personality_prompt, comedy_notes, writing_style, is_active)
  VALUES (v_id, p_era, p_tags, p_birth_year, p_death_year,
    p_personality, p_comedy, p_style, true);
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_delete_character
CREATE OR REPLACE FUNCTION admin_delete_character(p_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();
  DELETE FROM ai_characters WHERE id = p_id;
  DELETE FROM profiles WHERE id = p_id AND is_ai_character = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_get_users
CREATE OR REPLACE FUNCTION admin_get_users()
RETURNS TABLE(id UUID, username TEXT, bio TEXT, avatar_url TEXT, created_at TIMESTAMPTZ) AS $$
BEGIN
  PERFORM check_admin_access();
  RETURN QUERY
  SELECT p.id, p.username, p.bio, p.avatar_url, p.created_at
  FROM profiles p WHERE p.is_ai_character = false AND p.is_admin = false
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_update_user
CREATE OR REPLACE FUNCTION admin_update_user(
  p_id UUID, p_username TEXT, p_bio TEXT, p_avatar_url TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();
  UPDATE profiles 
  SET username = p_username, bio = p_bio, avatar_url = COALESCE(p_avatar_url, avatar_url)
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_create_virtual_user
CREATE OR REPLACE FUNCTION admin_create_virtual_user(
  p_username TEXT, p_bio TEXT DEFAULT '', p_avatar_url TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID := gen_random_uuid();
BEGIN
  PERFORM check_admin_access();
  INSERT INTO profiles (id, username, bio, avatar_url, is_ai_character, is_admin)
  VALUES (v_id, p_username, p_bio, p_avatar_url, false, false);
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_toggle_lock
CREATE OR REPLACE FUNCTION admin_toggle_lock(p_thread_id UUID, p_locked BOOLEAN)
RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();
  UPDATE threads SET is_locked = p_locked WHERE id = p_thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_create_board
CREATE OR REPLACE FUNCTION admin_create_board(
  p_name TEXT, p_slug TEXT, p_description TEXT, p_era_tag TEXT, p_icon TEXT
) RETURNS UUID AS $$
DECLARE v_id UUID := gen_random_uuid(); v_order INT;
BEGIN
  PERFORM check_admin_access();
  SELECT COALESCE(MAX(display_order), 0) + 1 INTO v_order FROM boards;
  INSERT INTO boards (id, name, slug, description, era_tag, icon, display_order)
  VALUES (v_id, p_name, p_slug, p_description, p_era_tag, p_icon, v_order);
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_update_board
CREATE OR REPLACE FUNCTION admin_update_board(
  p_id UUID, p_name TEXT, p_slug TEXT, p_description TEXT, p_era_tag TEXT, p_icon TEXT, p_display_order INT
) RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();
  UPDATE boards SET name = p_name, slug = p_slug, description = p_description,
    era_tag = p_era_tag, icon = p_icon, display_order = p_display_order
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_delete_board
CREATE OR REPLACE FUNCTION admin_delete_board(p_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();
  DELETE FROM boards WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_set_pin_level
CREATE OR REPLACE FUNCTION admin_set_pin_level(p_thread_id UUID, p_level INT)
RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();
  UPDATE threads SET pin_level = p_level WHERE id = p_thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_toggle_featured
CREATE OR REPLACE FUNCTION admin_toggle_featured(p_thread_id UUID, p_featured BOOLEAN)
RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();
  UPDATE threads SET is_featured = p_featured WHERE id = p_thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_update_avatar
CREATE OR REPLACE FUNCTION admin_update_avatar(p_id UUID, p_avatar_url TEXT)
RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();
  UPDATE profiles SET avatar_url = p_avatar_url WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_delete_user
CREATE OR REPLACE FUNCTION admin_delete_user(p_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();
  DELETE FROM profiles WHERE id = p_id AND is_ai_character = false AND is_admin = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_soft_delete_thread
CREATE OR REPLACE FUNCTION admin_soft_delete_thread(p_thread_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();
  UPDATE threads SET deleted_at = now() WHERE id = p_thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_soft_delete_post
CREATE OR REPLACE FUNCTION admin_soft_delete_post(p_post_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();
  UPDATE posts SET deleted_at = now() WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_get_daily_stats
CREATE OR REPLACE FUNCTION admin_get_daily_stats(p_days INT DEFAULT 7)
RETURNS TABLE(character_name TEXT, date DATE, reply_count INT) AS $$
BEGIN
  PERFORM check_admin_access();
  RETURN QUERY
  SELECT p.username, s.date, s.reply_count
  FROM character_daily_stats s
  JOIN profiles p ON p.id = s.character_id
  WHERE s.date >= CURRENT_DATE - p_days
  ORDER BY s.date DESC, s.reply_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_get_registered_users
CREATE OR REPLACE FUNCTION admin_get_registered_users()
RETURNS TABLE(id UUID, username TEXT, bio TEXT, avatar_url TEXT, created_at TIMESTAMPTZ) AS $$
BEGIN
  PERFORM check_admin_access();
  RETURN QUERY
  SELECT p.id, p.username, p.bio, p.avatar_url, p.created_at
  FROM profiles p
  WHERE p.is_ai_character = false 
    AND p.is_admin = false
    AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_get_virtual_users
CREATE OR REPLACE FUNCTION admin_get_virtual_users()
RETURNS TABLE(id UUID, username TEXT, bio TEXT, avatar_url TEXT, created_at TIMESTAMPTZ) AS $$
BEGIN
  PERFORM check_admin_access();
  RETURN QUERY
  SELECT p.id, p.username, p.bio, p.avatar_url, p.created_at
  FROM profiles p
  WHERE p.is_ai_character = false 
    AND p.is_admin = false
    AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_get_pending_reports
CREATE OR REPLACE FUNCTION admin_get_pending_reports()
RETURNS TABLE (
  id UUID,
  reporter_id UUID,
  target_type TEXT,
  target_id UUID,
  reason TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  reporter_username TEXT,
  target_content TEXT
) AS $$
BEGIN
  PERFORM check_admin_access();
  RETURN QUERY
  SELECT 
    r.id,
    r.reporter_id,
    r.target_type,
    r.target_id,
    r.reason,
    r.status,
    r.created_at,
    COALESCE(p.username, '未知用户') AS reporter_username,
    CASE 
      WHEN r.target_type = 'thread' THEN (SELECT title FROM threads WHERE threads.id = r.target_id)
      WHEN r.target_type = 'post' THEN (SELECT content FROM posts WHERE posts.id = r.target_id)
      ELSE '未知内容'
    END AS target_content
  FROM reports r
  LEFT JOIN profiles p ON r.reporter_id = p.id
  WHERE r.status = 'pending'
  ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_resolve_report
CREATE OR REPLACE FUNCTION admin_resolve_report(p_report_id UUID, p_status TEXT)
RETURNS void AS $$
BEGIN
  PERFORM check_admin_access();
  UPDATE reports SET status = p_status WHERE id = p_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
