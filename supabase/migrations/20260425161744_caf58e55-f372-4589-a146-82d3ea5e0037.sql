
INSERT INTO storage.buckets (id, name, public) VALUES ('arquivos-importacao', 'arquivos-importacao', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Tenant faz upload de importação"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'arquivos-importacao'
  AND (storage.foldername(name))[1] = public.get_user_tenant(auth.uid())::text
);

CREATE POLICY "Tenant lê próprios arquivos importação"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'arquivos-importacao'
  AND ((storage.foldername(name))[1] = public.get_user_tenant(auth.uid())::text OR public.is_superadmin(auth.uid()))
);

CREATE POLICY "Tenant remove próprios arquivos importação"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'arquivos-importacao'
  AND ((storage.foldername(name))[1] = public.get_user_tenant(auth.uid())::text OR public.is_superadmin(auth.uid()))
);
