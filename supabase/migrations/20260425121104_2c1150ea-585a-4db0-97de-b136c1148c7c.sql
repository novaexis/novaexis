-- Tabela de resellers
CREATE TABLE public.resellers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  email_contato text,
  telefone text,
  ativo boolean NOT NULL DEFAULT true,
  comissao_pct numeric(5,2) DEFAULT 0,
  cor_primaria text,
  logo_url text,
  dominio_customizado text,
  rodape_texto text,
  observacoes text
);

CREATE INDEX idx_resellers_slug ON public.resellers (slug);
CREATE INDEX idx_resellers_dominio ON public.resellers (dominio_customizado);

ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;

-- Função: retorna o reseller_id do usuário (via profiles)
CREATE OR REPLACE FUNCTION public.get_user_reseller(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT reseller_id FROM public.profiles WHERE id = _user_id LIMIT 1
$$;

CREATE POLICY "Superadmin gerencia resellers"
ON public.resellers
FOR ALL
USING (public.is_superadmin(auth.uid()))
WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Reseller vê próprio cadastro"
ON public.resellers
FOR SELECT
USING (id = public.get_user_reseller(auth.uid()));

CREATE POLICY "Reseller atualiza próprio cadastro"
ON public.resellers
FOR UPDATE
USING (id = public.get_user_reseller(auth.uid()))
WITH CHECK (id = public.get_user_reseller(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER resellers_updated_at
BEFORE UPDATE ON public.resellers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();