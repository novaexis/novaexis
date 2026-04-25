-- =============================================
-- BLOCO 4 — Painéis dos Secretários
-- Tabelas, RLS e seeds compartilhados
-- =============================================

-- ============= 1. demanda_historico =============
CREATE TABLE IF NOT EXISTS public.demanda_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  demanda_id UUID NOT NULL REFERENCES public.demandas(id) ON DELETE CASCADE,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  observacao TEXT,
  usuario_id UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demanda_historico_demanda ON public.demanda_historico(demanda_id);
CREATE INDEX IF NOT EXISTS idx_demanda_historico_tenant ON public.demanda_historico(tenant_id);

ALTER TABLE public.demanda_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant lê histórico" ON public.demanda_historico
  FOR SELECT USING (
    is_superadmin(auth.uid())
    OR tenant_id = get_user_tenant(auth.uid())
  );

CREATE POLICY "Usuários do tenant inserem histórico" ON public.demanda_historico
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant(auth.uid())
    AND usuario_id = auth.uid()
  );

CREATE POLICY "Superadmin gerencia histórico" ON public.demanda_historico
  FOR ALL USING (is_superadmin(auth.uid())) WITH CHECK (is_superadmin(auth.uid()));

-- ============= 2. campanhas_vacinacao =============
CREATE TABLE IF NOT EXISTS public.campanhas_vacinacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  publico_alvo TEXT,
  data_inicio DATE,
  data_fim DATE,
  meta_doses INTEGER DEFAULT 0,
  doses_aplicadas INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('planejada','ativa','encerrada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.campanhas_vacinacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant lê campanhas" ON public.campanhas_vacinacao
  FOR SELECT USING (tenant_id = get_user_tenant(auth.uid()) OR is_superadmin(auth.uid()));

CREATE POLICY "Secretário saúde gerencia campanhas" ON public.campanhas_vacinacao
  FOR ALL USING (
    is_superadmin(auth.uid())
    OR has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id)
    OR (has_role_in_tenant(auth.uid(), 'secretario'::app_role, tenant_id)
        AND get_user_secretaria_slug(auth.uid()) = 'saude')
  ) WITH CHECK (
    is_superadmin(auth.uid())
    OR has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id)
    OR (has_role_in_tenant(auth.uid(), 'secretario'::app_role, tenant_id)
        AND get_user_secretaria_slug(auth.uid()) = 'saude')
  );

-- ============= 3. repasses_municipais =============
CREATE TABLE IF NOT EXISTS public.repasses_municipais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  fonte TEXT NOT NULL,
  competencia TEXT NOT NULL,
  valor NUMERIC(15,2) NOT NULL,
  data_credito DATE,
  status TEXT NOT NULL DEFAULT 'recebido' CHECK (status IN ('recebido','aguardando','atrasado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.repasses_municipais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant lê repasses municipais" ON public.repasses_municipais
  FOR SELECT USING (tenant_id = get_user_tenant(auth.uid()) OR is_superadmin(auth.uid()));

CREATE POLICY "Prefeito/Secretário finanças gerencia repasses" ON public.repasses_municipais
  FOR ALL USING (
    is_superadmin(auth.uid())
    OR has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id)
    OR (has_role_in_tenant(auth.uid(), 'secretario'::app_role, tenant_id)
        AND get_user_secretaria_slug(auth.uid()) = 'financas')
  ) WITH CHECK (
    is_superadmin(auth.uid())
    OR has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id)
    OR (has_role_in_tenant(auth.uid(), 'secretario'::app_role, tenant_id)
        AND get_user_secretaria_slug(auth.uid()) = 'financas')
  );

-- ============= 4. contratos_obras =============
CREATE TABLE IF NOT EXISTS public.contratos_obras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  descricao TEXT NOT NULL,
  contratada TEXT,
  valor_total NUMERIC(15,2),
  valor_executado NUMERIC(15,2) DEFAULT 0,
  data_inicio DATE,
  data_fim_prevista DATE,
  localizacao TEXT,
  bairro TEXT,
  status TEXT NOT NULL DEFAULT 'planejado' CHECK (status IN ('planejado','em_andamento','paralisado','concluido','cancelado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contratos_obras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant lê contratos" ON public.contratos_obras
  FOR SELECT USING (tenant_id = get_user_tenant(auth.uid()) OR is_superadmin(auth.uid()));

CREATE POLICY "Prefeito/Secretário infra gerencia contratos" ON public.contratos_obras
  FOR ALL USING (
    is_superadmin(auth.uid())
    OR has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id)
    OR (has_role_in_tenant(auth.uid(), 'secretario'::app_role, tenant_id)
        AND get_user_secretaria_slug(auth.uid()) = 'infraestrutura')
  ) WITH CHECK (
    is_superadmin(auth.uid())
    OR has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id)
    OR (has_role_in_tenant(auth.uid(), 'secretario'::app_role, tenant_id)
        AND get_user_secretaria_slug(auth.uid()) = 'infraestrutura')
  );

