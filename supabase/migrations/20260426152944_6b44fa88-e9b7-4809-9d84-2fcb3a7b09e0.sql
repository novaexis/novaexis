DROP INDEX IF EXISTS public.kpis_upsert_unique_idx;

CREATE UNIQUE INDEX kpis_upsert_unique_idx
  ON public.kpis (tenant_id, indicador, referencia_data, secretaria_slug);