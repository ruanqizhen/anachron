-- Unify frontend and backend character limit checks for threads and posts to at least 10 characters

-- 1. Update threads table constraint
ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_content_length;
ALTER TABLE threads ADD CONSTRAINT threads_content_length CHECK (length(content) >= 10) NOT VALID;

-- 2. Update posts table constraint
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_content_length;
ALTER TABLE posts ADD CONSTRAINT posts_content_length CHECK (length(content) >= 10) NOT VALID;
