-- Add guest_id support to likes and thread_likes for guest liking

-- 1. likes table: add guest_id, drop IP-based tracking
ALTER TABLE likes DROP CONSTRAINT IF EXISTS like_user_or_ip;
ALTER TABLE likes DROP CONSTRAINT IF EXISTS likes_post_id_guest_ip_key;
ALTER TABLE likes ADD COLUMN IF NOT EXISTS guest_id UUID;

-- Make user_id nullable (guests won't have it)
ALTER TABLE likes ALTER COLUMN user_id DROP NOT NULL;

-- New constraint: either user_id or guest_id
ALTER TABLE likes DROP CONSTRAINT IF EXISTS like_user_or_guest;
ALTER TABLE likes ADD CONSTRAINT like_user_or_guest CHECK (
  (user_id IS NOT NULL AND guest_id IS NULL) OR
  (user_id IS NULL AND guest_id IS NOT NULL)
);

-- Unique per post per user/guest (partial indexes handle NULLs safely)
DROP INDEX IF EXISTS idx_likes_post_user;
DROP INDEX IF EXISTS idx_likes_post_guest;
CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_post_user ON likes(post_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_post_guest ON likes(post_id, guest_id) WHERE guest_id IS NOT NULL;

-- Drop the old unique constraints
ALTER TABLE likes DROP CONSTRAINT IF EXISTS likes_post_id_user_id_key;
ALTER TABLE likes DROP CONSTRAINT IF EXISTS likes_post_id_guest_ip_key;

-- Drop guest_ip column
ALTER TABLE likes DROP COLUMN IF EXISTS guest_ip;

-- 2. RLS for likes
DROP POLICY IF EXISTS "likes_insert" ON likes;
CREATE POLICY "likes_insert" ON likes FOR INSERT WITH CHECK (
  (auth.uid() = user_id) OR (guest_id IS NOT NULL)
);
DROP POLICY IF EXISTS "likes_delete" ON likes;
CREATE POLICY "likes_delete" ON likes FOR DELETE USING (
  (auth.uid() = user_id) OR (guest_id IS NOT NULL)
);

-- 3. thread_likes table: add guest_id
ALTER TABLE thread_likes ADD COLUMN IF NOT EXISTS guest_id UUID;
ALTER TABLE thread_likes ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE thread_likes DROP CONSTRAINT IF EXISTS thread_likes_user_or_guest;
ALTER TABLE thread_likes ADD CONSTRAINT thread_likes_user_or_guest CHECK (
  (user_id IS NOT NULL AND guest_id IS NULL) OR
  (user_id IS NULL AND guest_id IS NOT NULL)
);

-- Replace the old UNIQUE constraint with partial indexes
ALTER TABLE thread_likes DROP CONSTRAINT IF EXISTS thread_likes_thread_id_user_id_key;
DROP INDEX IF EXISTS idx_thread_likes_thread_user;
DROP INDEX IF EXISTS idx_thread_likes_post_user;
DROP INDEX IF EXISTS idx_thread_likes_post_guest;
CREATE UNIQUE INDEX IF NOT EXISTS idx_thread_likes_post_user ON thread_likes(thread_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_thread_likes_post_guest ON thread_likes(thread_id, guest_id) WHERE guest_id IS NOT NULL;

-- 4. RLS for thread_likes
DROP POLICY IF EXISTS "thread_likes_insert" ON thread_likes;
CREATE POLICY "thread_likes_insert" ON thread_likes FOR INSERT WITH CHECK (
  (auth.uid() = user_id) OR (guest_id IS NOT NULL)
);
DROP POLICY IF EXISTS "thread_likes_delete" ON thread_likes;
CREATE POLICY "thread_likes_delete" ON thread_likes FOR DELETE USING (
  (auth.uid() = user_id) OR (guest_id IS NOT NULL)
);
