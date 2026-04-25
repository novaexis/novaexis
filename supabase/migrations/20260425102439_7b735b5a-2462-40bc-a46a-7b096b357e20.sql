
-- ============================================================
-- PARTE A: Repasses estaduais + secretarias estaduais + KPIs
-- ============================================================

-- Tabela de repasses estaduais
CREATE TABLE IF NOT EXISTS public.repasses_estaduais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  fonte TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(15,2),
  prazo DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('recebido','em_andamento','pendente','em_risco')),
  requisito_pendente TEXT,
  progresso_pct INTEGER CHECK (progresso_pct BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.repasses_estaduais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Governador lê repasses do estado"
  ON public.repasses_estaduais FOR SELECT
  USING (
    public.is_superadmin(auth.uid())
    OR (public.has_role(auth.uid(), 'governador') AND tenant_id = public.get_user_tenant(auth.uid()))
  );

CREATE POLICY "Superadmin gerencia repasses"
  ON public.repasses_estaduais FOR ALL
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE TRIGGER update_repasses_estaduais_updated_at
  BEFORE UPDATE ON public.repasses_estaduais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir secretarias estaduais
INSERT INTO public.secretarias (tenant_id, slug, nome, ativo)
SELECT t.id, dados.slug, dados.nome, true
FROM public.tenants t
CROSS JOIN (VALUES
  ('sespa',  'SESPA — Secretaria de Saúde'),
  ('seduc',  'SEDUC — Secretaria de Educação'),
  ('sefa',   'SEFA — Secretaria da Fazenda'),
  ('segup',  'SEGUP — Secretaria de Segurança Pública'),
  ('seinfra','SEINFRA — Secretaria de Infraestrutura'),
  ('semas',  'SEMAS — Secretaria de Assistência Social')
) AS dados(slug, nome)
WHERE t.tipo = 'estado'
ON CONFLICT DO NOTHING;

-- KPIs estaduais (snapshot atual)
INSERT INTO public.kpis (tenant_id, secretaria_slug, indicador, valor, unidade, variacao_pct, status, referencia_data, fonte)
SELECT t.id, d.secretaria_slug, d.indicador, d.valor, d.unidade, d.variacao_pct, d.status::kpi_status, CURRENT_DATE, 'seed'
FROM public.tenants t
CROSS JOIN (VALUES
  ('sespa',  'Cobertura atenção básica',         78.4,        '%',           -1.2, 'atencao'),
  ('sespa',  'Leitos SUS disponíveis',           1847,        'leitos',      -3.8, 'atencao'),
  ('sespa',  'Mortalidade infantil',             14.2,        'por mil',      0.4, 'critico'),
  ('sespa',  'Cobertura vacinação Polio',        94.1,        '%',            0.8, 'ok'),
  ('seduc',  'Taxa matrícula ensino médio',      87.3,        '%',            1.1, 'ok'),
  ('seduc',  'Taxa de evasão escolar',           8.1,         '%',            0.3, 'atencao'),
  ('seduc',  'IDEB anos finais',                 4.2,         'pontos',       0.1, 'atencao'),
  ('seduc',  'Escolas com internet',             61.4,        '%',            2.3, 'atencao'),
  ('sefa',   'Receita realizada vs. prevista',   94.8,        '%',           -0.4, 'ok'),
  ('sefa',   'Execução orçamentária global',     68.2,        '%',            3.1, 'ok'),
  ('sefa',   'Despesa pessoal — limite LRF',     47.1,        '%',            0.6, 'atencao'),
  ('sefa',   'ICMS arrecadado no mês',           1240000000,  'R$',           2.8, 'ok'),
  ('segup',  'Taxa de homicídios por 100k hab',  28.4,        'por 100k',     1.2, 'critico'),
  ('segup',  'Ocorrências de roubo no mês',      4821,        'ocorrências', -2.1, 'atencao'),
  ('segup',  'Efetivo PM ativo',                 87.3,        '%',           -0.5, 'ok'),
  ('seinfra','Execução média de obras',          61.4,        '%',            4.2, 'ok'),
  ('seinfra','Rodovias em bom estado',           43.2,        '%',           -1.8, 'critico'),
  ('seinfra','Licitações em andamento',          12,          'contratos',    0,   'ok'),
  ('semas',  'Famílias no CadÚnico',             892400,      'famílias',     1.4, 'ok'),
  ('semas',  'Beneficiários programas estaduais',124800,      'pessoas',      2.1, 'ok'),
  ('semas',  'CRAS/CREAS em funcionamento',      96.4,        '%',            0.2, 'ok')
) AS d(secretaria_slug, indicador, valor, unidade, variacao_pct, status)
WHERE t.tipo = 'estado'
  AND NOT EXISTS (
    SELECT 1 FROM public.kpis k
    WHERE k.tenant_id = t.id
      AND k.secretaria_slug = d.secretaria_slug
      AND k.indicador = d.indicador
      AND k.referencia_data = CURRENT_DATE
  );

-- Histórico de 90 dias para indicador principal de cada secretaria estadual
INSERT INTO public.kpis (tenant_id, secretaria_slug, indicador, valor, unidade, variacao_pct, status, referencia_data, fonte)
SELECT
  t.id,
  d.secretaria_slug,
  d.indicador,
  d.base + (random() - 0.5) * d.base * 0.1,
  d.unidade,
  (random() - 0.5) * 4,
  'ok'::kpi_status,
  (CURRENT_DATE - (gs * 7))::date,
  'seed-historico'
FROM public.tenants t
CROSS JOIN generate_series(1, 12) AS gs
CROSS JOIN (VALUES
  ('sespa',  'Cobertura atenção básica',     78.4,  '%'),
  ('seduc',  'Taxa matrícula ensino médio',  87.3,  '%'),
  ('sefa',   'Execução orçamentária global', 68.2,  '%'),
  ('segup',  'Taxa de homicídios por 100k hab', 28.4, 'por 100k'),
  ('seinfra','Execução média de obras',      61.4,  '%'),
  ('semas',  'Famílias no CadÚnico',         892400,'famílias')
) AS d(secretaria_slug, indicador, base, unidade)
WHERE t.tipo = 'estado'
  AND NOT EXISTS (
    SELECT 1 FROM public.kpis k
    WHERE k.tenant_id = t.id AND k.fonte = 'seed-historico' AND k.secretaria_slug = d.secretaria_slug
  );

-- Seed dos repasses estaduais
INSERT INTO public.repasses_estaduais (tenant_id, fonte, descricao, valor, prazo, status, requisito_pendente, progresso_pct)
SELECT t.id, d.fonte, d.descricao, d.valor, d.prazo::DATE, d.status, d.requisito_pendente, d.progresso_pct
FROM public.tenants t
CROSS JOIN (VALUES
  ('União — FPE',           'Fundo de Participação dos Estados — parcela mensal',           387450000::numeric, (CURRENT_DATE + 6)::text,  'recebido',      NULL::text, 100::int),
  ('Ministério da Saúde',   'SUS Fundo a Fundo — custeio atenção básica',                   124800000::numeric, (CURRENT_DATE + 16)::text, 'pendente',      'Envio do RREO ao SIOPS até 05/02', NULL::int),
  ('FNDE',                  'FUNDEB — complementação VAAR 2025',                             89300000::numeric, (CURRENT_DATE + 34)::text, 'em_risco',      'Pendência no SIMEC — censo escolar não consolidado', NULL::int),
  ('Ministério das Cidades','Convênio pavimentação rodovias estaduais (PA-150)',             45000000::numeric, (CURRENT_DATE + 49)::text, 'em_andamento',  NULL, 68),
  ('MDS',                   'IGD-SUAS — gestão do SUAS estadual',                            12400000::numeric, (CURRENT_DATE + 26)::text, 'pendente',      'Relatório de gestão SEMAS não enviado', NULL)
) AS d(fonte, descricao, valor, prazo, status, requisito_pendente, progresso_pct)
WHERE t.tipo = 'estado'
  AND NOT EXISTS (SELECT 1 FROM public.repasses_estaduais r WHERE r.tenant_id = t.id);

-- ============================================================
-- PARTE B: App do cidadão — Tabelas de saúde, educação, serviços
-- ============================================================

-- Unidades de saúde
CREATE TABLE IF NOT EXISTS public.unidades_saude (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'ubs' CHECK (tipo IN ('ubs','upa','hospital','clinica')),
  endereco TEXT,
  bairro TEXT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.unidades_saude ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem unidades do próprio tenant"
  ON public.unidades_saude FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmin gerencia unidades"
  ON public.unidades_saude FOR ALL
  USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));

