-- Migration 023: Make ai_task_queue.trigger_post_id nullable
-- Rationale: Thread-level AI tasks (created when a new thread is posted)
-- have no specific "trigger post" — the trigger is the thread itself.
-- The original NOT NULL constraint forced a workaround of creating a synthetic
-- post, which incorrectly incremented reply_count. Making the column nullable
-- cleanly supports both thread-level tasks (trigger_post_id IS NULL) and
-- reply-level tasks (trigger_post_id IS NOT NULL).

ALTER TABLE ai_task_queue
  ALTER COLUMN trigger_post_id DROP NOT NULL;

-- Also make ai_dispatch_log consistent (it references the same concept)
ALTER TABLE ai_dispatch_log
  ALTER COLUMN trigger_post_id DROP NOT NULL;
