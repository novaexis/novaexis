-- Tabela de conversas com IA
CREATE TABLE public.conversas_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  usuario_id UUID NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'prefeito' CHECK (tipo IN ('prefeito','secretario','governador')),
  secretaria_slug TEXT,
  pergunta TEXT NOT NULL,
  resposta TEXT NOT NULL,
  tokens_usados INTEGER,
  avaliacao INTEGER CHECK (avaliacao BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversas_ia_usuario ON public.conversas_ia (usuario_id, created_at DESC);
CREATE INDEX idx_conversas_ia_tenant ON public.conversas_ia (tenant_id, created_at DESC);

ALTER TABLE public.conversas_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê próprias conversas IA"
  ON public.conversas_ia FOR SELECT
  USING (usuario_id = auth.uid() OR is_superadmin(auth.uid()));

CREATE POLICY "Usuário insere própria conversa IA"
  ON public.conversas_ia FOR INSERT
  WITH CHECK (
    usuario_id = auth.uid()
    AND tenant_id = get_user_tenant(auth.uid())
  );

CREATE POLICY "Usuário avalia própria conversa IA"
  ON public.conversas_ia FOR UPDATE
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Superadmin gerencia conversas IA"
  ON public.conversas_ia FOR ALL
  USING (is_superadmin(auth.uid()))
  WITH CHECK (is_superadmin(auth.uid()));

-- Tabela de cache de benchmark
CREATE TABLE public.benchmark_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE,
  municipios_comparaveis JSONB NOT NULL DEFAULT '[]'::jsonb,
  percentis JSONB NOT NULL DEFAULT '{}'::jsonb,
  destaques_positivos JSONB NOT NULL DEFAULT '[]'::jsonb,
  areas_criticas JSONB NOT NULL DEFAULT '[]'::jsonb,
  radar_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  gerado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  valido_ate TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

CREATE INDEX idx_benchmark_cache_tenant ON public.benchmark_cache (tenant_id);

ALTER TABLE public.benchmark_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant lê benchmark próprio"
  ON public.benchmark_cache FOR SELECT
  USING (
    tenant_id = get_user_tenant(auth.uid())
    OR is_superadmin(auth.uid())
    OR has_role(auth.uid(), 'governador'::app_role)
  );

CREATE POLICY "Superadmin gerencia benchmark"
  ON public.benchmark_cache FOR ALL
  USING (is_superadmin(auth.uid()))
  WITH CHECK (is_superadmin(auth.uid()));

-- Trigger updated_at não necessário (gerado_at faz esse papel)