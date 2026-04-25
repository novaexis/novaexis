# NovaeXis — Especificação Mestre (SDD)

**Versão:** 1.0
**Data:** Abril 2026
**Método:** Spec-Driven Development (Intent-Driven Engineering)
**Stack:** Lovable (React + TypeScript + shadcn/ui + Tailwind) + Supabase (PostgreSQL + RLS + Edge Functions + Realtime + Storage) + Claude API + Stripe
**Público-alvo:** Prefeituras do Estado do Pará — prefeitos como decisores de compra

---

## 1. Visão Geral do Sistema

### 1.1 Problema

Prefeitos brasileiros, especialmente em municípios de pequeno e médio porte no Pará, operam sem visibilidade consolidada das suas secretarias, perdem prazos críticos de captação de recursos federais e estaduais, não têm ferramentas para comparar sua gestão com municípios similares e não conseguem ouvir a população de forma organizada. Ao mesmo tempo, a população não tem um canal único e digital para acessar serviços municipais, estaduais e federais.

### 1.2 Solução

NovaeXis é uma plataforma SaaS pública integradora em três camadas hierárquicas:

1. **Camada União:** Integração com Gov.br (autenticação, benefícios federais, dados nacionais)
2. **Camada Estadual (NovaeXis Estadual):** Cérebro integrador do Estado do Pará — conecta secretarias estaduais e consolida dados de todos os municípios aderentes. Vendável ao Governo do Estado.
3. **Camada Municipal (NovaeXis Municipal):** Produto principal — painel do prefeito, painéis dos secretários e app do cidadão para cada município aderente.

### 1.3 Proposta de Valor por Perfil

| Perfil | Proposta Central |
|---|---|
| Prefeito | Visão 360° da gestão + IA estratégica + nunca perder prazo de recurso |
| Secretário | Painel setorial + gestão de demandas do cidadão + indicadores |
| Governador | Visão macro do estado + secretarias estaduais + alocação de recursos |
| Cidadão | Um app para todos os serviços municipais, estaduais e federais |

### 1.4 Diferencial Competitivo

- Integração vertical União → Estado → Município em um único produto
- IA estratégica nativa (Claude API) como conselheiro do prefeito
- Benchmark automático entre municípios com dados abertos (IBGE, FIRJAN, IDHM)
- Social Intelligence: monitoramento de redes sociais e reputação da prefeitura
- Login único via Gov.br para todos os cidadãos
- PWA-first para o app do cidadão (funciona em dispositivos simples, conectividade limitada)
- **Integration Hub:** conecta sistemas existentes das secretarias sem substituí-los

---

## 2. Arquitetura Técnica

### 2.1 Stack Completa

```
Frontend:   React 19 + TypeScript + TanStack Start + shadcn/ui + Tailwind v4 + Recharts
PWA:        Vite PWA Plugin + Service Worker + Web Push API
Backend:    Supabase (PostgreSQL 15 + RLS + Edge Functions Deno + Realtime + Storage)
Auth:       Supabase Auth + Gov.br OIDC (login.gov.br) + fallback email/senha
IA:         Lovable AI Gateway (Claude/Gemini) via Supabase Edge Functions
Billing:    Stripe (subscription por município, tiers por porte)
Deploy:     Lovable hosting (frontend) + Supabase cloud (backend)
APIs:       IBGE SIDRA, Portal Transparência, Gov.br OIDC, SIOPE, SIOPS, Diário Oficial
Social:     Meta Graph API, X/Twitter API v2, Google Places API
```

### 2.2 Multi-Tenancy

- Coluna `tenant_id UUID NOT NULL` em todas as tabelas operacionais
- Row Level Security (RLS) ativo — políticas baseadas em `auth.uid()` e `tenant_id`
- Estado do Pará é um tenant especial com `tenant_type = 'estado'`
- Governador tem role `governador` com leitura cross-tenant somente leitura
- Parceiros/revendedores: coluna `reseller_id` no schema desde o início

### 2.3 Roles e Permissões

```
superadmin      → acesso total à plataforma (equipe NovaeXis)
governador      → leitura cross-tenant de todos municípios aderentes
prefeito        → leitura/escrita no próprio tenant, todos os módulos
secretario      → leitura/escrita na própria secretaria do tenant
cidadao         → leitura/escrita nos próprios dados e demandas no tenant
admin_parceiro  → gerencia municípios do seu reseller_id
```

### 2.4 Roteamento de URLs

