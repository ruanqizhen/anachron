-- ===================================================
-- Anachron: Unified Consolidated Database Schema
-- Consolidation: 001_initial_schema.sql
-- Contains latest schema, constraints, triggers, indexes, policies, and RPCs
-- ===================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ===================================================
-- 1. Tables
-- ===================================================

-- ─── profiles ───
CREATE TABLE profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT NOT NULL UNIQUE,
  avatar_url    TEXT,
  bio           TEXT DEFAULT '',
  is_ai_character BOOLEAN NOT NULL DEFAULT false,
  is_admin      BOOLEAN NOT NULL DEFAULT false,
  karma         INTEGER DEFAULT 0 NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── guest_sessions ───
CREATE TABLE guest_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT NOT NULL DEFAULT '游客',
  session_token TEXT NOT NULL UNIQUE,
  ip_address    INET NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── blocked_ips ───
CREATE TABLE blocked_ips (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address    INET NOT NULL UNIQUE,
  reason        TEXT,
  risk_score    INT NOT NULL DEFAULT 0,
  blocked_until TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── ai_characters ───
CREATE TABLE ai_characters (
  id                   UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  era                  TEXT NOT NULL DEFAULT '',
  tags                 TEXT[] NOT NULL DEFAULT '{}',
  birth_year           INT,
  death_year           INT,
  personality_prompt   TEXT NOT NULL DEFAULT '',
  comedy_notes         TEXT NOT NULL DEFAULT '',
  writing_style        TEXT NOT NULL DEFAULT '',
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── boards ───
CREATE TABLE boards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT NOT NULL DEFAULT '',
  era_tag       TEXT NOT NULL DEFAULT '',
  icon          TEXT NOT NULL DEFAULT '📌',
  display_order INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── threads ───
CREATE TABLE threads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id          UUID NOT NULL REFERENCES boards(id),
  author_id         UUID REFERENCES profiles(id),
  guest_id          UUID REFERENCES guest_sessions(id),
  title             TEXT NOT NULL CONSTRAINT threads_title_length CHECK (length(title) BETWEEN 2 AND 100),
  content           TEXT NOT NULL CONSTRAINT threads_content_length CHECK (length(content) >= 10) NOT VALID,
  status            TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'pending_review', 'rejected')),
  view_count        INT NOT NULL DEFAULT 0,
  reply_count       INT NOT NULL DEFAULT 0,
  like_count        INT NOT NULL DEFAULT 0,
  thread_like_count INT NOT NULL DEFAULT 0,
  pin_level         INT NOT NULL DEFAULT 0,
  is_locked         BOOLEAN NOT NULL DEFAULT false,
  is_featured       BOOLEAN NOT NULL DEFAULT false,
  last_post_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at         TIMESTAMPTZ,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── posts ───
CREATE TABLE posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id       UUID NOT NULL REFERENCES threads(id),
  author_id       UUID REFERENCES profiles(id),
  guest_id        UUID REFERENCES guest_sessions(id),
  content         TEXT NOT NULL CONSTRAINT posts_content_length CHECK (length(content) >= 10) NOT VALID,
  parent_post_id  UUID REFERENCES posts(id),
  likes           INT NOT NULL DEFAULT 0,
  is_ai_post      BOOLEAN NOT NULL DEFAULT false,
  status          TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'pending_review', 'rejected')),
  edited_at       TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── likes ───
CREATE TABLE likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  guest_id   UUID REFERENCES guest_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT like_user_or_guest CHECK (
    (user_id IS NOT NULL AND guest_id IS NULL) OR
    (user_id IS NULL AND guest_id IS NOT NULL)
  )
);

-- ─── thread_likes ───
CREATE TABLE thread_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  guest_id   UUID REFERENCES guest_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT thread_likes_user_or_guest CHECK (
    (user_id IS NOT NULL AND guest_id IS NULL) OR
    (user_id IS NULL AND guest_id IS NOT NULL)
  )
);

-- ─── notifications ───
CREATE TABLE notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID NOT NULL REFERENCES profiles(id),
  type          TEXT NOT NULL CHECK (type IN ('mention', 'reply', 'like', 'thread_update', 'new_thread')),
  actor_id      UUID REFERENCES profiles(id),
  thread_id     UUID REFERENCES threads(id),
  post_id       UUID REFERENCES posts(id),
  is_read       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── ai_task_queue ───
