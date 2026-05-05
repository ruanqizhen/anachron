-- ============================
-- Anachron: Search Pagination
-- Migration: 018_search_pagination
-- ============================

CREATE OR REPLACE FUNCTION search_forum(search_term TEXT, p_limit INT DEFAULT 20, p_offset INT DEFAULT 0)
RETURNS SETOF threads AS $$
BEGIN
  RETURN QUERY
  SELECT t.*
  FROM threads t
  WHERE t.id IN (
    -- Match threads directly
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
    
    -- Match via posts
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
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
