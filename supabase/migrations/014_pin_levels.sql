-- Replace is_pinned with pin_level: 0=none, 1=blog, 2=board, 3=home
ALTER TABLE threads ADD COLUMN IF NOT EXISTS pin_level INT NOT NULL DEFAULT 0;
UPDATE threads SET pin_level = 1 WHERE is_pinned = true;
ALTER TABLE threads DROP COLUMN IF EXISTS is_pinned;