-- Agenda de saúde (slots disponíveis)
CREATE TABLE IF NOT EXISTS public.agenda_saude (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL REFERENCES public.unidades_saude(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('consulta','exame','vacina')),
  especialidade TEXT,
  data_hora TIMESTAMPTZ NOT NULL,
  disponivel BOOLEAN NOT NULL DEFAULT true,
  agendamento_id UUID REFERENCES public.agendamentos_saude(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agenda_saude ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem agenda do próprio tenant"
  ON public.agenda_saude FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_superadmin(auth.uid()));

CREATE POLICY "Cidadão atualiza slot ao agendar"
  ON public.agenda_saude FOR UPDATE
  USING (tenant_id = public.get_user_tenant(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Superadmin gerencia agenda"
  ON public.agenda_saude FOR ALL
  USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));

-- Escolas
CREATE TABLE IF NOT EXISTS public.escolas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  bairro TEXT,
  endereco TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.escolas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem escolas do próprio tenant"
  ON public.escolas FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmin gerencia escolas"
  ON public.escolas FOR ALL
  USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));

-- Turmas
CREATE TABLE IF NOT EXISTS public.turmas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  escola_id UUID NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  serie TEXT NOT NULL,
  turno TEXT NOT NULL CHECK (turno IN ('manha','tarde','noite')),
  vagas_total INTEGER NOT NULL DEFAULT 30,
  vagas_ocupadas INTEGER NOT NULL DEFAULT 0,
  ano_letivo INTEGER NOT NULL DEFAULT 2025,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem turmas do próprio tenant"
  ON public.turmas FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmin gerencia turmas"
  ON public.turmas FOR ALL
  USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));

