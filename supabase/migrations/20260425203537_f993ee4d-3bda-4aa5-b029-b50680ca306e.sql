-- Habilitar extensão pg_cron se não existir (necessário para agendamentos)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Monitor de Captação (Diário às 03:00)
SELECT cron.schedule(
  'job_monitor_captacao',
  '0 3 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://' || (SELECT project_id FROM _lovable_project_info) || '.functions.supabase.co/monitor-captacao',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT service_role_key FROM _lovable_project_info)
      ),
      body := '{}'
    );
  $$
);

-- Benchmark Automático (Semanal - Domingo às 02:00)
SELECT cron.schedule(
  'job_benchmark_semanal',
  '0 2 * * 0',
  $$
  SELECT
    net.http_post(
      url := 'https://' || (SELECT project_id FROM _lovable_project_info) || '.functions.supabase.co/benchmark-automatico',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT service_role_key FROM _lovable_project_info)
      ),
      body := '{}'
    );
  $$
);

-- Briefing Semanal (Semanal - Segunda às 06:00)
SELECT cron.schedule(
  'job_briefing_semanal',
  '0 6 * * 1',
  $$
  SELECT
    net.http_post(
      url := 'https://' || (SELECT project_id FROM _lovable_project_info) || '.functions.supabase.co/gerar-briefing-semanal',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT service_role_key FROM _lovable_project_info)
      ),
      body := '{}'
    );
  $$
);