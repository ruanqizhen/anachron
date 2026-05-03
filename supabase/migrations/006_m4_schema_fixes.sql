-- Schema fixes for Milestone 4 AI character system.
-- Adds missing columns to ai_task_queue and stats helper.

-- Add mentioned_character_ids column (was in PRD but missing from initial migration)
ALTER TABLE ai_task_queue ADD COLUMN IF NOT EXISTS mentioned_character_ids UUID[] DEFAULT '{}';

-- Update status check to include all states used by dispatcher
ALTER TABLE ai_task_queue DROP CONSTRAINT IF EXISTS ai_task_queue_status_check;
ALTER TABLE ai_task_queue ADD CONSTRAINT ai_task_queue_status_check
  CHECK (status IN ('pending', 'processing', 'dispatched', 'dispatched_null', 'skipped', 'completed', 'failed'));

-- Update ai_response_queue status check
ALTER TABLE ai_response_queue DROP CONSTRAINT IF EXISTS ai_response_queue_status_check;
ALTER TABLE ai_response_queue ADD CONSTRAINT ai_response_queue_status_check
  CHECK (status IN ('pending', 'processing', 'done', 'failed'));

-- Helper: increment daily stats counter (used by character-responder)
CREATE OR REPLACE FUNCTION increment_daily_stats(
  p_character_id UUID,
  p_date DATE
) RETURNS void AS $$
BEGIN
  INSERT INTO character_daily_stats (character_id, date, reply_count)
  VALUES (p_character_id, p_date, 1)
  ON CONFLICT (character_id, date)
  DO UPDATE SET reply_count = character_daily_stats.reply_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Query AI thinking status for a thread (for the frontend indicator)
CREATE OR REPLACE FUNCTION get_ai_thinking_status(p_thread_id UUID)
RETURNS TABLE(character_name TEXT, status TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT p.username, rq.status
  FROM ai_response_queue rq
  JOIN ai_characters ac ON ac.id = rq.character_id
  JOIN profiles p ON p.id = ac.id
  WHERE rq.thread_id = p_thread_id
    AND rq.status IN ('pending', 'processing')
  ORDER BY rq.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