-- ============= 5. ocorrencias_seguranca =============
CREATE TABLE IF NOT EXISTS public.ocorrencias_seguranca (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('roubo','furto','vandalismo','perturbacao','violencia_domestica','outros')),
  descricao TEXT,
  bairro TEXT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  data_hora TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'registrada' CHECK (status IN ('registrada','em_atendimento','encerrada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_tenant_data ON public.ocorrencias_seguranca(tenant_id, data_hora DESC);

ALTER TABLE public.ocorrencias_seguranca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant lê ocorrências" ON public.ocorrencias_seguranca
  FOR SELECT USING (tenant_id = get_user_tenant(auth.uid()) OR is_superadmin(auth.uid()));

CREATE POLICY "Prefeito/Secretário segurança gerencia ocorrências" ON public.ocorrencias_seguranca
  FOR ALL USING (
    is_superadmin(auth.uid())
    OR has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id)
    OR (has_role_in_tenant(auth.uid(), 'secretario'::app_role, tenant_id)
        AND get_user_secretaria_slug(auth.uid()) = 'seguranca')
  ) WITH CHECK (
    is_superadmin(auth.uid())
    OR has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id)
    OR (has_role_in_tenant(auth.uid(), 'secretario'::app_role, tenant_id)
        AND get_user_secretaria_slug(auth.uid()) = 'seguranca')
  );

-- ============= 6. familias_acompanhamento =============
CREATE TABLE IF NOT EXISTS public.familias_acompanhamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome_responsavel TEXT NOT NULL,
  cpf_responsavel TEXT,
  membros INTEGER DEFAULT 1,
  renda_per_capita NUMERIC(10,2),
  bairro TEXT,
  cadunico_nis TEXT,
  perfil_risco TEXT NOT NULL DEFAULT 'baixo' CHECK (perfil_risco IN ('baixo','medio','alto','critico')),
  beneficios_ativos TEXT[],
  data_ultimo_atendimento DATE,
  tecnico_responsavel TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.familias_acompanhamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant lê famílias" ON public.familias_acompanhamento
  FOR SELECT USING (tenant_id = get_user_tenant(auth.uid()) OR is_superadmin(auth.uid()));

CREATE POLICY "Prefeito/Secretário assistência gerencia famílias" ON public.familias_acompanhamento
  FOR ALL USING (
    is_superadmin(auth.uid())
    OR has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id)
    OR (has_role_in_tenant(auth.uid(), 'secretario'::app_role, tenant_id)
        AND get_user_secretaria_slug(auth.uid()) = 'assistencia')
  ) WITH CHECK (
    is_superadmin(auth.uid())
    OR has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id)
    OR (has_role_in_tenant(auth.uid(), 'secretario'::app_role, tenant_id)
        AND get_user_secretaria_slug(auth.uid()) = 'assistencia')
  );

-- ============= 7. atendimentos_cras =============
CREATE TABLE IF NOT EXISTS public.atendimentos_cras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unidade TEXT NOT NULL CHECK (unidade IN ('cras','creas')),
  data_atendimento DATE NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  tipo_servico TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.atendimentos_cras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant lê atendimentos CRAS" ON public.atendimentos_cras
  FOR SELECT USING (tenant_id = get_user_tenant(auth.uid()) OR is_superadmin(auth.uid()));

CREATE POLICY "Prefeito/Secretário assistência gerencia CRAS" ON public.atendimentos_cras
  FOR ALL USING (
    is_superadmin(auth.uid())
    OR has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id)
    OR (has_role_in_tenant(auth.uid(), 'secretario'::app_role, tenant_id)
        AND get_user_secretaria_slug(auth.uid()) = 'assistencia')
  ) WITH CHECK (
    is_superadmin(auth.uid())
    OR has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id)
    OR (has_role_in_tenant(auth.uid(), 'secretario'::app_role, tenant_id)
        AND get_user_secretaria_slug(auth.uid()) = 'assistencia')
  );

-- ============= SEEDS =============

