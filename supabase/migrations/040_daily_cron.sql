-- Set up daily AI reply trigger at noon Beijing time (4 AM UTC)

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove old job if exists
SELECT cron.unschedule('daily-ai-reply');

-- Schedule with correct pg_net API
SELECT cron.schedule(
  'daily-ai-reply',
  '0 4 * * *',
  $$SELECT net.http_post(
    url:='https://nmpwzeffjjlzdcfmrmwf.supabase.co/functions/v1/daily-digest',
    body:='{}',
    headers:='{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds:=60000
  )$$
);
