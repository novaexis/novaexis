-- Estender enum plataforma_social
ALTER TYPE plataforma_social ADD VALUE IF NOT EXISTS 'youtube';
ALTER TYPE plataforma_social ADD VALUE IF NOT EXISTS 'tiktok';

-- Tabela fontes_monitoramento
CREATE TABLE IF NOT EXISTS public.fontes_monitoramento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  plataforma plataforma_social NOT NULL,
  identificador TEXT NOT NULL,
  nome_exibicao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultimo_erro TEXT,
  ultimo_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, plataforma)
);

ALTER TABLE public.fontes_monitoramento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant lê fontes" ON public.fontes_monitoramento
  FOR SELECT USING (tenant_id = get_user_tenant(auth.uid()) OR is_superadmin(auth.uid()));

CREATE POLICY "Prefeito gerencia fontes" ON public.fontes_monitoramento
  FOR ALL USING (has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id))
  WITH CHECK (has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id));

CREATE POLICY "Superadmin gerencia fontes" ON public.fontes_monitoramento
  FOR ALL USING (is_superadmin(auth.uid()))
  WITH CHECK (is_superadmin(auth.uid()));

CREATE TRIGGER trg_fontes_monitoramento_updated
  BEFORE UPDATE ON public.fontes_monitoramento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Coluna alerta_crise em scores_aprovacao (se ainda não existir)
ALTER TABLE public.scores_aprovacao
  ADD COLUMN IF NOT EXISTS alerta_crise BOOLEAN NOT NULL DEFAULT false;

-- Coluna sugestao_resposta e conteudo_resumido em mencoes_sociais
ALTER TABLE public.mencoes_sociais
  ADD COLUMN IF NOT EXISTS sugestao_resposta TEXT,
  ADD COLUMN IF NOT EXISTS conteudo_resumido TEXT,
  ADD COLUMN IF NOT EXISTS alerta_crise BOOLEAN NOT NULL DEFAULT false;

-- Index úteis
CREATE INDEX IF NOT EXISTS idx_mencoes_tenant_data ON public.mencoes_sociais(tenant_id, coletado_at DESC);
CREATE INDEX IF NOT EXISTS idx_scores_tenant_data ON public.scores_aprovacao(tenant_id, data DESC);