-- Add thread-level like count (sum of all post likes)
ALTER TABLE threads ADD COLUMN IF NOT EXISTS like_count INT NOT NULL DEFAULT 0;

-- Update trigger to also update thread's like_count when post likes change
CREATE OR REPLACE FUNCTION update_post_and_thread_likes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes = likes + 1 WHERE id = NEW.post_id;
    UPDATE threads SET like_count = like_count + 1 WHERE id = (SELECT thread_id FROM posts WHERE id = NEW.post_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET likes = likes - 1 WHERE id = OLD.post_id;
    UPDATE threads SET like_count = like_count - 1 WHERE id = (SELECT thread_id FROM posts WHERE id = OLD.post_id);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_like_change ON likes;
CREATE TRIGGER on_like_change
AFTER INSERT OR DELETE ON likes
FOR EACH ROW EXECUTE FUNCTION update_post_and_thread_likes();