CREATE TABLE ai_task_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_post_id UUID REFERENCES posts(id),
  thread_id       UUID NOT NULL REFERENCES threads(id),
  task_type       TEXT NOT NULL DEFAULT 'auto_reply' CHECK (task_type IN ('auto_reply', 'mention_reply')),
  priority        TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'dispatched', 'dispatched_null', 'skipped', 'completed', 'failed')),
  mentioned_character_ids TEXT[] DEFAULT '{}',
  execute_after   TIMESTAMPTZ NOT NULL DEFAULT now(),
  dispatched_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── ai_response_queue ───
CREATE TABLE ai_response_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID REFERENCES ai_task_queue(id),
  character_id    UUID NOT NULL REFERENCES ai_characters(id),
  thread_id       UUID NOT NULL REFERENCES threads(id),
  trigger_post_id UUID REFERENCES posts(id),
  execute_after   TIMESTAMPTZ DEFAULT now(),
  dispatch_reason TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  error_message   TEXT,
  retry_count     INT NOT NULL DEFAULT 0,
  result_post_id  UUID REFERENCES posts(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ
);

-- ─── ai_dispatch_log ───
CREATE TABLE ai_dispatch_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id          UUID REFERENCES ai_task_queue(id),
  trigger_post_id  UUID REFERENCES posts(id),
  thread_id        UUID NOT NULL REFERENCES threads(id),
  dispatched       BOOLEAN NOT NULL,
  character_id     UUID REFERENCES ai_characters(id),
  reason           TEXT,
  cooldown_blocked BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── character_daily_stats ───
CREATE TABLE character_daily_stats (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES ai_characters(id),
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  reply_count  INT NOT NULL DEFAULT 0,
  UNIQUE (character_id, date)
);

-- ─── reports ───
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('thread', 'post')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ─── thread_follows ───
CREATE TABLE thread_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, thread_id)
);

-- ─── account_follows ───
CREATE TABLE account_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT cannot_follow_self CHECK (follower_id <> following_id),
  UNIQUE(follower_id, following_id)
);

-- ===================================================
-- 2. Indexes
-- ===================================================

CREATE INDEX idx_threads_board_last_post ON threads(board_id, last_post_at DESC) WHERE deleted_at IS NULL AND status = 'published';
CREATE INDEX idx_posts_thread_created ON posts(thread_id, created_at ASC) WHERE deleted_at IS NULL AND status = 'published';
CREATE INDEX idx_notifications_recipient_unread ON notifications(recipient_id, is_read) WHERE is_read = false;
CREATE INDEX idx_daily_stats_char_date ON character_daily_stats(character_id, date);
CREATE INDEX idx_ai_response_queue_executable ON ai_response_queue(created_at ASC) WHERE status = 'pending';
CREATE INDEX idx_likes_post_id ON likes(post_id);

-- Trigram Indexes for Substring Matching
CREATE INDEX IF NOT EXISTS idx_threads_title_trgm ON threads USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_threads_content_trgm ON threads USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_posts_content_trgm ON posts USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm ON profiles USING gin (username gin_trgm_ops);

