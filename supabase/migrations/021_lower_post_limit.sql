-- Lower post content length constraint from 5 to 2 characters
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_content_length;
ALTER TABLE posts ADD CONSTRAINT posts_content_length CHECK (length(content) >= 2);
