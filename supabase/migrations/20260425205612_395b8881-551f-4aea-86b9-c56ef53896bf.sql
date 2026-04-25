CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('social-intel-coletor-6h');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'social-intel-coletor-6h',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xktjkdxgyjhxlvlgypgj.supabase.co/functions/v1/social-intel-coletor',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);