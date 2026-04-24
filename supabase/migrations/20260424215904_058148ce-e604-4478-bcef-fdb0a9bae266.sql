-- =====================================================================
-- NovaeXis — Bloco 1: Schema multi-tenant + RLS
-- =====================================================================

-- ---------- ENUMS ----------
CREATE TYPE public.app_role AS ENUM (
  'superadmin', 'governador', 'prefeito', 'secretario', 'cidadao', 'admin_parceiro'
);

CREATE TYPE public.tenant_tipo AS ENUM ('municipio', 'estado');
CREATE TYPE public.tenant_plano AS ENUM ('basico', 'completo', 'estado');

CREATE TYPE public.demanda_tipo AS ENUM ('servico', 'reclamacao', 'sugestao', 'seguranca', 'elogio');
CREATE TYPE public.demanda_status AS ENUM ('aberta', 'em_analise', 'em_andamento', 'concluida', 'rejeitada');
CREATE TYPE public.demanda_prioridade AS ENUM ('baixa', 'media', 'alta', 'urgente');

CREATE TYPE public.kpi_status AS ENUM ('ok', 'atencao', 'critico');
CREATE TYPE public.alerta_tipo AS ENUM ('recurso_federal', 'recurso_estadual', 'obrigacao_legal', 'licitacao', 'comunicado_estado');
CREATE TYPE public.alerta_status AS ENUM ('disponivel', 'em_andamento', 'perdido', 'captado');
CREATE TYPE public.plataforma_social AS ENUM ('facebook', 'instagram', 'twitter', 'google_maps', 'noticias');
CREATE TYPE public.sentimento AS ENUM ('positivo', 'negativo', 'neutro');
CREATE TYPE public.agendamento_status AS ENUM ('agendado', 'confirmado', 'realizado', 'cancelado', 'faltou');
CREATE TYPE public.matricula_status AS ENUM ('solicitada', 'em_analise', 'deferida', 'indeferida');

-- ---------- TIMESTAMP HELPER ----------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ---------- TENANTS ----------
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tipo public.tenant_tipo NOT NULL DEFAULT 'municipio',
  estado TEXT NOT NULL DEFAULT 'PA',
  ibge_codigo TEXT UNIQUE,
  populacao INTEGER,
  idhm NUMERIC(4,3),
  bioma TEXT,
  reseller_id UUID,
  stripe_subscription_id TEXT,
  plano public.tenant_plano DEFAULT 'basico',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- PROFILES ----------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  nome TEXT,
  cpf_mascarado TEXT,
  gov_br_sub TEXT,
  email TEXT,
  telefone TEXT,
  reseller_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- USER ROLES (separated for security) ----------
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  secretaria_slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id, role, secretaria_slug)
);

CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_tenant ON public.user_roles(tenant_id);

