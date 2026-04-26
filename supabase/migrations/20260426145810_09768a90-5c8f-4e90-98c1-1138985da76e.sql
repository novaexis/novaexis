
-- 1. Adicionar coluna endpoint em integradores (nullable, não-disruptivo)
ALTER TABLE public.integradores
  ADD COLUMN IF NOT EXISTS endpoint TEXT;

-- 2. Índice único parcial em kpis para upsert idempotente
-- Usamos índice parcial para não conflitar com dados legados que possam ter duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS kpis_upsert_unique_idx
  ON public.kpis (tenant_id, indicador, referencia_data, secretaria_slug)
  WHERE fonte LIKE 'api:%';

-- 3. Índice de busca por fonte para performance dos syncs
CREATE INDEX IF NOT EXISTS kpis_fonte_idx ON public.kpis (fonte) WHERE fonte LIKE 'api:%';

-- 4. Índice em integradores para lookup rápido por tipo de sync
CREATE INDEX IF NOT EXISTS integradores_tipo_tenant_idx
  ON public.integradores (tipo, tenant_id);
