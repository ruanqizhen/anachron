-- Drop columns that are now hardcoded or unused
ALTER TABLE ai_characters DROP COLUMN IF EXISTS rival_character_ids;
ALTER TABLE ai_characters DROP COLUMN IF EXISTS preferred_boards;
ALTER TABLE ai_characters DROP COLUMN IF EXISTS preferred_topics;
ALTER TABLE ai_characters DROP COLUMN IF EXISTS model_provider;
ALTER TABLE ai_characters DROP COLUMN IF EXISTS model_name;
ALTER TABLE ai_characters DROP COLUMN IF EXISTS daily_reply_limit;