-- ---------- SECURITY DEFINER HELPERS ----------
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_role_in_tenant(_user_id UUID, _role public.app_role, _tenant UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND tenant_id = _tenant
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_tenant(_user_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.profiles WHERE id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_user_secretaria_slug(_user_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT secretaria_slug FROM public.user_roles
  WHERE user_id = _user_id AND role = 'secretario' LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'superadmin')
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- SECRETARIAS ----------
CREATE TABLE public.secretarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  nome TEXT NOT NULL,
  secretario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

-- ---------- DEMANDAS ----------
CREATE TABLE public.demandas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cidadao_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  secretaria_slug TEXT NOT NULL,
  protocolo TEXT NOT NULL UNIQUE,
  tipo public.demanda_tipo NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status public.demanda_status NOT NULL DEFAULT 'aberta',
  prioridade public.demanda_prioridade NOT NULL DEFAULT 'media',
  latitude NUMERIC, longitude NUMERIC,
  endereco TEXT,
  anexos TEXT[],
  prazo_sla TIMESTAMPTZ,
  concluida_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_demandas_tenant ON public.demandas(tenant_id);
CREATE INDEX idx_demandas_cidadao ON public.demandas(cidadao_id);
CREATE INDEX idx_demandas_secretaria ON public.demandas(tenant_id, secretaria_slug);
CREATE INDEX idx_demandas_status ON public.demandas(tenant_id, status);

CREATE TRIGGER trg_demandas_updated BEFORE UPDATE ON public.demandas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- AGENDAMENTOS DE SAÚDE ----------
CREATE TABLE public.agendamentos_saude (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cidadao_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  unidade_saude TEXT NOT NULL,
  tipo TEXT NOT NULL,
  especialidade TEXT,
  data_hora TIMESTAMPTZ NOT NULL,
  status public.agendamento_status NOT NULL DEFAULT 'agendado',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agend_tenant ON public.agendamentos_saude(tenant_id);
CREATE INDEX idx_agend_cidadao ON public.agendamentos_saude(cidadao_id);

-- ---------- MATRICULAS ----------
CREATE TABLE public.matriculas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nome_aluno TEXT NOT NULL,
  data_nascimento DATE,
  escola TEXT NOT NULL,
  turno TEXT,
  serie TEXT,
  status public.matricula_status NOT NULL DEFAULT 'solicitada',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_matr_tenant ON public.matriculas(tenant_id);
CREATE INDEX idx_matr_responsavel ON public.matriculas(responsavel_id);

-- ---------- KPIS ----------
CREATE TABLE public.kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  secretaria_slug TEXT NOT NULL,
  indicador TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  unidade TEXT,
  variacao_pct NUMERIC,
  status public.kpi_status NOT NULL DEFAULT 'ok',
  referencia_data DATE NOT NULL,
  fonte TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kpis_tenant_data ON public.kpis(tenant_id, referencia_data DESC);
CREATE INDEX idx_kpis_secretaria ON public.kpis(tenant_id, secretaria_slug, referencia_data DESC);

-- ---------- ALERTAS DE PRAZOS ----------
CREATE TABLE public.alertas_prazos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo public.alerta_tipo NOT NULL,
  fonte TEXT,
  valor_estimado NUMERIC,
  prazo DATE,
  status public.alerta_status NOT NULL DEFAULT 'disponivel',
  requisitos JSONB DEFAULT '[]'::jsonb,
  url_edital TEXT,
  criado_automaticamente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alertas_tenant_prazo ON public.alertas_prazos(tenant_id, prazo);

CREATE TRIGGER trg_alertas_updated BEFORE UPDATE ON public.alertas_prazos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- MENCOES SOCIAIS ----------
CREATE TABLE public.mencoes_sociais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plataforma public.plataforma_social NOT NULL,
  conteudo TEXT NOT NULL,
  autor TEXT,
  url TEXT,
  sentimento public.sentimento,
  score_sentimento NUMERIC(3,2),
  temas TEXT[],
  secretarias_impactadas TEXT[],
  alcance INTEGER,
  coletado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processado_at TIMESTAMPTZ
);

CREATE INDEX idx_mencoes_tenant ON public.mencoes_sociais(tenant_id, coletado_at DESC);

-- ---------- SCORES APROVACAO ----------
CREATE TABLE public.scores_aprovacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  total_mencoes INTEGER NOT NULL DEFAULT 0,
  positivas INTEGER NOT NULL DEFAULT 0,
  negativas INTEGER NOT NULL DEFAULT 0,
  neutras INTEGER NOT NULL DEFAULT 0,
  temas_trending JSONB DEFAULT '[]'::jsonb,
  UNIQUE (tenant_id, data)
);

CREATE INDEX idx_scores_tenant_data ON public.scores_aprovacao(tenant_id, data DESC);

-- =====================================================================
-- RLS POLICIES
-- =====================================================================

-- TENANTS: leitura pública (necessário p/ login + benchmark); escrita só superadmin
CREATE POLICY "Tenants são públicos para leitura" ON public.tenants
  FOR SELECT USING (true);
CREATE POLICY "Superadmin gerencia tenants" ON public.tenants
  FOR ALL USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

-- PROFILES
CREATE POLICY "Usuário vê próprio perfil" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Usuário atualiza próprio perfil" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Superadmin vê todos perfis" ON public.profiles
  FOR SELECT USING (public.is_superadmin(auth.uid()));
CREATE POLICY "Prefeito vê perfis do município" ON public.profiles
  FOR SELECT USING (
    public.has_role_in_tenant(auth.uid(), 'prefeito', tenant_id)
    OR public.has_role_in_tenant(auth.uid(), 'secretario', tenant_id)
  );
CREATE POLICY "Insert profile próprio" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- USER_ROLES
CREATE POLICY "Usuário lê próprias roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Superadmin gerencia roles" ON public.user_roles
  FOR ALL USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));
CREATE POLICY "Prefeito gerencia roles no município" ON public.user_roles
  FOR ALL USING (public.has_role_in_tenant(auth.uid(), 'prefeito', tenant_id))
  WITH CHECK (public.has_role_in_tenant(auth.uid(), 'prefeito', tenant_id));

-- SECRETARIAS
CREATE POLICY "Secretarias visíveis para todos autenticados" ON public.secretarias
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Prefeito gerencia secretarias" ON public.secretarias
  FOR ALL USING (public.has_role_in_tenant(auth.uid(), 'prefeito', tenant_id))
  WITH CHECK (public.has_role_in_tenant(auth.uid(), 'prefeito', tenant_id));
CREATE POLICY "Superadmin gerencia secretarias" ON public.secretarias
  FOR ALL USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

-- DEMANDAS
CREATE POLICY "Cidadão vê próprias demandas" ON public.demandas
  FOR SELECT USING (auth.uid() = cidadao_id);
CREATE POLICY "Cidadão cria demandas no próprio tenant" ON public.demandas
  FOR INSERT WITH CHECK (
    auth.uid() = cidadao_id AND tenant_id = public.get_user_tenant(auth.uid())
  );
CREATE POLICY "Prefeito vê demandas do município" ON public.demandas
  FOR SELECT USING (public.has_role_in_tenant(auth.uid(), 'prefeito', tenant_id));
