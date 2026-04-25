
-- INTEGRADORES
CREATE TABLE public.integradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  secretaria_slug TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('api_rest','etl_agente','legado','importacao_manual')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'aguardando_configuracao' CHECK (status IN ('ativo','inativo','erro','aguardando_configuracao')),
  ultimo_sync TIMESTAMPTZ,
  ultimo_erro TEXT,
  total_registros_importados INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_integradores_tenant ON public.integradores(tenant_id);
CREATE INDEX idx_integradores_status ON public.integradores(status);

ALTER TABLE public.integradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant lê integradores"
ON public.integradores FOR SELECT
USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmin gerencia integradores"
ON public.integradores FOR ALL
USING (public.is_superadmin(auth.uid()))
WITH CHECK (public.is_superadmin(auth.uid()));

CREATE TRIGGER trg_integradores_updated_at
BEFORE UPDATE ON public.integradores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SYNC LOGS
CREATE TABLE public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integrador_id UUID NOT NULL REFERENCES public.integradores(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  iniciado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluido_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento','sucesso','erro','parcial')),
  registros_processados INTEGER NOT NULL DEFAULT 0,
  registros_salvos INTEGER NOT NULL DEFAULT 0,
  registros_ignorados INTEGER NOT NULL DEFAULT 0,
  erro_mensagem TEXT,
  erro_detalhes JSONB,
  payload_size_kb INTEGER,
  duracao_ms INTEGER
);
CREATE INDEX idx_sync_logs_integrador ON public.sync_logs(integrador_id, iniciado_at DESC);
CREATE INDEX idx_sync_logs_tenant ON public.sync_logs(tenant_id);

ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant lê sync_logs"
ON public.sync_logs FOR SELECT
USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmin gerencia sync_logs"
ON public.sync_logs FOR ALL
USING (public.is_superadmin(auth.uid()))
WITH CHECK (public.is_superadmin(auth.uid()));

-- MAPEAMENTOS IMPORTACAO
CREATE TABLE public.mapeamentos_importacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  secretaria_slug TEXT NOT NULL,
  nome_coluna_origem TEXT NOT NULL,
  indicador_destino TEXT NOT NULL,
  unidade TEXT,
  fator_conversao NUMERIC NOT NULL DEFAULT 1,
  exemplo_valor TEXT,
  confirmado_por UUID REFERENCES public.profiles(id),
  confirmado_at TIMESTAMPTZ,
  vezes_usado INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mapeamentos_tenant_sec ON public.mapeamentos_importacao(tenant_id, secretaria_slug);

ALTER TABLE public.mapeamentos_importacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant gerencia mapeamentos"
ON public.mapeamentos_importacao FOR ALL
USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_superadmin(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_superadmin(auth.uid()));

-- INSIGHTS CRUZADOS
CREATE TABLE public.insights_cruzados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  secretarias TEXT[] NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('correlacao','anomalia','risco','oportunidade')),
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  prioridade TEXT NOT NULL CHECK (prioridade IN ('baixa','media','alta','critica')),
  dados_suporte JSONB NOT NULL DEFAULT '{}'::jsonb,
  acao_recomendada TEXT,
  secretaria_lider TEXT,
  lido_pelo_prefeito BOOLEAN NOT NULL DEFAULT false,
  delegado_para UUID REFERENCES public.profiles(id),
  delegado_at TIMESTAMPTZ,
  instrucao_delegacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_insights_tenant_created ON public.insights_cruzados(tenant_id, created_at DESC);
CREATE INDEX idx_insights_prioridade ON public.insights_cruzados(prioridade);

ALTER TABLE public.insights_cruzados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant lê insights cruzados"
ON public.insights_cruzados FOR SELECT
USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_superadmin(auth.uid()) OR public.has_role(auth.uid(), 'governador'::app_role));

CREATE POLICY "Prefeito atualiza insights"
ON public.insights_cruzados FOR UPDATE
USING (public.has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id));

CREATE POLICY "Superadmin gerencia insights"
ON public.insights_cruzados FOR ALL
USING (public.is_superadmin(auth.uid()))
WITH CHECK (public.is_superadmin(auth.uid()));

