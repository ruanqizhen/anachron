-- 050: Fix like_count deprecation — single source of truth is thread_like_count

-- Ensure trigger for thread_like_count exists (from initial schema)
-- on_thread_like_change should already exist, but verify via comment
COMMENT ON COLUMN threads.like_count IS 'Deprecated: use thread_like_count. Kept for backwards compat, not updated by triggers.';
COMMENT ON COLUMN threads.thread_like_count IS 'Current source of truth for thread-level likes via thread_likes table and on_thread_like_change trigger.';
