CREATE POLICY "Prefeito remove relatórios do tenant"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'relatorios'
  AND (
    public.is_superadmin(auth.uid())
    OR public.has_role_in_tenant(
      auth.uid(),
      'prefeito'::app_role,
      ((storage.foldername(name))[1])::uuid
    )
  )
);