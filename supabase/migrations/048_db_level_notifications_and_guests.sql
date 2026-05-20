-- Migration 048: Unified Guest Sessions and Database-Level Notifications

-- 1. Redefine create_guest_rpc to accept an optional IP, resolve it dynamically, and return the complete inserted row.
DROP FUNCTION IF EXISTS create_guest_rpc(TEXT);

CREATE OR REPLACE FUNCTION create_guest_rpc(
  p_username TEXT,
  p_ip TEXT DEFAULT NULL
) RETURNS SETOF guest_sessions AS $$
DECLARE
  v_id UUID := gen_random_uuid();
  v_session_token TEXT := gen_random_uuid()::text;
  v_ip INET;
BEGIN
  -- Dynamically resolve client IP from parameters or request headers, defaulting to 0.0.0.0
  v_ip := COALESCE(
    p_ip,
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'cf-connecting-ip',
    '0.0.0.0'
  )::inet;

  RETURN QUERY
  INSERT INTO guest_sessions (id, username, session_token, ip_address, created_at)
  VALUES (v_id, p_username, v_session_token, v_ip, NOW())
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Trigger for automated thread notifications (Mentions in new/published threads)
CREATE OR REPLACE FUNCTION handle_thread_notifications()
RETURNS TRIGGER AS $$
DECLARE
  r_username TEXT;
  r_profile_id UUID;
BEGIN
  -- Only trigger notifications when a thread is published
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    -- Parse mentions from title and content using global regex matching
    FOR r_username IN
      SELECT DISTINCT m[1]
      FROM regexp_matches(NEW.title || ' ' || NEW.content, '@([一-鿿\w]+)', 'g') AS m
    LOOP
      -- Check if mentioned user exists and is not the thread author
      SELECT id INTO r_profile_id FROM profiles WHERE username = r_username;
      IF r_profile_id IS NOT NULL AND (NEW.author_id IS NULL OR r_profile_id <> NEW.author_id) THEN
        INSERT INTO notifications (recipient_id, type, actor_id, thread_id, post_id, is_read, created_at)
        VALUES (r_profile_id, 'mention', NEW.author_id, NEW.id, NULL, false, NOW())
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_thread_published_notifications ON threads;
CREATE TRIGGER on_thread_published_notifications
AFTER INSERT OR UPDATE ON threads
FOR EACH ROW EXECUTE FUNCTION handle_thread_notifications();


-- 3. Trigger for automated post/reply notifications (Mentions and replies)
CREATE OR REPLACE FUNCTION handle_post_notifications()
RETURNS TRIGGER AS $$
DECLARE
  r_username TEXT;
  r_profile_id UUID;
  v_thread_author_id UUID;
  v_parent_author_id UUID;
  v_mentioned_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  -- Only trigger notifications when a post is published
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    -- A. Parse and create mention notifications
    FOR r_username IN
      SELECT DISTINCT m[1]
      FROM regexp_matches(NEW.content, '@([一-鿿\w]+)', 'g') AS m
    LOOP
      SELECT id INTO r_profile_id FROM profiles WHERE username = r_username;
      IF r_profile_id IS NOT NULL AND (NEW.author_id IS NULL OR r_profile_id <> NEW.author_id) THEN
        INSERT INTO notifications (recipient_id, type, actor_id, thread_id, post_id, is_read, created_at)
        VALUES (r_profile_id, 'mention', NEW.author_id, NEW.thread_id, NEW.id, false, NOW())
        ON CONFLICT DO NOTHING;
        
        -- Track mentioned IDs so we don't send duplicate reply notifications
        v_mentioned_ids := array_append(v_mentioned_ids, r_profile_id);
      END IF;
    END LOOP;

    -- B. Create reply notifications (notifying thread author and parent post author)
    -- Fetch thread author
    SELECT author_id INTO v_thread_author_id FROM threads WHERE id = NEW.thread_id;
    
    -- Fetch parent post author if it is a sub-reply
    IF NEW.parent_post_id IS NOT NULL THEN
      SELECT author_id INTO v_parent_author_id FROM posts WHERE id = NEW.parent_post_id;
    END IF;

    -- Case 1: Notify author of parent post if they are not the actor and were not already mentioned
    IF v_parent_author_id IS NOT NULL 
       AND (NEW.author_id IS NULL OR v_parent_author_id <> NEW.author_id)
       AND NOT (v_parent_author_id = ANY(v_mentioned_ids)) THEN
      INSERT INTO notifications (recipient_id, type, actor_id, thread_id, post_id, is_read, created_at)
      VALUES (v_parent_author_id, 'reply', NEW.author_id, NEW.thread_id, NEW.id, false, NOW())
      ON CONFLICT DO NOTHING;
    END IF;

    -- Case 2: Notify author of thread if they are not the actor, not already notified as parent author, and not mentioned
    IF v_thread_author_id IS NOT NULL 
       AND (NEW.author_id IS NULL OR v_thread_author_id <> NEW.author_id)
       AND (v_parent_author_id IS NULL OR v_thread_author_id <> v_parent_author_id)
       AND NOT (v_thread_author_id = ANY(v_mentioned_ids)) THEN
      INSERT INTO notifications (recipient_id, type, actor_id, thread_id, post_id, is_read, created_at)
      VALUES (v_thread_author_id, 'reply', NEW.author_id, NEW.thread_id, NEW.id, false, NOW())
      ON CONFLICT DO NOTHING;
    END IF;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_post_published_notifications ON posts;
CREATE TRIGGER on_post_published_notifications
AFTER INSERT OR UPDATE ON posts
FOR EACH ROW EXECUTE FUNCTION handle_post_notifications();
