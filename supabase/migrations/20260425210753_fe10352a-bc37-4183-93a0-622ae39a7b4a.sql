
-- Tabela: comunicados do governador para municípios
CREATE TABLE IF NOT EXISTS public.comunicados_governador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_estadual_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  corpo TEXT NOT NULL,
  destinatarios TEXT NOT NULL DEFAULT 'todos' CHECK (destinatarios IN ('todos','por_porte','por_indicador','especificos')),
  filtro_destinatarios JSONB,
  tenants_destinatarios UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  enviado_por UUID NOT NULL REFERENCES public.profiles(id),
  enviado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lido_por JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.comunicados_governador ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "governador_gerencia_comunicados" ON public.comunicados_governador;
CREATE POLICY "governador_gerencia_comunicados" ON public.comunicados_governador
  FOR ALL USING (
    public.is_superadmin(auth.uid()) OR
    (public.has_role(auth.uid(), 'governador'::app_role) AND tenant_estadual_id = public.get_user_tenant(auth.uid()))
  )
  WITH CHECK (
    public.is_superadmin(auth.uid()) OR
    (public.has_role(auth.uid(), 'governador'::app_role) AND tenant_estadual_id = public.get_user_tenant(auth.uid()))
  );

DROP POLICY IF EXISTS "prefeito_le_comunicados" ON public.comunicados_governador;
CREATE POLICY "prefeito_le_comunicados" ON public.comunicados_governador
  FOR SELECT USING (
    public.get_user_tenant(auth.uid()) = ANY(tenants_destinatarios)
  );

DROP POLICY IF EXISTS "prefeito_marca_lido_comunicados" ON public.comunicados_governador;
CREATE POLICY "prefeito_marca_lido_comunicados" ON public.comunicados_governador
  FOR UPDATE USING (
    public.get_user_tenant(auth.uid()) = ANY(tenants_destinatarios)
  );

CREATE INDEX IF NOT EXISTS idx_comunicados_estadual ON public.comunicados_governador(tenant_estadual_id, enviado_at DESC);
CREATE INDEX IF NOT EXISTS idx_comunicados_destinatarios ON public.comunicados_governador USING GIN(tenants_destinatarios);

-- Adicionar coluna 'meta' em kpis (opcional, para linha de meta no gráfico)
ALTER TABLE public.kpis ADD COLUMN IF NOT EXISTS meta NUMERIC;

-- View: KPIs consolidados de municípios aderentes (uso interno governador)
CREATE OR REPLACE VIEW public.kpis_municipios_aderentes
WITH (security_invoker = true)
AS
WITH ultimo_kpi AS (
  SELECT DISTINCT ON (k.tenant_id, k.secretaria_slug, k.indicador)
    k.tenant_id, k.secretaria_slug, k.indicador, k.valor, k.unidade,
    k.status, k.variacao_pct, k.referencia_data
  FROM public.kpis k
  ORDER BY k.tenant_id, k.secretaria_slug, k.indicador, k.referencia_data DESC
)
SELECT
  t.id AS tenant_id,
  t.nome AS municipio,
  t.populacao,
  t.idhm,
  k.secretaria_slug,
  k.indicador,
  k.valor,
  k.unidade,
  k.status,
  k.variacao_pct,
  k.referencia_data
FROM public.tenants t
LEFT JOIN ultimo_kpi k ON k.tenant_id = t.id
WHERE t.tipo = 'municipio' AND t.ativo = true;