```
/                         → landing page pública
/login                    → autenticação (Gov.br OIDC ou email/senha)
/cidadao                  → app do cidadão (PWA)
/prefeito                 → dashboard do prefeito
/secretaria/[slug]        → painel do secretário
/governador               → painel do governador
/admin                    → SaaS Admin Panel (superadmin)
/parceiro                 → portal de parceiros
/onboarding               → wizard de cadastro de novo município
/demo, /demo/prefeito, /demo/cidadao, /demo/governador → demo pública read-only
```

---

## 3. Schema de Banco de Dados

### 3.1 Tabelas Core (multi-tenant)

```sql
tenants (id, nome, tipo, estado, ibge_codigo, populacao, idhm, bioma,
         reseller_id, stripe_subscription_id, plano, ativo, created_at)

users (id FK auth.users, tenant_id, role, secretaria_slug, nome,
       cpf, gov_br_sub, reseller_id, created_at)

secretarias (id, tenant_id, slug, nome, secretario_id, ativo)
```

### 3.2 Tabelas Operacionais (cidadão)

```sql
demandas (id, tenant_id, cidadao_id, secretaria_id, tipo, titulo, descricao,
          status, prioridade, latitude, longitude, anexos[],
          created_at, updated_at, prazo_sla, concluida_at)

agendamentos_saude (id, tenant_id, cidadao_id, unidade_saude_id, tipo,
                    especialidade, data_hora, status, observacoes)

matriculas (id, tenant_id, responsavel_id, nome_aluno, data_nascimento,
            escola_id, turno, serie, status, created_at)
```

### 3.3 Tabelas de KPIs e Alertas

```sql
kpis (id, tenant_id, secretaria_slug, indicador, valor, unidade,
      variacao_pct, status, referencia_data, fonte)

alertas_prazos (id, tenant_id, titulo, descricao, tipo, fonte,
                valor_estimado, prazo, status, requisitos JSONB,
                url_edital, criado_automaticamente)
```

### 3.4 Tabela Social Intelligence

```sql
mencoes_sociais (id, tenant_id, plataforma, conteudo, autor, url,
                 sentimento, score_sentimento, temas[], secretarias_impactadas[],
                 alcance, coletado_at, processado_at)

scores_aprovacao (id, tenant_id, data, score, total_mencoes, positivas,
                  negativas, neutras, temas_trending JSONB)
```

### 3.5 Seed de Dados Fictícios

Três municípios fictícios do Pará:
- **Santarinho do Norte** — 8.200 hab, pequeno porte, IDHM 0.521
- **Marajoense** — 42.000 hab, médio porte, IDHM 0.634
- **Nova Belém do Tapajós** — 185.000 hab, grande porte, IDHM 0.712

Cada município com: 6 secretarias, 1 prefeito, 6 secretários, 50 cidadãos, 200 demandas, 90 dias de KPIs históricos, 30 alertas de prazos, 60 dias de menções sociais.

---

## 4. Módulos e Regras de Negócio

### 4.1 App do Cidadão (PWA)

**EARS:**
- QUANDO o cidadão acessa pela primeira vez, o sistema DEVE oferecer login Gov.br como primário
- QUANDO faz login Gov.br, DEVE importar nome, CPF mascarado e NIS via OIDC
- QUANDO solicita serviço, DEVE gerar protocolo `[ANO]-[TENANT]-[SEQUENCIAL]`
- QUANDO status muda, DEVE notificar via push
- SE demanda não respondida em X dias úteis, DEVE elevar para `urgente` e notificar secretário

**Funcionalidades:** Home personalizada, agendamento saúde, matrícula escolar, solicitação de serviços, ouvidoria, rastreio, benefícios federais via Gov.br, perfil, modo offline.

### 4.2 Dashboard do Prefeito

**EARS:**
- DEVE exibir KPIs das 24h de todas secretarias com tendência
- KPI `critico` → alerta no topo + push
- Alertas de prazo <15 dias → destaque vermelho
- IA recebe contexto de 30d de KPIs/alertas/benchmark/social
- Menções negativas >40% → alerta de reputação

**Funcionalidades:** 6 KPI cards, mapa SVG interativo, captação de recursos com countdown, benchmark radar chart, chat IA estratégica, social intelligence, relatório executivo PDF semanal.

### 4.3 Painéis dos Secretários

**EARS:**
- Demanda DEVE ser roteada automaticamente por `tipo`
- Atualização de status DEVE notificar cidadão
- SE urgente sem movimento em 2 dias úteis, DEVE notificar prefeito
- RLS enforced: secretário só vê dados da sua secretaria