-- Campanhas de vacinação
INSERT INTO public.campanhas_vacinacao (tenant_id, nome, publico_alvo, data_inicio, data_fim, meta_doses, doses_aplicadas, status)
SELECT t.id, d.nome, d.publico_alvo, d.inicio::DATE, d.fim::DATE, d.meta, d.realizado, d.status
FROM public.tenants t
CROSS JOIN (VALUES
  ('Campanha Gripe 2025', 'Idosos 60+ e crianças 6m-5a', '2025-04-01', '2025-05-31', 4200, 3108, 'ativa'),
  ('Vacinação Dengue — Fase 1', 'Crianças de 10 a 14 anos', '2025-02-01', '2025-03-31', 2800, 1960, 'ativa'),
  ('Poliomielite 2024', 'Crianças menores de 5 anos', '2024-10-01', '2024-10-31', 3100, 2914, 'encerrada')
) AS d(nome, publico_alvo, inicio, fim, meta, realizado, status)
WHERE t.tipo = 'municipio'
ON CONFLICT DO NOTHING;

-- Repasses municipais
INSERT INTO public.repasses_municipais (tenant_id, fonte, competencia, valor, data_credito, status)
SELECT t.id, d.fonte, d.competencia, d.valor, d.credito::DATE, 'recebido'
FROM public.tenants t
CROSS JOIN (VALUES
  ('FPM', '2025-01', 2840000, '2025-01-10'),
  ('FPM', '2024-12', 3120000, '2024-12-10'),
  ('FPM', '2024-11', 2780000, '2024-11-10'),
  ('SUS — Atenção Básica', '2025-01', 485000, '2025-01-15'),
  ('SUS — Atenção Básica', '2024-12', 485000, '2024-12-15'),
  ('FUNDEB', '2025-01', 1240000, '2025-01-20'),
  ('FUNDEB', '2024-12', 1380000, '2024-12-20'),
  ('ICMS', '2025-01', 620000, '2025-01-25'),
  ('ICMS', '2024-12', 580000, '2024-12-25')
) AS d(fonte, competencia, valor, credito)
WHERE t.tipo = 'municipio'
ON CONFLICT DO NOTHING;

-- Contratos de obras
INSERT INTO public.contratos_obras (tenant_id, numero, descricao, contratada, valor_total, valor_executado, data_inicio, data_fim_prevista, bairro, status)
SELECT t.id, d.numero, d.descricao, d.contratada, d.v_total, d.v_exec, d.inicio::DATE, d.fim::DATE, d.bairro, d.status
FROM public.tenants t
CROSS JOIN (VALUES
  ('2024/018', 'Pavimentação Av. Principal — Zona Norte', 'Construtora Tapajós Ltda', 480000, 134400, '2024-10-01', '2025-03-15', 'norte', 'em_andamento'),
  ('2024/023', 'Reforma Mercado Municipal Centro', 'Engenharia Amazônica SA', 390000, 159900, '2024-11-01', '2025-03-30', 'centro', 'em_andamento'),
  ('2024/031', 'Iluminação LED Zona Sul (800 pontos)', 'Eletro Pará Ltda', 330000, 108900, '2024-12-01', '2025-04-10', 'sul', 'em_andamento'),
  ('2025/004', 'Reforma CRAS Ribeirão', 'Construtora Norte SA', 185000, 0, '2025-02-15', '2025-07-30', 'ribeirao', 'planejado'),
  ('2025/007', 'Ponte sobre Igarapé — Zona Leste', 'Engenharia Fluvial Ltda', 920000, 736000, '2024-06-01', '2025-01-31', 'leste', 'em_andamento')
) AS d(numero, descricao, contratada, v_total, v_exec, inicio, fim, bairro, status)
WHERE t.tipo = 'municipio'
ON CONFLICT DO NOTHING;

-- Ocorrências de segurança (60 por município, distribuídas em 90 dias)
INSERT INTO public.ocorrencias_seguranca (tenant_id, tipo, descricao, bairro, data_hora, status)
SELECT
  t.id,
  CASE WHEN n.r < 0.25 THEN 'furto'
       WHEN n.r < 0.45 THEN 'roubo'
       WHEN n.r < 0.60 THEN 'vandalismo'
       WHEN n.r < 0.75 THEN 'perturbacao'
       WHEN n.r < 0.88 THEN 'violencia_domestica'
       ELSE 'outros' END,
  'Ocorrência registrada via GM ou BO',
  CASE WHEN n.b < 0.20 THEN 'centro'
       WHEN n.b < 0.35 THEN 'norte'
       WHEN n.b < 0.48 THEN 'sul'
       WHEN n.b < 0.60 THEN 'leste'
       WHEN n.b < 0.70 THEN 'oeste'
       WHEN n.b < 0.80 THEN 'ribeirao'
       WHEN n.b < 0.90 THEN 'nova_esperanca'
       ELSE 'industrial' END,
  NOW() - (random() * INTERVAL '90 days'),
  'encerrada'
