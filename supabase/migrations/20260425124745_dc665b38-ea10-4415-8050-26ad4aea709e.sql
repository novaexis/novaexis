-- Criar tabela de auditoria se não existir
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    actor_id UUID REFERENCES auth.users(id),
    target_id UUID,
    payload JSONB,
    severity TEXT DEFAULT 'info',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ativar RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Superadmins podem ver logs
CREATE POLICY "Superadmins can view all audit logs" 
ON public.audit_logs 
FOR SELECT 
TO authenticated 
USING (public.is_superadmin(auth.uid()));

-- Função para registrar log (acessível via RPC ou trigger)
CREATE OR REPLACE FUNCTION public.log_action(
    p_action TEXT,
    p_target_id UUID DEFAULT NULL,
    p_payload JSONB DEFAULT NULL,
    p_severity TEXT DEFAULT 'info'
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.audit_logs (action, actor_id, target_id, payload, severity)
    VALUES (p_action, auth.uid(), p_target_id, p_payload, p_severity);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
