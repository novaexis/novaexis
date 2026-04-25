-- 1. Políticas para o bucket 'matriculas' (Documentos sensíveis de alunos)
-- O caminho esperado é {user_id}/{filename}

-- Permitir que o cidadão delete seus próprios uploads
DROP POLICY IF EXISTS "Responsável deleta próprios arquivos de matrícula" ON storage.objects;
CREATE POLICY "Responsável deleta próprios arquivos de matrícula"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'matriculas'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Permitir que o secretário de educação do tenant delete arquivos do seu município
DROP POLICY IF EXISTS "Secretário educação deleta arquivos de matrícula" ON storage.objects;
CREATE POLICY "Secretário educação deleta arquivos de matrícula"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'matriculas'
  AND public.has_role_in_tenant(
    auth.uid(),
    'secretario'::app_role,
    public.get_user_tenant((storage.foldername(name))[1]::uuid)
  )
  AND public.get_user_secretaria_slug(auth.uid()) = 'educacao'
);

-- 2. Políticas para o bucket 'demandas' (Fotos de zeladoria/reclamações)
-- O caminho esperado é {user_id}/{filename}

DROP POLICY IF EXISTS "Cidadão deleta próprios anexos de demandas" ON storage.objects;
CREATE POLICY "Cidadão deleta próprios anexos de demandas"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'demandas'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Gestores deletam anexos de demandas do tenant" ON storage.objects;
CREATE POLICY "Gestores deletam anexos de demandas do tenant"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'demandas'
  AND (
    public.has_role_in_tenant(auth.uid(), 'prefeito'::app_role, public.get_user_tenant((storage.foldername(name))[1]::uuid))
    OR public.has_role_in_tenant(auth.uid(), 'secretario'::app_role, public.get_user_tenant((storage.foldername(name))[1]::uuid))
  )
);

-- 3. Superadmin (Acesso total a todos os buckets)
DROP POLICY IF EXISTS "Superadmin gerencia todos os arquivos" ON storage.objects;
CREATE POLICY "Superadmin gerencia todos os arquivos"
ON storage.objects
FOR ALL
TO authenticated
USING (public.is_superadmin(auth.uid()))
WITH CHECK (public.is_superadmin(auth.uid()));