-- Unique Partial Indexes for Likes and Thread Likes
CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_post_user ON likes(post_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_post_guest ON likes(post_id, guest_id) WHERE guest_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_thread_likes_post_user ON thread_likes(thread_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_thread_likes_post_guest ON thread_likes(thread_id, guest_id) WHERE guest_id IS NOT NULL;

-- ===================================================
-- 3. Base Trigger Functions & Triggers
-- ===================================================

-- Update thread stats on new post
CREATE OR REPLACE FUNCTION update_thread_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE threads SET
    reply_count = reply_count + 1,
    last_post_at = NEW.created_at
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_post_insert
AFTER INSERT ON posts
FOR EACH ROW EXECUTE FUNCTION update_thread_stats();

-- Update post like count
CREATE OR REPLACE FUNCTION update_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes = likes + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET likes = likes - 1 WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_like_change
AFTER INSERT OR DELETE ON likes
FOR EACH ROW EXECUTE FUNCTION update_post_like_count();

-- Trigger to keep thread_like_count in sync
CREATE OR REPLACE FUNCTION update_thread_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE threads SET thread_like_count = thread_like_count + 1 WHERE id = NEW.thread_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE threads SET thread_like_count = thread_like_count - 1 WHERE id = OLD.thread_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_thread_like_change
AFTER INSERT OR DELETE ON thread_likes
FOR EACH ROW EXECUTE FUNCTION update_thread_like_count();

-- ===================================================
-- 4. RLS & Security Policies
-- ===================================================

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- guest_sessions
ALTER TABLE guest_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guest_sessions_select" ON guest_sessions FOR SELECT USING (true);

-- blocked_ips
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocked_ips_deny" ON blocked_ips FOR SELECT USING (false);

-- ai_characters
ALTER TABLE ai_characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_characters_select" ON ai_characters FOR SELECT USING (true);

-- boards
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "boards_select" ON boards FOR SELECT USING (true);

-- threads
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "threads_select" ON threads FOR SELECT USING (status = 'published' OR auth.uid() = author_id);
CREATE POLICY "threads_insert" ON threads FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "threads_update" ON threads FOR UPDATE USING (auth.uid() = author_id);

-- posts
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_select" ON posts FOR SELECT USING (status = 'published' OR auth.uid() = author_id);
CREATE POLICY "posts_insert" ON posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts_update" ON posts FOR UPDATE USING (auth.uid() = author_id);

-- likes
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_select" ON likes FOR SELECT USING (true);
CREATE POLICY "likes_insert" ON likes FOR INSERT WITH CHECK ((auth.uid() = user_id) OR (guest_id IS NOT NULL));
CREATE POLICY "likes_delete" ON likes FOR DELETE USING ((auth.uid() = user_id) OR (guest_id IS NOT NULL));

-- thread_likes
ALTER TABLE thread_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "thread_likes_select" ON thread_likes FOR SELECT USING (true);
CREATE POLICY "thread_likes_insert" ON thread_likes FOR INSERT WITH CHECK ((auth.uid() = user_id) OR (guest_id IS NOT NULL));
CREATE POLICY "thread_likes_delete" ON thread_likes FOR DELETE USING ((auth.uid() = user_id) OR (guest_id IS NOT NULL));

-- notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);
CREATE POLICY "notifications_delete" ON notifications FOR DELETE USING (auth.uid() = recipient_id);

-- thread_follows
ALTER TABLE thread_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own follows" ON thread_follows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own follows" ON thread_follows FOR ALL USING (auth.uid() = user_id);

-- account_follows
ALTER TABLE account_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can see follow counts" ON account_follows FOR SELECT USING (true);
CREATE POLICY "Users can manage their own follows" ON account_follows FOR ALL USING (auth.uid() = follower_id);

-- reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can create reports" ON reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admins can view all reports" ON reports FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "Admins can update reports" ON reports FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- service role only tables
ALTER TABLE ai_task_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_queue_deny" ON ai_task_queue FOR SELECT USING (false);

ALTER TABLE ai_response_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "response_queue_deny" ON ai_response_queue FOR SELECT USING (false);

ALTER TABLE ai_dispatch_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dispatch_log_deny" ON ai_dispatch_log FOR SELECT USING (false);

ALTER TABLE character_daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_stats_deny" ON character_daily_stats FOR SELECT USING (false);

-- ===================================================
-- 5. Trigger Functions for Advanced System Logic
-- ===================================================

-- Helper function for admin access check
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

-- Trigger function to protect profiles is_admin & is_ai_character flags
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

-- Trigger for automated thread notifications (Mentions in new/published threads)
CREATE OR REPLACE FUNCTION handle_thread_notifications()
RETURNS TRIGGER AS $$
DECLARE
  r_username TEXT;
  r_profile_id UUID;
BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    FOR r_username IN
      SELECT DISTINCT m[1]
      FROM regexp_matches(NEW.title || ' ' || NEW.content, '@([一-鿿\w]+)', 'g') AS m
    LOOP
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

-- Trigger for automated post/reply notifications (Mentions and replies)
CREATE OR REPLACE FUNCTION handle_post_notifications()
RETURNS TRIGGER AS $$
DECLARE
  r_username TEXT;
  r_profile_id UUID;
  v_thread_author_id UUID;
  v_parent_author_id UUID;
  v_mentioned_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    -- Mentions
    FOR r_username IN
      SELECT DISTINCT m[1]
      FROM regexp_matches(NEW.content, '@([一-鿿\w]+)', 'g') AS m
    LOOP
      SELECT id INTO r_profile_id FROM profiles WHERE username = r_username;
      IF r_profile_id IS NOT NULL AND (NEW.author_id IS NULL OR r_profile_id <> NEW.author_id) THEN
        INSERT INTO notifications (recipient_id, type, actor_id, thread_id, post_id, is_read, created_at)
        VALUES (r_profile_id, 'mention', NEW.author_id, NEW.thread_id, NEW.id, false, NOW())
        ON CONFLICT DO NOTHING;
        
        v_mentioned_ids := array_append(v_mentioned_ids, r_profile_id);
      END IF;
    END LOOP;

    -- Replies
    SELECT author_id INTO v_thread_author_id FROM threads WHERE id = NEW.thread_id;
    
    IF NEW.parent_post_id IS NOT NULL THEN
      SELECT author_id INTO v_parent_author_id FROM posts WHERE id = NEW.parent_post_id;
    END IF;

    -- Notify parent post author
    IF v_parent_author_id IS NOT NULL 
       AND (NEW.author_id IS NULL OR v_parent_author_id <> NEW.author_id)
       AND NOT (v_parent_author_id = ANY(v_mentioned_ids)) THEN
      INSERT INTO notifications (recipient_id, type, actor_id, thread_id, post_id, is_read, created_at)
      VALUES (v_parent_author_id, 'reply', NEW.author_id, NEW.thread_id, NEW.id, false, NOW())
      ON CONFLICT DO NOTHING;
    END IF;

    -- Notify thread author
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

-- Notification Logic for Thread Follows
CREATE OR REPLACE FUNCTION notify_thread_followers()
RETURNS TRIGGER AS $$
DECLARE
    v_thread_author_id UUID;
BEGIN
    SELECT author_id INTO v_thread_author_id FROM threads WHERE id = NEW.thread_id;

    INSERT INTO notifications (recipient_id, type, actor_id, thread_id, post_id)
    SELECT user_id, 'thread_update', NEW.author_id, NEW.thread_id, NEW.id
    FROM thread_follows
    WHERE thread_id = NEW.thread_id
      AND user_id <> NEW.author_id
      AND user_id <> v_thread_author_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_post_notify_followers ON posts;
CREATE TRIGGER on_new_post_notify_followers
    AFTER INSERT ON posts
    FOR EACH ROW
    WHEN (NEW.status = 'published')
    EXECUTE FUNCTION notify_thread_followers();

-- Notification Logic for Account Follows
CREATE OR REPLACE FUNCTION notify_account_followers()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notifications (recipient_id, type, actor_id, thread_id)
    SELECT follower_id, 'new_thread', NEW.author_id, NEW.id
    FROM account_follows
    WHERE following_id = NEW.author_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_thread_notify_followers ON threads;
CREATE TRIGGER on_new_thread_notify_followers
    AFTER INSERT ON threads
    FOR EACH ROW
    WHEN (NEW.status = 'published')
    EXECUTE FUNCTION notify_account_followers();

-- Auto-follow thread on reply
CREATE OR REPLACE FUNCTION auto_follow_thread_on_reply()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.author_id IS NOT NULL THEN
        INSERT INTO thread_follows (user_id, thread_id)
        VALUES (NEW.author_id, NEW.thread_id)
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_post_auto_follow ON posts;
CREATE TRIGGER on_post_auto_follow
    AFTER INSERT ON posts
    FOR EACH ROW
    EXECUTE FUNCTION auto_follow_thread_on_reply();

-- ===================================================
-- 6. Core & Helper RPC Functions
-- ===================================================

-- Create Guest Session RPC
CREATE OR REPLACE FUNCTION create_guest_rpc(
  p_username TEXT,
  p_ip TEXT DEFAULT NULL
) RETURNS SETOF guest_sessions AS $$
DECLARE
  v_id UUID := gen_random_uuid();
  v_session_token TEXT := gen_random_uuid()::text;
  v_ip INET;
BEGIN
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

-- Create Thread RPC (Hardened with Rate Limits & Privileges check)
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
  IF p_author_id IS NOT NULL THEN
    SELECT (is_admin = true OR is_ai_character = true)
    INTO v_is_privileged
    FROM profiles
    WHERE id = p_author_id;
    
    IF v_is_privileged THEN
      v_status := 'published';
    END IF;
  END IF;

  IF NOT COALESCE(v_is_privileged, false) THEN
    IF p_author_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM threads
        WHERE author_id = p_author_id
          AND created_at > now() - INTERVAL '1 minute'
      ) THEN
        RAISE EXCEPTION '发帖过于频繁，请等待1分钟后再试。';
      END IF;
    ELSIF p_guest_id IS NOT NULL THEN
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

