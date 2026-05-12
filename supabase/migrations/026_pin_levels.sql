ALTER TABLE threads ADD COLUMN IF NOT EXISTS pin_level INT NOT NULL DEFAULT 0;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='threads' AND column_name='is_pinned') THEN
        UPDATE threads SET pin_level = 1 WHERE is_pinned = true;
        ALTER TABLE threads DROP COLUMN is_pinned;
    END IF;
END $$;
