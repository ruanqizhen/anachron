-- ─── Thread Follows ───
CREATE TABLE IF NOT EXISTS thread_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, thread_id)
);

-- ─── Account Follows ───
CREATE TABLE IF NOT EXISTS account_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT cannot_follow_self CHECK (follower_id <> following_id),
    UNIQUE(follower_id, following_id)
);

-- ─── Enable RLS ───
ALTER TABLE thread_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_follows ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ───
CREATE POLICY "Users can view their own follows" ON thread_follows
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own follows" ON thread_follows
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can see follow counts" ON account_follows
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their own follows" ON account_follows
    FOR ALL USING (auth.uid() = follower_id);

-- ─── Notification Logic for Thread Follows ───
-- When a new post is created, notify everyone following that thread (except the author)
CREATE OR REPLACE FUNCTION notify_thread_followers()
RETURNS TRIGGER AS $$
DECLARE
    v_thread_author_id UUID;
BEGIN
    -- Get the thread author (already handled by existing reply notification, so we only need followers)
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

CREATE TRIGGER on_new_post_notify_followers
    AFTER INSERT ON posts
    FOR EACH ROW
    WHEN (NEW.status = 'published')
    EXECUTE FUNCTION notify_thread_followers();

-- ─── Notification Logic for Account Follows ───
-- When a new thread is created, notify everyone following the author
CREATE OR REPLACE FUNCTION notify_account_followers()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notifications (recipient_id, type, actor_id, thread_id)
    SELECT follower_id, 'new_thread', NEW.author_id, NEW.id
    FROM account_follows
    WHERE following_id = NEW.author_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_thread_notify_followers
    AFTER INSERT ON threads
    FOR EACH ROW
    WHEN (NEW.status = 'published')
    EXECUTE FUNCTION notify_account_followers();

-- ─── Auto-follow thread on reply ───
CREATE OR REPLACE FUNCTION auto_follow_thread_on_reply()
RETURNS TRIGGER AS $$
BEGIN
    -- Only for registered users
    IF NEW.author_id IS NOT NULL THEN
        INSERT INTO thread_follows (user_id, thread_id)
        VALUES (NEW.author_id, NEW.thread_id)
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_post_auto_follow
    AFTER INSERT ON posts
    FOR EACH ROW
    EXECUTE FUNCTION auto_follow_thread_on_reply();

-- ─── RPC for Toggle Follow ───
CREATE OR REPLACE FUNCTION toggle_thread_follow(p_thread_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
    
    SELECT EXISTS (SELECT 1 FROM thread_follows WHERE user_id = auth.uid() AND thread_id = p_thread_id) INTO v_exists;
    
    IF v_exists THEN
        DELETE FROM thread_follows WHERE user_id = auth.uid() AND thread_id = p_thread_id;
        RETURN FALSE;
    ELSE
        INSERT INTO thread_follows (user_id, thread_id) VALUES (auth.uid(), p_thread_id);
        RETURN TRUE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION toggle_account_follow(p_following_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
    IF auth.uid() = p_following_id THEN RETURN FALSE; END IF;
    
    SELECT EXISTS (SELECT 1 FROM account_follows WHERE follower_id = auth.uid() AND following_id = p_following_id) INTO v_exists;
    
    IF v_exists THEN
        DELETE FROM account_follows WHERE follower_id = auth.uid() AND following_id = p_following_id;
        RETURN FALSE;
    ELSE
        INSERT INTO account_follows (follower_id, following_id) VALUES (auth.uid(), p_following_id);
        RETURN TRUE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