-- Create Post (Reply) RPC
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
  IF p_author_id IS NOT NULL THEN
    SELECT (is_admin = true OR is_ai_character = true)
    INTO v_is_privileged
    FROM profiles
    WHERE id = p_author_id;
    
    IF v_is_privileged THEN
      v_status := 'published';
    END IF;
  END IF;

  IF NOT COALESCE(v_is_privileged, false) THEN
    IF p_author_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM posts
        WHERE author_id = p_author_id
          AND created_at > now() - INTERVAL '10 seconds'
      ) THEN
        RAISE EXCEPTION '回帖过于频繁，请等待10秒后再试。';
      END IF;
    ELSIF p_guest_id IS NOT NULL THEN
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

-- Increment Daily Stats helper
CREATE OR REPLACE FUNCTION increment_daily_stats(
  p_character_id UUID,
  p_date DATE
) RETURNS void AS $$
BEGIN
  INSERT INTO character_daily_stats (character_id, date, reply_count)
  VALUES (p_character_id, p_date, 1)
  ON CONFLICT (character_id, date)
  DO UPDATE SET reply_count = character_daily_stats.reply_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Query AI thinking status helper
CREATE OR REPLACE FUNCTION get_ai_thinking_status(p_thread_id UUID)
RETURNS TABLE(character_name TEXT, status TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT p.username, rq.status
  FROM ai_response_queue rq
  JOIN ai_characters ac ON ac.id = rq.character_id
  JOIN profiles p ON p.id = ac.id
  WHERE rq.thread_id = p_thread_id
    AND rq.status IN ('pending', 'processing')
  ORDER BY rq.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Full-text Search with Pagination RPC
CREATE OR REPLACE FUNCTION search_forum(search_term TEXT, p_limit INT DEFAULT 20, p_offset INT DEFAULT 0)
RETURNS SETOF threads AS $$
BEGIN
  RETURN QUERY
  SELECT t.*
  FROM threads t
  WHERE t.id IN (
    -- Match threads directly
    SELECT th.id
    FROM threads th
    LEFT JOIN profiles p ON th.author_id = p.id
    LEFT JOIN guest_sessions g ON th.guest_id = g.id
    WHERE th.status = 'published' AND th.deleted_at IS NULL
      AND (
        th.title ILIKE '%' || search_term || '%'
        OR th.content ILIKE '%' || search_term || '%'
        OR p.username ILIKE '%' || search_term || '%'
        OR g.username ILIKE '%' || search_term || '%'
      )
    
    UNION
    
    -- Match via posts
    SELECT po.thread_id
    FROM posts po
    LEFT JOIN profiles p ON po.author_id = p.id
    LEFT JOIN guest_sessions g ON po.guest_id = g.id
    WHERE po.status = 'published' AND po.deleted_at IS NULL
      AND (
        po.content ILIKE '%' || search_term || '%'
        OR p.username ILIKE '%' || search_term || '%'
        OR g.username ILIKE '%' || search_term || '%'
      )
  )
  AND t.status = 'published' AND t.deleted_at IS NULL
  ORDER BY t.last_post_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Toggle thread follow RPC
CREATE OR REPLACE FUNCTION toggle_thread_follow(p_thread_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
    
    SELECT EXISTS (SELECT 1 FROM thread_follows WHERE user_id = auth.uid() AND thread_id = p_thread_id) INTO v_exists;
    
    IF v_exists THEN
        DELETE FROM thread_follows WHERE user_id = auth.uid() AND thread_id = p_thread_id;
        RETURN FALSE;
    ELSE
        INSERT INTO thread_follows (user_id, thread_id) VALUES (auth.uid(), p_thread_id);
        RETURN TRUE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Toggle account follow RPC
CREATE OR REPLACE FUNCTION toggle_account_follow(p_following_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
    IF auth.uid() = p_following_id THEN RETURN FALSE; END IF;
    
    SELECT EXISTS (SELECT 1 FROM account_follows WHERE follower_id = auth.uid() AND following_id = p_following_id) INTO v_exists;
    
    IF v_exists THEN
        DELETE FROM account_follows WHERE follower_id = auth.uid() AND following_id = p_following_id;
        RETURN FALSE;
    ELSE
        INSERT INTO account_follows (follower_id, following_id) VALUES (auth.uid(), p_following_id);
        RETURN TRUE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin check author type RPC
CREATE OR REPLACE FUNCTION admin_check_author_type(p_username TEXT)
RETURNS TABLE (
  is_ai BOOLEAN,
  is_virtual BOOLEAN,
  profile_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.is_ai_character AS is_ai,
    (NOT p.is_ai_character AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)) AS is_virtual,
    p.id AS profile_id
  FROM profiles p
  WHERE p.username = p_username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================
-- 7. Administration RPC Functions (Protected)
-- ===================================================

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

-- ===================================================
-- 8. Storage Buckets & Policies
-- ===================================================

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies on storage.objects
CREATE POLICY "Anyone can view post images" ON storage.objects FOR SELECT USING (bucket_id = 'post-images');
CREATE POLICY "Authenticated users can upload post images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'post-images' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update their own post images" ON storage.objects FOR UPDATE USING (bucket_id = 'post-images' AND auth.uid() = owner);
CREATE POLICY "Users can delete their own post images" ON storage.objects FOR DELETE USING (bucket_id = 'post-images' AND auth.uid() = owner);