-- DELEGACOES
CREATE TABLE public.delegacoes_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  insight_id UUID NOT NULL REFERENCES public.insights_cruzados(id) ON DELETE CASCADE,
  delegado_por UUID NOT NULL REFERENCES public.profiles(id),
  delegado_para UUID NOT NULL REFERENCES public.profiles(id),
  instrucao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluido')),
  resposta TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_delegacoes_para ON public.delegacoes_insights(delegado_para, status);
CREATE INDEX idx_delegacoes_tenant ON public.delegacoes_insights(tenant_id);

ALTER TABLE public.delegacoes_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant lê delegacoes"
ON public.delegacoes_insights FOR SELECT
USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_superadmin(auth.uid()));

CREATE POLICY "Prefeito cria delegacoes"
ON public.delegacoes_insights FOR INSERT
WITH CHECK (public.has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id) AND delegado_por = auth.uid());

CREATE POLICY "Delegado ou prefeito atualiza"
ON public.delegacoes_insights FOR UPDATE
USING (delegado_para = auth.uid() OR public.has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id) OR public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmin remove delegacoes"
ON public.delegacoes_insights FOR DELETE
USING (public.is_superadmin(auth.uid()));

CREATE TRIGGER trg_delegacoes_updated_at
BEFORE UPDATE ON public.delegacoes_insights
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SEED integradores (alias d.* para evitar ambiguidade com tenants.nome)
INSERT INTO public.integradores (tenant_id, secretaria_slug, nome, descricao, tipo, status, ultimo_sync, total_registros_importados, ultimo_erro, config)
SELECT t.id, d.secretaria_slug, d.nome, d.descricao, d.tipo, d.status, d.ultimo_sync, d.total, d.ultimo_erro, d.config::jsonb
FROM public.tenants t
CROSS JOIN (VALUES
  ('saude',          'SIOPS — Sistema de Informações de Orçamentos de Saúde',    'Integração automática com base federal SIOPS via API REST do DataSUS',   'api_rest',          'ativo',                    NOW() - INTERVAL '2 hours',  1840, NULL::text, '{}'),
  ('saude',          'SISAB — Sistema de Informação em Saúde para APS',          'Dados de produção das UBSs e equipes de saúde da família',               'api_rest',          'ativo',                    NOW() - INTERVAL '4 hours',  3210, NULL::text, '{}'),
  ('educacao',       'SIOPE — Sistema de Informações sobre Orçamentos Públicos', 'Execução orçamentária de educação — Ministério da Educação',             'api_rest',          'ativo',                    NOW() - INTERVAL '1 hour',    920, NULL::text, '{}'),
  ('educacao',       'Sistema próprio SEDUC Municipal',                          'ERP municipal de educação (Pronim) — agente ETL instalado',              'etl_agente',        'ativo',                    NOW() - INTERVAL '30 minutes',4820, NULL::text, '{}'),
  ('financas',       'Transferegov / SICONV',                                    'Convênios e transferências voluntárias federais',                        'api_rest',          'ativo',                    NOW() - INTERVAL '6 hours',   340, NULL::text, '{}'),
  ('financas',       'Sistema contábil Betha (legado)',                          'Acesso somente leitura ao banco Betha via agente ETL',                   'etl_agente',        'erro',                     NOW() - INTERVAL '8 hours',  12400, 'Connection timeout após 30s — servidor Betha não respondeu. Verificar VPN da prefeitura e credenciais no Vault.', '{"endpoint":"jdbc:postgresql://betha-local:5432/contabil"}'),
  ('infraestrutura', 'Planilha obras — Secretaria de Infraestrutura',            'Importação manual mensal da planilha de acompanhamento de obras',        'importacao_manual', 'ativo',                    NOW() - INTERVAL '5 days',    180, NULL::text, '{}'),
  ('seguranca',      'Sistema GM — Guarda Municipal',                            'Exportação diária do sistema da Guarda Municipal (formato CSV)',         'legado',            'aguardando_configuracao',  NULL::timestamptz,              0, NULL::text, '{}'),
  ('assistencia',    'CadÚnico — Ministério do Desenvolvimento Social',          'Dados de famílias cadastradas via API do MDS',                          'api_rest',          'ativo',                    NOW() - INTERVAL '12 hours', 4218, NULL::text, '{}')
) AS d(secretaria_slug, nome, descricao, tipo, status, ultimo_sync, total, ultimo_erro, config)
WHERE t.tipo = 'municipio';

