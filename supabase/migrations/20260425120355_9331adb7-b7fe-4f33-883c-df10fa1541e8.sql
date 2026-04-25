-- Tabela de audit logs
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  tenant_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text
);

CREATE INDEX idx_audit_logs_tenant_created ON public.audit_logs (tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor_created ON public.audit_logs (actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX idx_audit_logs_created ON public.audit_logs (created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin gerencia audit logs"
ON public.audit_logs
FOR ALL
USING (public.is_superadmin(auth.uid()))
WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Prefeito vê audit logs do município"
ON public.audit_logs
FOR SELECT
USING (
  tenant_id IS NOT NULL
  AND public.has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id)
);