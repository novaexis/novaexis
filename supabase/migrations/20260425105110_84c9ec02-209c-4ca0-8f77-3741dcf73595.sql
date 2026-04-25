-- Convert string[] requisitos to [{item, concluido}]
UPDATE public.alertas_prazos
SET requisitos = (
  SELECT jsonb_agg(jsonb_build_object('item', elem, 'concluido', false))
  FROM jsonb_array_elements_text(requisitos) AS elem
)
WHERE jsonb_typeof(requisitos) = 'array'
  AND jsonb_array_length(requisitos) > 0
  AND jsonb_typeof(requisitos -> 0) = 'string';

-- Index for listing
CREATE INDEX IF NOT EXISTS idx_alertas_prazos_tenant_status
  ON public.alertas_prazos(tenant_id, status, prazo);