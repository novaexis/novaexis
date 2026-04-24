
-- 1. TENANTS: remove public read, add safer policies + public view
DROP POLICY IF EXISTS "Tenants são públicos para leitura" ON public.tenants;

-- Authenticated users can read tenants (still excludes anonymous)
CREATE POLICY "Autenticados leem tenants"
ON public.tenants
FOR SELECT
TO authenticated
USING (true);

-- Public-safe view (no stripe_subscription_id, plano, reseller_id)
CREATE OR REPLACE VIEW public.tenants_public AS
SELECT id, nome, slug, estado, tipo, ibge_codigo, populacao, idhm, bioma, ativo
FROM public.tenants
WHERE ativo = true;

GRANT SELECT ON public.tenants_public TO anon, authenticated;

-- 2. USER_ROLES: prevent prefeito from escalating privileges
DROP POLICY IF EXISTS "Prefeito gerencia roles no município" ON public.user_roles;

CREATE POLICY "Prefeito gerencia roles limitadas no município"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id)
  AND role IN ('secretario'::app_role, 'cidadao'::app_role)
)
WITH CHECK (
  has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id)
  AND role IN ('secretario'::app_role, 'cidadao'::app_role)
);

-- 3. DEMANDAS: validate secretaria_slug belongs to the citizen's tenant
DROP POLICY IF EXISTS "Cidadão cria demandas no próprio tenant" ON public.demandas;

CREATE POLICY "Cidadão cria demandas no próprio tenant"
ON public.demandas
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = cidadao_id
  AND tenant_id = get_user_tenant(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.secretarias s
    WHERE s.tenant_id = demandas.tenant_id
      AND s.slug = demandas.secretaria_slug
      AND s.ativo = true
  )
);
