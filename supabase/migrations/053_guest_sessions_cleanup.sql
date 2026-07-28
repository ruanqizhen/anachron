-- 053: guest_sessions expiration and cleanup

-- Add index for TTL queries if not exists
CREATE INDEX IF NOT EXISTS idx_guest_sessions_created_at ON guest_sessions(created_at);

-- Cleanup function: delete guest sessions older than 30 days not referenced by any thread/post
CREATE OR REPLACE FUNCTION cleanup_expired_guest_sessions()
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM guest_sessions
  WHERE created_at < now() - interval '30 days'
    AND id NOT IN (
      SELECT guest_id FROM threads WHERE guest_id IS NOT NULL
      UNION
      SELECT guest_id FROM posts WHERE guest_id IS NOT NULL
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: pg_cron job is optional. Since pg_cron is already enabled via 040_daily_cron.sql,
-- you can add: SELECT cron.schedule('cleanup-guests', '0 3 * * *', 'SELECT cleanup_expired_guest_sessions()');
-- Not auto-scheduled here to avoid conflict if pg_cron not enabled in local env.
