-- Update the notifications type check constraint to include new notification types
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('mention', 'reply', 'like', 'thread_update', 'new_thread'));
