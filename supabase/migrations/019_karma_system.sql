-- ============================
-- Anachron: Gamification Karma System
-- Migration: 019_karma_system
-- ============================

-- Add karma column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS karma INTEGER DEFAULT 0 NOT NULL;

-- Create function to update karma when a like is added or removed
CREATE OR REPLACE FUNCTION update_author_karma()
RETURNS TRIGGER AS $$
DECLARE
  v_author_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Get author of the post being liked
    SELECT author_id INTO v_author_id FROM posts WHERE id = NEW.post_id;
    
    -- Increment karma if author is known (and it's not a self-like, although we allow self-like for simplicity right now)
    IF v_author_id IS NOT NULL THEN
      UPDATE profiles SET karma = karma + 1 WHERE id = v_author_id;
    END IF;
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Get author of the post having like removed
    SELECT author_id INTO v_author_id FROM posts WHERE id = OLD.post_id;
    
    IF v_author_id IS NOT NULL THEN
      UPDATE profiles SET karma = karma - 1 WHERE id = v_author_id;
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on likes table
DROP TRIGGER IF EXISTS trigger_update_karma ON likes;
CREATE TRIGGER trigger_update_karma
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW
  EXECUTE FUNCTION update_author_karma();
