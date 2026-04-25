INSERT INTO public.fontes_monitoramento (tenant_id, plataforma, identificador, nome_exibicao, ativo)
SELECT t.id, d.plataforma::plataforma_social, d.identificador, d.nome_exibicao, d.ativo
FROM tenants t
CROSS JOIN (VALUES
  ('facebook'::text,    'prefeitura.exemplo',          'Prefeitura no Facebook',      true),
  ('instagram',  '@prefeituraexemplo',          'Prefeitura no Instagram',     true),
  ('twitter',    '@prefexemplo',                'Prefeitura no X/Twitter',     true),
  ('google_maps','ChIJXXXXXXXXXXXXXXXXXXXXXXXX','Prefeitura no Google Maps',   true),
  ('noticias',   'https://exemplo.com.br/feed', 'Portal Local — RSS',          true),
  ('youtube',    'UCxxxxxxxxxxxxxxxxxx',        'Canal da Prefeitura YouTube', false),
  ('tiktok',     '@prefexemplo',                'Prefeitura no TikTok',        false)
) AS d(plataforma, identificador, nome_exibicao, ativo)
WHERE t.tipo = 'municipio'
ON CONFLICT (tenant_id, plataforma) DO NOTHING;