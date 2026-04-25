
ALTER TABLE public.repasses_estaduais ADD COLUMN IF NOT EXISTS competencia TEXT;

DO $$
DECLARE
  v_tid UUID;
  v_gov UUID;
BEGIN
  SELECT id INTO v_tid FROM public.tenants WHERE tipo = 'estado' LIMIT 1;
  SELECT p.id INTO v_gov FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.role = 'governador' LIMIT 1;

  IF v_tid IS NULL THEN RETURN; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.repasses_estaduais WHERE descricao LIKE '%PA-150%') THEN
    INSERT INTO public.repasses_estaduais (tenant_id, fonte, descricao, valor, prazo, status, requisito_pendente, progresso_pct, competencia)
    VALUES (v_tid, 'Ministério das Cidades', 'Convênio pavimentação rodovias estaduais (PA-150)', 45000000, '2025-03-15', 'em_andamento', NULL, 68, '2025-03');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.repasses_estaduais WHERE descricao LIKE '%IGD-SUAS%') THEN
    INSERT INTO public.repasses_estaduais (tenant_id, fonte, descricao, valor, prazo, status, requisito_pendente, progresso_pct, competencia)
    VALUES (v_tid, 'MDS', 'IGD-SUAS — gestão do SUAS estadual', 12400000, '2025-02-20', 'pendente', 'Relatório de gestão SEMAS não enviado', NULL, '2025-02');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.repasses_estaduais WHERE descricao LIKE '%PAC Saneamento%') THEN
    INSERT INTO public.repasses_estaduais (tenant_id, fonte, descricao, valor, prazo, status, requisito_pendente, progresso_pct, competencia)
    VALUES (v_tid, 'MDR', 'PAC Saneamento — municípios do PA', 180000000, '2025-06-30', 'em_andamento', NULL, 42, '2025-06');
  END IF;

  IF v_gov IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.comunicados_governador WHERE tenant_estadual_id = v_tid) THEN
    INSERT INTO public.comunicados_governador (tenant_estadual_id, titulo, corpo, destinatarios, tenants_destinatarios, enviado_por)
    VALUES
    (
      v_tid,
      'Prazo para envio de RREO — Atenção municípios!',
      'Comunicamos que o prazo para envio do Relatório Resumido da Execução Orçamentária (RREO) do 6º bimestre de 2024 encerra-se em 30/01/2025. Municípios que não cumprirem o prazo ficarão impedidos de receber transferências voluntárias do Estado. Dúvidas: SEFA (91) 3184-2000.',
      'todos',
      ARRAY(SELECT id FROM public.tenants WHERE tipo = 'municipio' AND ativo = true),
      v_gov
    ),
    (
      v_tid,
      'Novo programa SEDUC: Escola Conectada Pará',
      'O Governo do Estado lança o programa Escola Conectada Pará, que garantirá internet banda larga a todas as escolas municipais com mais de 100 alunos até dezembro/2025. Municípios interessados devem aderir até 28/02/2025 no portal SEDUC.pa.gov.br.',
      'todos',
      ARRAY(SELECT id FROM public.tenants WHERE tipo = 'municipio' AND ativo = true),
      v_gov
    );
  END IF;
END $$;
