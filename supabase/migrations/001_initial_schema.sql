-- ============================
-- Anachron: Initial Schema
-- PRD §8 Database Design
-- ============================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── profiles ───
CREATE TABLE profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT NOT NULL UNIQUE,
  avatar_url    TEXT,
  bio           TEXT DEFAULT '',
  is_ai_character BOOLEAN NOT NULL DEFAULT false,
  is_admin      BOOLEAN NOT NULL DEFAULT false,
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
  rival_character_ids  UUID[] NOT NULL DEFAULT '{}',
  preferred_boards     TEXT[] NOT NULL DEFAULT '{}',
  preferred_topics     TEXT[] NOT NULL DEFAULT '{}',
  preferred_user_ids   UUID[] NOT NULL DEFAULT '{}',
  model_provider       TEXT NOT NULL DEFAULT 'openai'
    CHECK (model_provider IN ('openai', 'anthropic', 'gemini')),
  model_name           TEXT NOT NULL DEFAULT 'gpt-4o',
  daily_reply_limit    INT NOT NULL DEFAULT 20,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── boards ───
CREATE TABLE boards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT NOT NULL DEFAULT '',
  era_tag       TEXT NOT NULL DEFAULT '',
  icon          TEXT NOT NULL DEFAULT '📌',
  display_order INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── threads ───
CREATE TABLE threads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id      UUID NOT NULL REFERENCES boards(id),
  author_id     UUID REFERENCES profiles(id),
  guest_id      UUID REFERENCES guest_sessions(id),
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'pending_review', 'rejected')),
  is_pinned     BOOLEAN NOT NULL DEFAULT false,
  view_count    INT NOT NULL DEFAULT 0,
  reply_count   INT NOT NULL DEFAULT 0,
  last_post_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at     TIMESTAMPTZ,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── posts ───
CREATE TABLE posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id       UUID NOT NULL REFERENCES threads(id),
  author_id       UUID REFERENCES profiles(id),
  guest_id        UUID REFERENCES guest_sessions(id),
  content         TEXT NOT NULL,
  parent_post_id  UUID REFERENCES posts(id),
  likes           INT NOT NULL DEFAULT 0,
  is_ai_post      BOOLEAN NOT NULL DEFAULT false,
  status          TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'pending_review', 'rejected')),
  edited_at       TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── likes ───
CREATE TABLE likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  guest_ip   INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id),
  UNIQUE (post_id, guest_ip),
  CONSTRAINT like_user_or_ip CHECK (
    (user_id IS NOT NULL AND guest_ip IS NULL) OR
    (user_id IS NULL AND guest_ip IS NOT NULL)
  )
);

-- ─── notifications ───
CREATE TABLE notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID NOT NULL REFERENCES profiles(id),
  type          TEXT NOT NULL CHECK (type IN ('mention', 'reply', 'like')),
  actor_id      UUID REFERENCES profiles(id),
  thread_id     UUID REFERENCES threads(id),
  post_id       UUID REFERENCES posts(id),
  is_read       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── ai_task_queue ───
CREATE TABLE ai_task_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_post_id UUID NOT NULL REFERENCES posts(id),
  thread_id       UUID NOT NULL REFERENCES threads(id),
  task_type       TEXT NOT NULL DEFAULT 'auto_reply'
    CHECK (task_type IN ('auto_reply', 'mention_reply')),
  priority        TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'high')),
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'dispatched', 'completed', 'failed')),
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
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'done', 'failed')),
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
  trigger_post_id  UUID NOT NULL REFERENCES posts(id),
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

-- ============================
-- Indexes
-- ============================

CREATE INDEX idx_threads_board_last_post
  ON threads(board_id, last_post_at DESC)
  WHERE deleted_at IS NULL AND status = 'published';

CREATE INDEX idx_posts_thread_created
  ON posts(thread_id, created_at ASC)
  WHERE deleted_at IS NULL AND status = 'published';

CREATE INDEX idx_notifications_recipient_unread
  ON notifications(recipient_id, is_read)
  WHERE is_read = false;

CREATE INDEX idx_daily_stats_char_date
  ON character_daily_stats(character_id, date);

CREATE INDEX idx_ai_response_queue_executable
  ON ai_response_queue(created_at ASC)
  WHERE status = 'pending';

CREATE INDEX idx_likes_post_id ON likes(post_id);

-- ============================
-- Triggers
-- ============================

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

-- ============================
-- RLS Policies
-- ============================

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- boards
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "boards_select" ON boards FOR SELECT USING (true);

-- threads
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "threads_select" ON threads FOR SELECT
  USING (status = 'published' OR auth.uid() = author_id);
CREATE POLICY "threads_insert" ON threads FOR INSERT
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY "threads_update" ON threads FOR UPDATE USING (auth.uid() = author_id);

-- posts
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_select" ON posts FOR SELECT
  USING (status = 'published' OR auth.uid() = author_id);
CREATE POLICY "posts_insert" ON posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts_update" ON posts FOR UPDATE USING (auth.uid() = author_id);

-- likes
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_select" ON likes FOR SELECT USING (true);
CREATE POLICY "likes_insert" ON likes FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "likes_delete" ON likes FOR DELETE USING (auth.uid() = user_id);

-- notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select" ON notifications FOR SELECT
  USING (auth.uid() = recipient_id);

-- ai_task_queue (Service Role only)
ALTER TABLE ai_task_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_queue_deny" ON ai_task_queue FOR SELECT USING (false);

-- ai_response_queue (Service Role only)
ALTER TABLE ai_response_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "response_queue_deny" ON ai_response_queue FOR SELECT USING (false);

-- ai_dispatch_log (Service Role only)
ALTER TABLE ai_dispatch_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dispatch_log_deny" ON ai_dispatch_log FOR SELECT USING (false);

-- blocked_ips (Service Role only)
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocked_ips_deny" ON blocked_ips FOR SELECT USING (false);

-- guest_sessions
ALTER TABLE guest_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guest_sessions_deny" ON guest_sessions FOR SELECT USING (false);

-- character_daily_stats
ALTER TABLE character_daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_stats_deny" ON character_daily_stats FOR SELECT USING (false);
