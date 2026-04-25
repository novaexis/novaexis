-- Garantir que a política existe para leitura via API
DROP POLICY IF EXISTS "Superadmins can view all audit logs" ON public.audit_logs;
CREATE POLICY "Superadmins can view all audit logs" 
ON public.audit_logs 
FOR SELECT 
TO authenticated 
USING (public.is_superadmin(auth.uid()));
