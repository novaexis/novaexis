
-- 1. Stripe fields em tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_status TEXT,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer ON public.tenants(stripe_customer_id);

-- 2. Leads comerciais (landing page)
CREATE TABLE IF NOT EXISTS public.leads_comerciais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  municipio TEXT,
  cargo TEXT,
  telefone TEXT,
  origem TEXT NOT NULL DEFAULT 'landing_page',
  status TEXT NOT NULL DEFAULT 'novo',
  observacoes TEXT,
  reseller_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leads_comerciais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "publico_insere_lead" ON public.leads_comerciais;
CREATE POLICY "publico_insere_lead" ON public.leads_comerciais
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "superadmin_le_leads" ON public.leads_comerciais;
CREATE POLICY "superadmin_le_leads" ON public.leads_comerciais
  FOR SELECT USING (is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "superadmin_atualiza_leads" ON public.leads_comerciais;
CREATE POLICY "superadmin_atualiza_leads" ON public.leads_comerciais
  FOR UPDATE USING (is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "reseller_le_proprios_leads" ON public.leads_comerciais;
CREATE POLICY "reseller_le_proprios_leads" ON public.leads_comerciais
  FOR SELECT USING (
    reseller_id IS NOT NULL
    AND reseller_id = (SELECT reseller_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE TRIGGER update_leads_comerciais_updated_at
  BEFORE UPDATE ON public.leads_comerciais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Onboarding checklist
CREATE TABLE IF NOT EXISTS public.onboarding_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  secretarios_convidados INTEGER NOT NULL DEFAULT 0,
  dados_importados BOOLEAN NOT NULL DEFAULT false,
  app_configurado BOOLEAN NOT NULL DEFAULT false,
  social_configurado BOOLEAN NOT NULL DEFAULT false,
  primeiro_login BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_le_checklist" ON public.onboarding_checklist;
CREATE POLICY "tenant_le_checklist" ON public.onboarding_checklist
  FOR SELECT USING (
    tenant_id = get_user_tenant(auth.uid()) OR is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "prefeito_atualiza_checklist" ON public.onboarding_checklist;
CREATE POLICY "prefeito_atualiza_checklist" ON public.onboarding_checklist
  FOR UPDATE USING (
    has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id) OR is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "superadmin_insere_checklist" ON public.onboarding_checklist;
CREATE POLICY "superadmin_insere_checklist" ON public.onboarding_checklist
  FOR INSERT WITH CHECK (is_superadmin(auth.uid()));

CREATE TRIGGER update_onboarding_checklist_updated_at
  BEFORE UPDATE ON public.onboarding_checklist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Rate limits
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  funcao TEXT NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  chamadas INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, funcao, data)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_le_rate_limits" ON public.rate_limits;
CREATE POLICY "superadmin_le_rate_limits" ON public.rate_limits
  FOR SELECT USING (is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "tenant_le_proprios_limits" ON public.rate_limits;
CREATE POLICY "tenant_le_proprios_limits" ON public.rate_limits
  FOR SELECT USING (tenant_id = get_user_tenant(auth.uid()));

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_tenant_id UUID,
  p_funcao TEXT,
  p_limite INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chamadas INTEGER;
BEGIN
  INSERT INTO public.rate_limits (tenant_id, funcao, data, chamadas)
  VALUES (p_tenant_id, p_funcao, CURRENT_DATE, 1)
  ON CONFLICT (tenant_id, funcao, data)
  DO UPDATE SET chamadas = rate_limits.chamadas + 1, updated_at = now()
  RETURNING chamadas INTO v_chamadas;

  RETURN v_chamadas <= p_limite;
END;
$$;

-- 5. Índices de performance
CREATE INDEX IF NOT EXISTS idx_kpis_tenant_slug_data
  ON public.kpis(tenant_id, secretaria_slug, referencia_data DESC);

CREATE INDEX IF NOT EXISTS idx_demandas_tenant_status
  ON public.demandas(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_mencoes_tenant_coletado
  ON public.mencoes_sociais(tenant_id, coletado_at DESC);

CREATE INDEX IF NOT EXISTS idx_alertas_tenant_prazo
  ON public.alertas_prazos(tenant_id, prazo, status);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created
  ON public.audit_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_logs_tenant_iniciado
  ON public.sync_logs(tenant_id, iniciado_at DESC);
