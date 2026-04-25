
-- 1) Restrict tenants SELECT to own tenant (and superadmin/governador)
DROP POLICY IF EXISTS "Autenticados leem tenants" ON public.tenants;

CREATE POLICY "Usuários leem próprio tenant"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  id = public.get_user_tenant(auth.uid())
  OR public.is_superadmin(auth.uid())
  OR public.has_role(auth.uid(), 'governador'::app_role)
);

-- 2) Add DELETE policies for matriculas storage bucket
CREATE POLICY "Responsável deleta próprios arquivos de matrícula"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'matriculas'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Secretário educação deleta arquivos de matrícula"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'matriculas'
  AND public.has_role_in_tenant(
    auth.uid(),
    'secretario'::app_role,
    public.get_user_tenant(auth.uid())
  )
  AND public.get_user_secretaria_slug(auth.uid()) = 'educacao'
);

CREATE POLICY "Superadmin gerencia arquivos de matrícula"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'matriculas' AND public.is_superadmin(auth.uid()))
WITH CHECK (bucket_id = 'matriculas' AND public.is_superadmin(auth.uid()));
