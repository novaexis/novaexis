
DROP VIEW IF EXISTS public.tenants_public;

CREATE VIEW public.tenants_public
WITH (security_invoker = true) AS
SELECT id, nome, slug, estado, tipo, ibge_codigo, populacao, idhm, bioma, ativo
FROM public.tenants
WHERE ativo = true;

GRANT SELECT ON public.tenants_public TO anon, authenticated;
