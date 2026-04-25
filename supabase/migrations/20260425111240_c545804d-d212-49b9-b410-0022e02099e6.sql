
-- Bucket de relatórios (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('relatorios', 'relatorios', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas storage para o bucket
CREATE POLICY "Prefeito lê relatórios do tenant"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'relatorios'
  AND (
    public.is_superadmin(auth.uid())
    OR public.has_role_in_tenant(auth.uid(), 'prefeito'::app_role, ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "Prefeito grava relatórios do tenant"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'relatorios'
  AND (
    public.is_superadmin(auth.uid())
    OR public.has_role_in_tenant(auth.uid(), 'prefeito'::app_role, ((storage.foldername(name))[1])::uuid)
  )
);

-- Tabela: histórico de relatórios executivos gerados
CREATE TABLE public.relatorios_executivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  titulo TEXT NOT NULL,
  storage_path TEXT,
  resumo_executivo TEXT,
  gerado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_relatorios_executivos_tenant ON public.relatorios_executivos(tenant_id, created_at DESC);

ALTER TABLE public.relatorios_executivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prefeito gerencia relatórios do município"
ON public.relatorios_executivos
FOR ALL
USING (public.has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id))
WITH CHECK (public.has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id));

CREATE POLICY "Superadmin gerencia relatórios"
ON public.relatorios_executivos
FOR ALL
USING (public.is_superadmin(auth.uid()))
WITH CHECK (public.is_superadmin(auth.uid()));

-- Tabela: briefings semanais (gerado por IA)
CREATE TABLE public.briefings_semanais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  semana_referencia DATE NOT NULL,
  conteudo_markdown TEXT NOT NULL,
  destaques JSONB DEFAULT '[]'::jsonb,
  alertas JSONB DEFAULT '[]'::jsonb,
  recomendacoes JSONB DEFAULT '[]'::jsonb,
  gerado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_briefings_tenant ON public.briefings_semanais(tenant_id, created_at DESC);

ALTER TABLE public.briefings_semanais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prefeito vê briefings do município"
ON public.briefings_semanais
FOR SELECT
USING (public.has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id));

CREATE POLICY "Prefeito cria briefings do município"
ON public.briefings_semanais
FOR INSERT
WITH CHECK (public.has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id));

CREATE POLICY "Superadmin gerencia briefings"
ON public.briefings_semanais
FOR ALL
USING (public.is_superadmin(auth.uid()))
WITH CHECK (public.is_superadmin(auth.uid()));
