-- Buckets privados
INSERT INTO storage.buckets (id, name, public)
VALUES ('matriculas', 'matriculas', false), ('demandas', 'demandas', false)
ON CONFLICT (id) DO NOTHING;

-- ============ matriculas ============
-- Estrutura de path: {user_id}/{matricula_id}/{arquivo}
CREATE POLICY "cidadao_envia_matricula_propria"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'matriculas'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "cidadao_le_matricula_propria"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'matriculas'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "secretario_educacao_le_matriculas"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'matriculas'
  AND (
    is_superadmin(auth.uid())
    OR (
      has_role(auth.uid(), 'secretario'::app_role)
      AND get_user_secretaria_slug(auth.uid()) = 'educacao'
    )
    OR has_role(auth.uid(), 'prefeito'::app_role)
  )
);

-- ============ demandas ============
-- Estrutura de path: {user_id}/{demanda_id}/{arquivo}
CREATE POLICY "cidadao_envia_demanda_propria"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'demandas'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "cidadao_le_demanda_propria"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'demandas'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "gestores_leem_demandas_anexos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'demandas'
  AND (
    is_superadmin(auth.uid())
    OR has_role(auth.uid(), 'prefeito'::app_role)
    OR has_role(auth.uid(), 'secretario'::app_role)
  )
);