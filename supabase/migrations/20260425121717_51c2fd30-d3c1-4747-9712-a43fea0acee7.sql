-- Configurações globais (key/value JSON)
CREATE TABLE public.platform_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chave text NOT NULL UNIQUE,
  valor jsonb NOT NULL DEFAULT '{}'::jsonb,
  descricao text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TRIGGER platform_settings_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem settings"
ON public.platform_settings
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Superadmin gerencia settings"
ON public.platform_settings
FOR ALL
USING (public.is_superadmin(auth.uid()))
WITH CHECK (public.is_superadmin(auth.uid()));

-- Feature flags
CREATE TABLE public.feature_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chave text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  habilitada boolean NOT NULL DEFAULT false,
  planos_permitidos text[] DEFAULT ARRAY['basico','completo','estado']::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TRIGGER feature_flags_updated_at
BEFORE UPDATE ON public.feature_flags
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem feature flags"
ON public.feature_flags
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Superadmin gerencia feature flags"
ON public.feature_flags
FOR ALL
USING (public.is_superadmin(auth.uid()))
WITH CHECK (public.is_superadmin(auth.uid()));

-- Limites por plano
CREATE TABLE public.plan_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plano tenant_plano NOT NULL,
  chave text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  descricao text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (plano, chave)
);

CREATE TRIGGER plan_limits_updated_at
BEFORE UPDATE ON public.plan_limits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem plan limits"
ON public.plan_limits
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Superadmin gerencia plan limits"
ON public.plan_limits
FOR ALL
USING (public.is_superadmin(auth.uid()))
WITH CHECK (public.is_superadmin(auth.uid()));

-- Seeds iniciais
INSERT INTO public.platform_settings (chave, valor, descricao) VALUES
  ('manutencao', '{"ativo": false, "mensagem": ""}'::jsonb, 'Modo manutenção global'),
  ('banner_global', '{"ativo": false, "mensagem": "", "tipo": "info"}'::jsonb, 'Banner exibido para todos os usuários'),
  ('signup_aberto', '{"ativo": true}'::jsonb, 'Permite cadastro público de novos cidadãos')
ON CONFLICT (chave) DO NOTHING;

INSERT INTO public.feature_flags (chave, nome, descricao, habilitada, planos_permitidos) VALUES
  ('chat_ia_governador', 'Chat IA Governador', 'Assistente IA para o painel do governador', true, ARRAY['estado']),
  ('briefing_semanal', 'Briefing semanal', 'Geração automática de briefing semanal por IA', true, ARRAY['completo','estado']),
  ('captacao_recursos', 'Captação de recursos', 'Módulo de captação de recursos federais/estaduais', true, ARRAY['completo','estado']),
  ('benchmark_municipios', 'Benchmark', 'Comparativo entre municípios', true, ARRAY['completo','estado']),
  ('analise_social', 'Análise de redes sociais', 'Monitoramento de menções e sentimento', false, ARRAY['estado'])
ON CONFLICT (chave) DO NOTHING;

INSERT INTO public.plan_limits (plano, chave, valor, descricao) VALUES
  ('basico', 'usuarios_max', 10, 'Máximo de usuários ativos'),
  ('basico', 'demandas_mes', 500, 'Demandas por mês'),
  ('basico', 'storage_mb', 1024, 'Armazenamento em MB'),
  ('completo', 'usuarios_max', 50, 'Máximo de usuários ativos'),
  ('completo', 'demandas_mes', 5000, 'Demandas por mês'),
  ('completo', 'storage_mb', 10240, 'Armazenamento em MB'),
  ('estado', 'usuarios_max', 500, 'Máximo de usuários ativos'),
  ('estado', 'demandas_mes', 100000, 'Demandas por mês'),
  ('estado', 'storage_mb', 102400, 'Armazenamento em MB')
ON CONFLICT (plano, chave) DO NOTHING;