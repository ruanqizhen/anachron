-- 051: Fix update_thread_stats to ignore non-published posts
-- Previously, pending_review posts would bump reply_count and last_post_at, allowing hidden posts to boost ranking.

CREATE OR REPLACE FUNCTION update_thread_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != 'published' THEN
    RETURN NEW;
  END IF;
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  UPDATE threads SET
    reply_count = reply_count + 1,
    last_post_at = GREATEST(last_post_at, NEW.created_at)
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger to ensure it uses updated function (idempotent)
DROP TRIGGER IF EXISTS on_post_insert ON posts;
CREATE TRIGGER on_post_insert
AFTER INSERT ON posts
FOR EACH ROW EXECUTE FUNCTION update_thread_stats();
