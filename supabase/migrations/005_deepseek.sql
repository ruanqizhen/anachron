-- Add DeepSeek as a supported AI provider.
-- DeepSeek API is OpenAI-compatible (https://api.deepseek.com/v1).

ALTER TABLE ai_characters DROP CONSTRAINT IF EXISTS ai_characters_model_provider_check;
ALTER TABLE ai_characters ADD CONSTRAINT ai_characters_model_provider_check
  CHECK (model_provider IN ('deepseek', 'openai', 'anthropic', 'gemini'));
