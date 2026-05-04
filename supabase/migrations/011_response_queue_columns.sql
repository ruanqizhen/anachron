-- Add columns used by the new dispatcher/character-responder flow
ALTER TABLE ai_response_queue ADD COLUMN IF NOT EXISTS trigger_post_id UUID REFERENCES posts(id);
ALTER TABLE ai_response_queue ADD COLUMN IF NOT EXISTS execute_after TIMESTAMPTZ DEFAULT now();
ALTER TABLE ai_response_queue ADD COLUMN IF NOT EXISTS dispatch_reason TEXT;