**KPIs por secretaria:** saude, educacao, financas, infraestrutura, seguranca, assistencia_social — cada uma com indicadores específicos detalhados na spec.

### 4.4 IA Estratégica (Claude API via Lovable AI Gateway)

Quatro agentes:
- **agente-prefeito:** assessor estratégico municipal
- **agente-benchmark:** comparação com municípios similares
- **agente-captacao:** monitor de editais DOU/Diário PA
- **agente-social:** análise de menções e detecção de crise

### 4.5 Social Intelligence

**EARS:**
- Cron 6h: coletar e armazenar menções
- Score cai >15 pontos vs média 7d → alerta de reputação
- Click em menção negativa → sugestão de resposta IA
- Erro de quota → log isolado, sem cascata

**Fontes:** Meta Graph API, X/Twitter API v2 free, Google Places API, RSS de portais paraenses.

### 4.6 Benchmark Municipal

**Lógica:** mesmo bioma + ±30% população + score IDHM(40%) + receita per capita(30%) + densidade(30%) → top 10 similares.

**Fonte:** IBGE SIDRA + FIRJAN IFDM + SIOPS + SIOPE.

### 4.7 Captação de Recursos

**EARS:**
- Novo edital detectado → `alerta_prazo` automático
- 30 dias do prazo → notificação prefeito
- 7 dias → urgente + notificação diária
- Marcar `em_andamento` → exibir checklist de requisitos

**Fontes:** Portal Transparência, DOU, Diário Oficial PA, FNDE, FNS, MDR, SICONV/Transferegov.

### 4.8 Painel do Governador

**Decisão de design v1.1:** Governador gerencia o **Estado**, não municípios individualmente. NÃO exibe lista de municípios aderentes (informação comercial).

**EARS:**
- DEVE exibir KPIs das 6 secretarias estaduais (SESPA, SEDUC, SEFA, SEGUP, SEINFRA, SEMAS)
- KPI estadual `critico` → alerta no topo
- IA recebe contexto das secretarias estaduais
- Repasses federais com prazo <15 dias → destaque vermelho
- NUNCA expor dados de cidadãos individuais (LGPD)
- NUNCA expor lista de municípios aderentes

**Estrutura espelhada ao painel do prefeito:**
1. KPIs das secretarias estaduais
2. IA estratégica do governador
3. Repasses federais ao Estado (FPE, SUS fundo a fundo, FUNDEB, convênios)
4. Painéis de acesso rápido às secretarias estaduais

**Agente IA estruturado em 3 blocos:** SITUAÇÃO / PROBLEMAS / ESTRATÉGIAS.

### 4.9 Integração de Sistemas Existentes (Integration Hub)

**Princípio:** NovaeXis NÃO substitui sistemas existentes — é o tecido conectivo.

**Quatro estratégias de integração:**

1. **API REST direta** — sistemas com API pública (SIOPE, SIOPS, Transferegov, Betha). Edge Function com cron, zero footprint.
2. **Adaptador ETL (agente leve)** — sistemas com BD acessível (SAGRES, SIAFEM-PA). Agente Node.js/Deno em servidor da secretaria, somente leitura via views SQL.
3. **Conector legado (acesso local)** — sistemas Delphi/Java/Access/FoxPro. Agente Python local com ODBC ou monitoramento de pasta de exportação.
4. **Importação assistida por IA** — Excel/CSV/PDF via upload. Claude identifica colunas, secretário confirma mapeamento, sistema aprende.

**Motor de cruzamento de dados (núcleo do valor):**

Detecta padrões impossíveis de ver em sistemas isolados:
- Saúde + Educação: surto de diarreia × frequência escolar
- Finanças + Infraestrutura: contratos vencendo × execução baixa
- Assistência + Saúde + Educação: famílias vulneráveis multidimensionais
- Segurança + Infraestrutura: ocorrências noturnas × iluminação pendente

**Tabelas adicionais:** `integradores`, `sync_logs`, `mapeamentos_importacao`, `insights_cruzados`.

**Painéis:**
- Prefeito → aba "Integrações": status de conectores + feed de insights cruzados
- Secretário → aba "Dados": status do conector + importação manual + mapeamentos aprendidos

**Prioridade de implementação:** Estratégia 4 → 1 → 2 → motor de cruzamento.

---

## 5. Integrações Externas

