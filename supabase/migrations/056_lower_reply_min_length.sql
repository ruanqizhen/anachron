-- Lower reply (posts) minimum content length from 10 to 2 characters.
-- Threads keep their own threads_content_length (>= 10) constraint unchanged.
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_content_length;
ALTER TABLE posts ADD CONSTRAINT posts_content_length CHECK (length(content) >= 2) NOT VALID;
