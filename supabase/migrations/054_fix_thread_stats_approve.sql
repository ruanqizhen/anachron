-- 054: Handle pending_review -> published transition for thread stats
-- Fixes case where moderation approve never bumps reply_count/last_post_at

CREATE OR REPLACE FUNCTION update_thread_stats_on_approve()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'published' AND NEW.status = 'published' AND NEW.deleted_at IS NULL THEN
    UPDATE threads SET
      reply_count = reply_count + 1,
      last_post_at = GREATEST(last_post_at, NEW.created_at)
    WHERE id = NEW.thread_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_post_approve ON posts;
CREATE TRIGGER on_post_approve
AFTER UPDATE OF status ON posts
FOR EACH ROW EXECUTE FUNCTION update_thread_stats_on_approve();
