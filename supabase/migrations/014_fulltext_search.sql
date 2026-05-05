-- Enable pg_trgm extension for Chinese substring matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN indexes for fast ILIKE searches
CREATE INDEX IF NOT EXISTS idx_threads_title_trgm ON threads USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_threads_content_trgm ON threads USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_posts_content_trgm ON posts USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm ON profiles USING gin (username gin_trgm_ops);

-- Create RPC for full-text search
CREATE OR REPLACE FUNCTION search_forum(search_term TEXT)
RETURNS SETOF threads AS $$
BEGIN
  RETURN QUERY
  SELECT t.*
  FROM threads t
  WHERE t.id IN (
    -- Match threads directly (title, content, or author username)
    SELECT th.id
    FROM threads th
    LEFT JOIN profiles p ON th.author_id = p.id
    LEFT JOIN guest_sessions g ON th.guest_id = g.id
    WHERE th.status = 'published' AND th.deleted_at IS NULL
      AND (
        th.title ILIKE '%' || search_term || '%'
        OR th.content ILIKE '%' || search_term || '%'
        OR p.username ILIKE '%' || search_term || '%'
        OR g.username ILIKE '%' || search_term || '%'
      )
    
    UNION
    
    -- Match via posts (content or author username)
    SELECT po.thread_id
    FROM posts po
    LEFT JOIN profiles p ON po.author_id = p.id
    LEFT JOIN guest_sessions g ON po.guest_id = g.id
    WHERE po.status = 'published' AND po.deleted_at IS NULL
      AND (
        po.content ILIKE '%' || search_term || '%'
        OR p.username ILIKE '%' || search_term || '%'
        OR g.username ILIKE '%' || search_term || '%'
      )
  )
  AND t.status = 'published' AND t.deleted_at IS NULL
  ORDER BY t.last_post_at DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
