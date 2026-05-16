-- Update the trigger function to use the correct notification type
CREATE OR REPLACE FUNCTION notify_thread_followers()
RETURNS TRIGGER AS $$
DECLARE
    v_thread_author_id UUID;
BEGIN
    -- Get the thread author
    SELECT author_id INTO v_thread_author_id FROM threads WHERE id = NEW.thread_id;

    INSERT INTO notifications (recipient_id, type, actor_id, thread_id, post_id)
    SELECT user_id, 'thread_update', NEW.author_id, NEW.thread_id, NEW.id
    FROM thread_follows
    WHERE thread_id = NEW.thread_id
      AND user_id <> NEW.author_id -- Don't notify the person who just posted
      AND user_id <> v_thread_author_id; -- Don't notify thread author (they get a separate 'reply' notification)
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