-- Tipos de serviço (catálogo padrão)
CREATE TABLE IF NOT EXISTS public.tipos_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL,
  nome TEXT NOT NULL,
  secretaria_slug TEXT NOT NULL,
  descricao TEXT,
  prazo_sla_dias INTEGER NOT NULL DEFAULT 5,
  requer_localizacao BOOLEAN NOT NULL DEFAULT false,
  requer_foto BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tipos_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem catálogo de serviços"
  ON public.tipos_servico FOR SELECT
  USING (
    ativo = true AND (
      tenant_id IS NULL
      OR tenant_id = public.get_user_tenant(auth.uid())
      OR public.is_superadmin(auth.uid())
    )
  );

CREATE POLICY "Superadmin gerencia tipos_servico"
  ON public.tipos_servico FOR ALL
  USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));

-- Benefícios municipais
CREATE TABLE IF NOT EXISTS public.beneficios_municipais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  criterios TEXT,
  link_formulario TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.beneficios_municipais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem benefícios do próprio tenant"
  ON public.beneficios_municipais FOR SELECT
  USING (
    ativo = true AND (
      tenant_id = public.get_user_tenant(auth.uid())
      OR public.is_superadmin(auth.uid())
    )
  );

CREATE POLICY "Prefeito gerencia benefícios"
  ON public.beneficios_municipais FOR ALL
  USING (public.has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id))
  WITH CHECK (public.has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id));

CREATE POLICY "Superadmin gerencia benefícios all"
  ON public.beneficios_municipais FOR ALL
  USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));

