-- Migration 024: Add thread_likes table for per-user thread likes
-- The existing threads.like_count column tracks post-level likes via trigger.
-- This table tracks explicit thread-level likes (the ♥ / 点赞 button in PostCard).

CREATE TABLE IF NOT EXISTS thread_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (thread_id, user_id)
);

ALTER TABLE thread_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "thread_likes_select" ON thread_likes FOR SELECT USING (true);
CREATE POLICY "thread_likes_insert" ON thread_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "thread_likes_delete" ON thread_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Add a separate thread_like_count column so it doesn't conflict with
-- the existing like_count (which aggregates post likes).
ALTER TABLE threads ADD COLUMN IF NOT EXISTS thread_like_count INT NOT NULL DEFAULT 0;

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

CREATE INDEX IF NOT EXISTS idx_thread_likes_thread_user ON thread_likes(thread_id, user_id);