-- Sync logs últimas 24h
INSERT INTO public.sync_logs (integrador_id, tenant_id, iniciado_at, concluido_at, status, registros_processados, registros_salvos, registros_ignorados, payload_size_kb, duracao_ms)
SELECT
  i.id, i.tenant_id,
  NOW() - (n * INTERVAL '6 hours'),
  NOW() - (n * INTERVAL '6 hours') + INTERVAL '8 seconds',
  'sucesso',
  FLOOR(random() * 50 + 10)::int,
  FLOOR(random() * 45 + 8)::int,
  FLOOR(random() * 5)::int,
  FLOOR(random() * 120 + 20)::int,
  FLOOR(random() * 8000 + 2000)::int
FROM public.integradores i
CROSS JOIN generate_series(1, 4) AS n
WHERE i.status = 'ativo';

INSERT INTO public.sync_logs (integrador_id, tenant_id, iniciado_at, concluido_at, status, registros_processados, registros_salvos, registros_ignorados, erro_mensagem, duracao_ms)
SELECT i.id, i.tenant_id, NOW() - INTERVAL '8 hours', NOW() - INTERVAL '8 hours' + INTERVAL '30 seconds', 'erro', 0, 0, 0,
       'Connection timeout após 30s — servidor Betha não respondeu', 30000
FROM public.integradores i
WHERE i.nome LIKE '%Betha%';

-- Insights cruzados de exemplo
INSERT INTO public.insights_cruzados (tenant_id, secretarias, tipo, titulo, descricao, prioridade, secretaria_lider, acao_recomendada, dados_suporte)
SELECT t.id, d.secretarias::text[], d.tipo, d.titulo, d.descricao, d.prioridade, d.secretaria_lider, d.acao_recomendada, d.dados::jsonb
FROM public.tenants t
CROSS JOIN (VALUES
  (ARRAY['saude','assistencia'],    'correlacao', 'Aumento de demandas CRAS coincide com pico de atendimentos UBS no bairro Centro',
   'Dados das últimas 4 semanas mostram correlação de 0.82 entre visitas ao CRAS e atendimentos respiratórios na UBS Centro. Pode indicar surto sazonal ou problema sanitário no bairro.',
   'alta', 'saude',
   'Mobilizar agentes de saúde e CRAS para visita conjunta às famílias do bairro Centro nos próximos 7 dias.',
   '{"correlacao":0.82,"bairro":"Centro","periodo":"28d"}'),
  (ARRAY['educacao','assistencia'], 'risco', 'Evasão escolar concentrada em famílias com renda per capita abaixo de R$ 200',
   '12 das 18 matrículas canceladas no último mês são de famílias acompanhadas pelo CRAS com perfil de risco alto. Recomenda-se ação preventiva integrada.',
   'critica', 'educacao',
   'Acionar equipe técnica do CRAS para abordagem das 6 famílias restantes com perfil de risco antes do próximo fechamento de chamada.',
   '{"matriculas_canceladas":18,"sinalizadas_cras":12}'),
  (ARRAY['infraestrutura','seguranca'], 'oportunidade', 'Bairros com obras de iluminação concluídas reduziram ocorrências em 34%',
   'Cruzamento entre contratos de iluminação concluídos e ocorrências de segurança mostra queda significativa nos bairros tratados. Bom argumento para acelerar o cronograma das obras pendentes.',
   'media', 'infraestrutura',
   'Apresentar resultado em coletiva e priorizar a contratação dos 4 bairros restantes do plano de iluminação.',
   '{"reducao_pct":34}')
) AS d(secretarias, tipo, titulo, descricao, prioridade, secretaria_lider, acao_recomendada, dados)
WHERE t.tipo = 'municipio';