-- Avaliações de demandas
CREATE TABLE IF NOT EXISTS public.avaliacoes_demandas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  demanda_id UUID NOT NULL REFERENCES public.demandas(id) ON DELETE CASCADE,
  cidadao_id UUID NOT NULL,
  nota INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(demanda_id, cidadao_id)
);

ALTER TABLE public.avaliacoes_demandas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cidadão gerencia próprias avaliações"
  ON public.avaliacoes_demandas FOR ALL
  USING (cidadao_id = auth.uid())
  WITH CHECK (cidadao_id = auth.uid() AND tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Secretário/Prefeito leem avaliações do tenant"
  ON public.avaliacoes_demandas FOR SELECT
  USING (
    public.has_role_in_tenant(auth.uid(), 'prefeito'::app_role, tenant_id)
    OR public.has_role_in_tenant(auth.uid(), 'secretario'::app_role, tenant_id)
    OR public.is_superadmin(auth.uid())
  );

-- ============================================================
-- SEEDS para o app do cidadão
-- ============================================================

-- 20 tipos de serviço padrão (tenant_id = NULL)
INSERT INTO public.tipos_servico (categoria, nome, secretaria_slug, prazo_sla_dias, requer_localizacao, requer_foto)
SELECT * FROM (VALUES
  ('Infraestrutura',     'Buraco na rua / Pavimentação',           'infraestrutura', 7, true, true),
  ('Infraestrutura',     'Iluminação pública com defeito',         'infraestrutura', 3, true, false),
  ('Infraestrutura',     'Calçada danificada',                     'infraestrutura', 10, true, true),
  ('Infraestrutura',     'Bueiro entupido / Enchente',             'infraestrutura', 2, true, false),
  ('Infraestrutura',     'Sinalização de trânsito danificada',     'infraestrutura', 5, true, false),
  ('Limpeza Urbana',     'Lixo não coletado',                       'infraestrutura', 1, true, false),
  ('Limpeza Urbana',     'Entulho abandonado',                      'infraestrutura', 3, true, true),
  ('Limpeza Urbana',     'Capina / Mato alto',                      'infraestrutura', 7, true, false),
  ('Limpeza Urbana',     'Poda de árvore',                          'infraestrutura', 10, true, false),
  ('Segurança',          'Solicitação de ronda policial',           'seguranca', 1, true, false),
  ('Segurança',          'Iluminação de área de risco',             'seguranca', 3, true, false),
  ('Segurança',          'Câmera de segurança com defeito',         'seguranca', 5, true, false),
  ('Assistência Social', 'Cadastro no CadÚnico',                    'assistencia_social', 5, false, false),
  ('Assistência Social', 'Atualização de dados CadÚnico',           'assistencia_social', 5, false, false),
  ('Assistência Social', 'Solicitação de benefício municipal',      'assistencia_social', 10, false, false),
  ('Saúde',              'Denúncia de problema sanitário',          'saude', 2, true, true),
  ('Saúde',              'Solicitação de visita domiciliar',        'saude', 5, false, false),
  ('Documentação',       'Segunda via de documento municipal',      'infraestrutura', 5, false, false),
  ('Documentação',       'Certidão de imóvel',                      'infraestrutura', 10, false, false),
  ('Ouvidoria',          'Reclamação geral',                         'infraestrutura', 5, false, false)
) AS d(categoria, nome, secretaria_slug, prazo_sla_dias, requer_localizacao, requer_foto)
WHERE NOT EXISTS (SELECT 1 FROM public.tipos_servico WHERE tenant_id IS NULL);

-- 3 UBSs por município
INSERT INTO public.unidades_saude (tenant_id, nome, tipo, endereco, bairro)
SELECT t.id, d.nome, d.tipo, d.endereco, d.bairro
FROM public.tenants t
CROSS JOIN (VALUES
  ('UBS Centro',         'ubs', 'Av. Principal, 100', 'Centro'),
  ('UBS Bairro Novo',    'ubs', 'Rua das Palmeiras, 250', 'Bairro Novo'),
  ('UPA 24h',            'upa', 'Av. Brasil, 1500', 'São José')
) AS d(nome, tipo, endereco, bairro)
WHERE t.tipo = 'municipio'
  AND NOT EXISTS (SELECT 1 FROM public.unidades_saude u WHERE u.tenant_id = t.id);

-- Slots de agenda — gerar 5 slots por unidade, próximos 30 dias
INSERT INTO public.agenda_saude (tenant_id, unidade_id, tipo, especialidade, data_hora, disponivel)
SELECT
  u.tenant_id,
  u.id,
  CASE WHEN gs % 3 = 0 THEN 'consulta' WHEN gs % 3 = 1 THEN 'exame' ELSE 'vacina' END,
  CASE WHEN gs % 3 = 0 THEN
    CASE (gs % 4) WHEN 0 THEN 'Clínica geral' WHEN 1 THEN 'Pediatria' WHEN 2 THEN 'Ginecologia' ELSE 'Cardiologia' END
  END,
  (now() + (gs || ' days')::interval + ((8 + (gs % 8)) || ' hours')::interval),
  true
FROM public.unidades_saude u
CROSS JOIN generate_series(1, 12) AS gs
WHERE NOT EXISTS (SELECT 1 FROM public.agenda_saude a WHERE a.unidade_id = u.id);

-- 2 escolas por município
INSERT INTO public.escolas (tenant_id, nome, bairro, endereco)
SELECT t.id, d.nome, d.bairro, d.endereco
FROM public.tenants t
CROSS JOIN (VALUES
  ('EMEF Padre Anchieta',        'Centro',      'Rua da Escola, 50'),
  ('EMEF Tarsila do Amaral',     'Bairro Novo', 'Av. das Flores, 320')
) AS d(nome, bairro, endereco)
WHERE t.tipo = 'municipio'
  AND NOT EXISTS (SELECT 1 FROM public.escolas e WHERE e.tenant_id = t.id);

-- Turmas para cada escola
INSERT INTO public.turmas (tenant_id, escola_id, serie, turno, vagas_total, vagas_ocupadas, ano_letivo)
SELECT
  e.tenant_id, e.id, d.serie, d.turno, d.vagas_total, d.vagas_ocupadas, 2025
FROM public.escolas e
CROSS JOIN (VALUES
  ('1º ano fundamental', 'manha', 30, 24),
  ('2º ano fundamental', 'manha', 30, 28),
  ('3º ano fundamental', 'tarde', 30, 18),
  ('4º ano fundamental', 'tarde', 30, 25),
  ('5º ano fundamental', 'manha', 30, 26)
) AS d(serie, turno, vagas_total, vagas_ocupadas)
WHERE NOT EXISTS (SELECT 1 FROM public.turmas tu WHERE tu.escola_id = e.id);

-- 3 benefícios fictícios por município
INSERT INTO public.beneficios_municipais (tenant_id, nome, descricao, criterios)
SELECT t.id, d.nome, d.descricao, d.criterios
FROM public.tenants t
CROSS JOIN (VALUES
  ('Auxílio Alimentação Municipal', 'Cesta básica mensal para famílias em vulnerabilidade', 'Renda per capita até 1/2 salário mínimo, cadastro no CadÚnico ativo'),
  ('Passe Livre Escolar',           'Transporte gratuito para estudantes da rede municipal', 'Aluno matriculado na rede municipal, residência a mais de 1km da escola'),
  ('Isenção IPTU Social',           'Isenção do IPTU para imóvel único de família de baixa renda', 'Imóvel único, renda familiar até 2 salários mínimos, inscrição até março')
) AS d(nome, descricao, criterios)
WHERE t.tipo = 'municipio'
  AND NOT EXISTS (SELECT 1 FROM public.beneficios_municipais b WHERE b.tenant_id = t.id);
