
DELETE FROM mencoes_sociais;
DELETE FROM scores_aprovacao;

WITH municipios AS (
  SELECT id, slug FROM tenants WHERE tipo='municipio'
),
mencoes_template AS (
  SELECT * FROM (VALUES
    ('twitter'::plataforma_social, 'Finalmente asfaltaram a rua principal! Obrigado prefeitura', '@joao_silva', 'positivo'::sentimento, 0.85, ARRAY['infraestrutura','obras'], ARRAY['infraestrutura'], 1200),
    ('facebook'::plataforma_social, 'UBS do bairro sem médico há 3 semanas, isso é absurdo!', 'Maria Santos', 'negativo'::sentimento, -0.78, ARRAY['saúde','ubs'], ARRAY['saude'], 3400),
    ('twitter'::plataforma_social, 'Escola nova ficou linda, meus filhos amaram', '@mae_orgulhosa', 'positivo'::sentimento, 0.92, ARRAY['educação','escola'], ARRAY['educacao'], 850),
    ('instagram'::plataforma_social, 'Buracos na avenida central destruindo os carros', '@motorista_pa', 'negativo'::sentimento, -0.65, ARRAY['infraestrutura','buracos'], ARRAY['infraestrutura'], 2100),
    ('google_maps'::plataforma_social, 'UBS bem organizada, atendimento rápido', 'Avaliação Google', 'positivo'::sentimento, 0.7, ARRAY['saúde','ubs'], ARRAY['saude'], 450),
    ('noticias'::plataforma_social, 'Município recebe verba federal para nova ponte', 'Diário do Pará', 'positivo'::sentimento, 0.6, ARRAY['captação','obras'], ARRAY['infraestrutura'], 8500),
    ('twitter'::plataforma_social, 'Fila no posto de saúde desde 5h da manhã', '@cidadao_revoltado', 'negativo'::sentimento, -0.82, ARRAY['saúde','ubs'], ARRAY['saude'], 1800),
    ('facebook'::plataforma_social, 'Programa de merenda escolar excelente, parabéns', 'Comunidade Escolar', 'positivo'::sentimento, 0.88, ARRAY['educação','merenda'], ARRAY['educacao'], 1650),
    ('twitter'::plataforma_social, 'Iluminação pública apagada há semanas no nosso bairro', '@vizinho_preocupado', 'negativo'::sentimento, -0.7, ARRAY['infraestrutura','iluminação'], ARRAY['infraestrutura'], 980),
    ('instagram'::plataforma_social, 'Praça reformada ficou maravilhosa!', '@familia_local', 'positivo'::sentimento, 0.9, ARRAY['lazer','obras'], ARRAY['infraestrutura'], 2300),
    ('twitter'::plataforma_social, 'Quando vão resolver o problema do esgoto na vila?', '@morador_vila', 'negativo'::sentimento, -0.75, ARRAY['saneamento','saúde'], ARRAY['infraestrutura','saude'], 1100),
    ('facebook'::plataforma_social, 'Vacinação no posto foi rápida e bem organizada', 'Avó Cuidadosa', 'positivo'::sentimento, 0.8, ARRAY['saúde','vacinação'], ARRAY['saude'], 720),
    ('noticias'::plataforma_social, 'Prefeitura anuncia mutirão de matrículas para 2026', 'Portal Local', 'neutro'::sentimento, 0.1, ARRAY['educação','matrículas'], ARRAY['educacao'], 4200),
    ('google_maps'::plataforma_social, 'Feira municipal suja e mal cuidada', 'Visitante', 'negativo'::sentimento, -0.6, ARRAY['limpeza'], ARRAY['meio-ambiente'], 320),
    ('twitter'::plataforma_social, 'App da prefeitura facilitou minha vida, parabéns!', '@tecnologia_top', 'positivo'::sentimento, 0.85, ARRAY['inovação','digital'], ARRAY['administracao'], 1450),
    ('instagram'::plataforma_social, 'Hospital sem medicamento básico de novo', '@paciente_cronico', 'negativo'::sentimento, -0.85, ARRAY['saúde','medicamentos'], ARRAY['saude'], 2700),
    ('facebook'::plataforma_social, 'Aulas de reforço transformaram meu filho', 'Pai Grato', 'positivo'::sentimento, 0.9, ARRAY['educação'], ARRAY['educacao'], 890),
    ('twitter'::plataforma_social, 'Trânsito caótico, faltam agentes nas ruas', '@motorista_diario', 'negativo'::sentimento, -0.55, ARRAY['trânsito','segurança'], ARRAY['seguranca'], 1300),
    ('noticias'::plataforma_social, 'Cidade ganha prêmio estadual de gestão fiscal', 'Folha do Pará', 'positivo'::sentimento, 0.75, ARRAY['gestão','fiscal'], ARRAY['administracao','fazenda'], 6800),
    ('twitter'::plataforma_social, 'Coleta seletiva é uma piada aqui', '@ambientalista', 'negativo'::sentimento, -0.7, ARRAY['meio ambiente','reciclagem'], ARRAY['meio-ambiente'], 950)
  ) AS t(plat, conteudo, autor, sent, score, temas, secs, alc)
)
INSERT INTO mencoes_sociais (tenant_id, plataforma, conteudo, autor, sentimento, score_sentimento, temas, secretarias_impactadas, alcance, coletado_at, processado_at)
SELECT m.id, mt.plat, mt.conteudo, mt.autor, mt.sent, mt.score, mt.temas, mt.secs, mt.alc,
       NOW() - (random() * INTERVAL '14 days'),
       NOW() - (random() * INTERVAL '13 days')
FROM municipios m CROSS JOIN mencoes_template mt
WHERE random() > 0.25;

INSERT INTO scores_aprovacao (tenant_id, data, score, positivas, negativas, neutras, total_mencoes, temas_trending)
SELECT 
  t.id,
  CURRENT_DATE - (gs.day || ' days')::interval,
  GREATEST(20, LEAST(95, 
    CASE t.slug
      WHEN 'santarinho-do-norte' THEN 72 + (random() * 8 - 4) - (gs.day * 0.15)
      WHEN 'marajoense' THEN 58 + (random() * 10 - 5) + (gs.day * 0.1)
      ELSE 65 + (random() * 6 - 3)
    END
  ))::numeric(5,2),
  (15 + random() * 20)::int,
  (8 + random() * 15)::int,
  (5 + random() * 10)::int,
  (40 + random() * 30)::int,
  CASE (gs.day % 4)
    WHEN 0 THEN '[{"tema":"saúde","mencoes":24,"sentimento":-0.4},{"tema":"educação","mencoes":18,"sentimento":0.6},{"tema":"infraestrutura","mencoes":15,"sentimento":-0.2}]'::jsonb
    WHEN 1 THEN '[{"tema":"obras","mencoes":22,"sentimento":0.5},{"tema":"saúde","mencoes":20,"sentimento":-0.3},{"tema":"limpeza","mencoes":12,"sentimento":0.1}]'::jsonb
    WHEN 2 THEN '[{"tema":"educação","mencoes":28,"sentimento":0.7},{"tema":"trânsito","mencoes":14,"sentimento":-0.5},{"tema":"saúde","mencoes":11,"sentimento":-0.2}]'::jsonb
    ELSE '[{"tema":"infraestrutura","mencoes":26,"sentimento":0.3},{"tema":"saúde","mencoes":19,"sentimento":-0.4},{"tema":"meio ambiente","mencoes":10,"sentimento":0.2}]'::jsonb
  END
FROM tenants t
CROSS JOIN generate_series(0, 29) AS gs(day)
WHERE t.tipo = 'municipio';
