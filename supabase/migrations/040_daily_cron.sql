-- Set up daily AI reply trigger at noon Beijing time (4 AM UTC)

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'daily-ai-reply',
  '0 4 * * *',
  $$SELECT net.http_post(
    url := 'https://nmpwzeffjjlzdcfmrmwf.supabase.co/functions/v1/daily-digest',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer placeholder"}'::jsonb,
    body := '{}'::bytea,
    timeout_milliseconds := 120000
  )$$
);