FROM public.tenants t
CROSS JOIN (SELECT random() AS r, random() AS b FROM generate_series(1,60)) AS n
WHERE t.tipo = 'municipio'
  AND NOT EXISTS (SELECT 1 FROM public.ocorrencias_seguranca o WHERE o.tenant_id = t.id);

-- Famílias em acompanhamento
INSERT INTO public.familias_acompanhamento
  (tenant_id, nome_responsavel, membros, renda_per_capita, bairro, perfil_risco, beneficios_ativos, data_ultimo_atendimento)
SELECT t.id, d.nome, d.membros, d.rpc, d.bairro, d.perfil, d.beneficios, d.data_atend::DATE
FROM public.tenants t
CROSS JOIN (VALUES
  ('Maria das Graças Silva', 5, 180.00, 'norte', 'critico', ARRAY['Bolsa Família','BPC'], '2025-01-15'),
  ('José Raimundo Costa', 3, 290.00, 'ribeirao', 'alto', ARRAY['Bolsa Família'], '2025-01-10'),
  ('Ana Paula Ferreira', 4, 150.00, 'norte', 'critico', ARRAY['Bolsa Família','Auxílio Gás'], '2025-01-08'),
  ('Francisco Alves', 6, 95.00, 'sul', 'critico', ARRAY['BPC'], '2025-01-20'),
  ('Raimunda Nogueira', 2, 420.00, 'centro', 'medio', ARRAY['Bolsa Família'], '2024-12-15'),
  ('Pedro Henrique Lima', 7, 85.00, 'norte', 'critico', ARRAY['Bolsa Família','BPC','Auxílio Gás'], '2025-01-18'),
  ('Conceição Martins', 3, 330.00, 'leste', 'alto', ARRAY['Bolsa Família'], '2024-12-20'),
  ('Antônio Bentes', 4, 210.00, 'ribeirao', 'alto', ARRAY['Bolsa Família'], '2025-01-05')
) AS d(nome, membros, rpc, bairro, perfil, beneficios, data_atend)
WHERE t.tipo = 'municipio'
  AND NOT EXISTS (SELECT 1 FROM public.familias_acompanhamento f WHERE f.tenant_id = t.id);

-- Atendimentos CRAS/CREAS — 12 semanas
INSERT INTO public.atendimentos_cras (tenant_id, unidade, data_atendimento, quantidade, tipo_servico)
SELECT
  t.id,
  unidade,
  (CURRENT_DATE - (semana * INTERVAL '7 days'))::DATE,
  CASE WHEN unidade = 'cras' THEN 60 + (random()*40)::INT ELSE 25 + (random()*20)::INT END,
  CASE WHEN unidade = 'cras' THEN 'PAIF' ELSE 'PAEFI' END
FROM public.tenants t
CROSS JOIN generate_series(0, 11) AS semana
CROSS JOIN (VALUES ('cras'), ('creas')) AS u(unidade)
WHERE t.tipo = 'municipio'
  AND NOT EXISTS (SELECT 1 FROM public.atendimentos_cras a WHERE a.tenant_id = t.id);

-- Turmas (educação) — uma para cada escola existente
INSERT INTO public.turmas (tenant_id, escola_id, serie, turno, vagas_total, vagas_ocupadas, ano_letivo)
SELECT e.tenant_id, e.id, d.serie, d.turno, 30, d.ocupadas, 2025
FROM public.escolas e
CROSS JOIN (VALUES
  ('1º ano', 'manha', 28),
  ('2º ano', 'manha', 25),
  ('3º ano', 'tarde', 27),
  ('4º ano', 'tarde', 30),
  ('5º ano', 'manha', 22),
  ('6º ano', 'tarde', 29),
  ('7º ano', 'manha', 26),
  ('8º ano', 'tarde', 30),
  ('9º ano', 'manha', 24)
) AS d(serie, turno, ocupadas)
WHERE NOT EXISTS (
  SELECT 1 FROM public.turmas t WHERE t.escola_id = e.id AND t.serie = d.serie AND t.turno = d.turno AND t.ano_letivo = 2025
);