| Serviço | Endpoint | Uso |
|---------|----------|-----|
| Gov.br OIDC | `sso.acesso.gov.br` | Auth + claims (sub, name, email, cpf) |
| IBGE SIDRA | `servicodados.ibge.gov.br/api/v3/agregados` | Benchmark, dados abertos |
| Portal Transparência | `api.portaldatransparencia.gov.br` | Convênios e emendas |
| Meta Graph API | `graph.facebook.com/v19.0` | Páginas públicas (LGPD compliant) |
| Google Places | `maps.googleapis.com/maps/api/place` | Reviews da prefeitura |
| X/Twitter API v2 | free tier | Menções públicas |

---

## 6. Histórias de Usuário

**Cidadão (US-C01–C08):** Login Gov.br, agendamento UBS, matrícula escolar, solicitação de serviços, ouvidoria, benefícios federais, notificações, modo offline.

**Prefeito (US-P01–P08):** Visão consolidada, alertas críticos, captação de recursos, benchmark, IA estratégica, social listening, alerta de crise, mapa municipal.

**Secretário (US-S01–S06):** Lista de demandas, atualização com notificação automática, comparação temporal de indicadores, agendas (saúde), matrículas (educação), execução orçamentária (finanças).

**Governador (US-G01–G03):** Mapa do Pará, identificação de municípios críticos, alocação de recursos estaduais.

---

## 7. Plano de Desenvolvimento por Blocos (SDD)

### Bloco 1 — Fundação e Autenticação
- Setup React/TS/Vite/shadcn + design system institucional (azul #1B4F8A, verde Pará #2D8A5F, amarelo #F5A623)
- Schema + RLS + Gov.br OIDC + fallback email/senha
- Seed de 3 municípios fictícios

### Bloco 2 — App do Cidadão PWA
- PWA + home personalizada + bottom nav
- Agendamento saúde + matrícula escolar
- Serviços + ouvidoria + Realtime
- Benefícios + modo offline + push notifications

### Bloco 3 — Painel do Prefeito
- Dashboard com 6 KPI cards + gráfico 30d
- Mapa SVG + captação de recursos
- Benchmark radar + chat IA
- Acesso cross-secretaria + relatório PDF

### Bloco 4 — Painéis dos Secretários
- 6 painéis setoriais (saúde, educação, finanças, infra, segurança, assistência)
- KPIs específicos + lista de demandas + ações + exports

### Bloco 4.5 — Integration Hub (NOVO)
- Tabelas de integração + painel de status
- Estratégia 4 (importação assistida) primeiro
- Estratégia 1 (APIs públicas)
- Agente ETL (repo separado)
- Motor de cruzamento + Claude API

### Bloco 5 — Edge Functions de IA
- agente-prefeito, benchmark-automatico, monitor-prazos
- Crons configurados via pg_cron

### Bloco 6 — Social Intelligence
- Painel de reputação + drill-down + sugestão de resposta
- Edge function social-intel-coletor (cron 6h)
- Configuração de fontes por município

### Bloco 7 — NovaeXis Estadual + Governador
- Schema estado + views materializadas
- Mapa do Pará SVG (144 municípios)
- Dashboard do governador (espelhado ao prefeito)
- Comunicados do governador

### Bloco 8 — SaaS Admin + Go-to-Market
- Admin panel (CRUD tenants, billing, métricas)
- Stripe billing (Básico R$490, Completo R$990, Estado R$4.900)
- Onboarding de novo município (wizard)
- Portal do parceiro/revendedor

---

## 8. Padrões de Engenharia

### Segurança
- ✅ Roles em tabela separada (`user_roles`), nunca em `profiles`
- ✅ RLS habilitado em todas as tabelas multi-tenant
- ✅ Funções `SECURITY DEFINER` com `search_path = public`
- ✅ Auditoria via `audit_logs`
- ✅ Secrets em Lovable Cloud (nunca em código)
- ✅ Rate limiting via `check_rate_limit`

### Frontend
- TanStack Start file-based routing em `src/routes/`
- TypeScript estrito (`strict: true`)
- Tokens semânticos do design system em `src/styles.css` (oklch)
- Toda rota com loader DEVE ter `errorComponent` e `notFoundComponent`
- Componentes pequenos e focados

### Edge Functions
- Compatível com Deno + Cloudflare Workers
- Sem Node-only packages
- Validação Zod em inputs
- Logs estruturados

---

**Última atualização:** Abril 2026
**Mantido por:** Equipe NovaeXis + Lovable AI