CREATE POLICY "Prefeito atualiza demandas do município" ON public.demandas
  FOR UPDATE USING (public.has_role_in_tenant(auth.uid(), 'prefeito', tenant_id));
CREATE POLICY "Secretário vê demandas da sua secretaria" ON public.demandas
  FOR SELECT USING (
    public.has_role_in_tenant(auth.uid(), 'secretario', tenant_id)
    AND secretaria_slug = public.get_user_secretaria_slug(auth.uid())
  );
CREATE POLICY "Secretário atualiza demandas da sua secretaria" ON public.demandas
  FOR UPDATE USING (
    public.has_role_in_tenant(auth.uid(), 'secretario', tenant_id)
    AND secretaria_slug = public.get_user_secretaria_slug(auth.uid())
  );
CREATE POLICY "Superadmin vê todas demandas" ON public.demandas
  FOR ALL USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

-- AGENDAMENTOS_SAUDE
CREATE POLICY "Cidadão vê próprios agendamentos" ON public.agendamentos_saude
  FOR SELECT USING (auth.uid() = cidadao_id);
CREATE POLICY "Cidadão cria agendamentos" ON public.agendamentos_saude
  FOR INSERT WITH CHECK (
    auth.uid() = cidadao_id AND tenant_id = public.get_user_tenant(auth.uid())
  );
CREATE POLICY "Cidadão cancela próprios agendamentos" ON public.agendamentos_saude
  FOR UPDATE USING (auth.uid() = cidadao_id);
CREATE POLICY "Prefeito vê agendamentos do município" ON public.agendamentos_saude
  FOR SELECT USING (public.has_role_in_tenant(auth.uid(), 'prefeito', tenant_id));
CREATE POLICY "Secretário saúde vê agendamentos" ON public.agendamentos_saude
  FOR ALL USING (
    public.has_role_in_tenant(auth.uid(), 'secretario', tenant_id)
    AND public.get_user_secretaria_slug(auth.uid()) = 'saude'
  );

-- MATRICULAS
CREATE POLICY "Responsável vê próprias matrículas" ON public.matriculas
  FOR SELECT USING (auth.uid() = responsavel_id);
CREATE POLICY "Responsável cria matrículas" ON public.matriculas
  FOR INSERT WITH CHECK (
    auth.uid() = responsavel_id AND tenant_id = public.get_user_tenant(auth.uid())
  );
CREATE POLICY "Prefeito vê matrículas do município" ON public.matriculas
  FOR SELECT USING (public.has_role_in_tenant(auth.uid(), 'prefeito', tenant_id));
CREATE POLICY "Secretário educação gerencia matrículas" ON public.matriculas
  FOR ALL USING (
    public.has_role_in_tenant(auth.uid(), 'secretario', tenant_id)
    AND public.get_user_secretaria_slug(auth.uid()) = 'educacao'
  );

-- KPIS
CREATE POLICY "Autenticados leem KPIs do próprio tenant" ON public.kpis
  FOR SELECT TO authenticated USING (
    tenant_id = public.get_user_tenant(auth.uid())
    OR public.is_superadmin(auth.uid())
    OR public.has_role(auth.uid(), 'governador')
  );
CREATE POLICY "Prefeito gerencia KPIs" ON public.kpis
  FOR ALL USING (public.has_role_in_tenant(auth.uid(), 'prefeito', tenant_id))
  WITH CHECK (public.has_role_in_tenant(auth.uid(), 'prefeito', tenant_id));
CREATE POLICY "Superadmin gerencia KPIs" ON public.kpis
  FOR ALL USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

-- ALERTAS_PRAZOS
CREATE POLICY "Município vê próprios alertas" ON public.alertas_prazos
  FOR SELECT TO authenticated USING (
    tenant_id = public.get_user_tenant(auth.uid())
    OR public.is_superadmin(auth.uid())
    OR public.has_role(auth.uid(), 'governador')
  );
CREATE POLICY "Prefeito gerencia alertas" ON public.alertas_prazos
  FOR ALL USING (public.has_role_in_tenant(auth.uid(), 'prefeito', tenant_id))
  WITH CHECK (public.has_role_in_tenant(auth.uid(), 'prefeito', tenant_id));
CREATE POLICY "Superadmin gerencia alertas" ON public.alertas_prazos
  FOR ALL USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

-- MENCOES_SOCIAIS
CREATE POLICY "Município vê próprias menções" ON public.mencoes_sociais
  FOR SELECT TO authenticated USING (
    tenant_id = public.get_user_tenant(auth.uid())
    OR public.is_superadmin(auth.uid())
  );
CREATE POLICY "Superadmin gerencia menções" ON public.mencoes_sociais
  FOR ALL USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

-- SCORES_APROVACAO
CREATE POLICY "Município vê próprios scores" ON public.scores_aprovacao
  FOR SELECT TO authenticated USING (
    tenant_id = public.get_user_tenant(auth.uid())
    OR public.is_superadmin(auth.uid())
    OR public.has_role(auth.uid(), 'governador')
  );
CREATE POLICY "Superadmin gerencia scores" ON public.scores_aprovacao
  FOR ALL USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));