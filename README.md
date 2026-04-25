# NovaeXis — Sistema Mestre

Plataforma SaaS multi-tenant para gestão pública municipal e estadual, com portais dedicados para Cidadão, Prefeito, Governador, Secretarias e Parceiros Comerciais.

---

## 📑 Índice

1. [Visão Geral](#-visão-geral)
2. [Arquitetura Técnica](#-arquitetura-técnica)
3. [Portais e Rotas](#-portais-e-rotas)
4. [Banco de Dados (Lovable Cloud)](#-banco-de-dados-lovable-cloud)
5. [Edge Functions](#-edge-functions)
6. [Sistema de Notificações](#-sistema-de-notificações)
7. [Portal do Parceiro](#-portal-do-parceiro)
8. [Demo Pública](#-demo-pública-read-only)
9. [Diagnóstico e Estabilidade](#-diagnóstico-e-estabilidade)
10. [Scripts e Comandos](#-scripts-e-comandos)

---

## 🎯 Visão Geral

NovaeXis conecta todos os atores do ecossistema público:

- **Cidadão**: agendamentos, ouvidoria, serviços, demandas
- **Prefeito**: dashboard executivo, captação de recursos, IA, relatórios, social listening
- **Governador**: visão estadual, comunicados, repasses, benchmark de municípios
- **Secretarias**: módulos por área (Saúde, Educação, Finanças, Infraestrutura, Segurança, Assistência)
- **Parceiros**: portal comercial com indicações, comissões e CRM
- **Admin**: gestão global de tenants, usuários, billing, auditoria

---

## 🏗️ Arquitetura Técnica

### Stack
- **Framework**: TanStack Start v1 (SSR/SSG, React 19)
- **Build**: Vite 7 + Cloudflare Workers (edge runtime)
- **Estilo**: Tailwind CSS v4 com design tokens semânticos (`src/styles.css`)
- **UI**: shadcn/ui + Radix UI primitives
- **Backend**: Lovable Cloud (Supabase) — PostgreSQL + Edge Functions + Auth + Storage
- **IA**: Lovable AI Gateway (modelos para briefings, sugestões, análises)
- **Roteamento**: file-based em `src/routes/`

### Padrões Críticos
- ⚠️ Roles em tabela separada (`user_roles`), nunca em `profiles` (segurança)
- ⚠️ RLS habilitado em todas as tabelas com dados sensíveis
- ⚠️ Funções `SECURITY DEFINER` para checagem de permissões
- ⚠️ Multi-tenant: isolamento via `tenant_id` em policies RLS
- ⚠️ Design system: nunca usar `text-white`, `bg-black` — sempre tokens semânticos

---

## 🚪 Portais e Rotas

| Rota | Descrição |
|------|-----------|
| `/` | Landing page institucional |
| `/login` | Autenticação |
| `/onboarding` | Provisionamento de novo tenant |
| `/cidadao` | Dashboard cidadão (saúde, educação, serviços, ouvidoria) |
| `/prefeito` | Dashboard prefeito (briefing, KPIs, captação, IA, social) |
| `/governador` | Dashboard estadual (municípios, comunicados, repasses) |
| `/secretaria` + `/painel/secretaria/$slug` | Módulos por secretaria |
| `/parceiro` | Portal comercial (leads, comissões, CRM) |
| `/admin` | Painel global (tenants, billing, usuários, auditoria) |
| `/demo`, `/demo/prefeito`, `/demo/cidadao`, `/demo/governador` | Demo pública read-only |

---

## 🗄️ Banco de Dados (Lovable Cloud)

### Tabelas principais
- `profiles` — perfil do usuário (com `notifications_enabled`)
- `user_roles` — roles separadas (admin, prefeito, governador, parceiro, etc.)
- `tenants` — municípios/estados
- `leads_comerciais` — pipeline comercial dos parceiros (com RLS por `reseller_id`)
- `notifications` — central de notificações por usuário
- `municipios`, `resellers`, `audit_logs`, `config_globais`, `billing`
- Tabelas de domínio: `demandas`, `agendamentos_saude`, `matriculas_educacao`, `comunicados_estado`, `repasses`, etc.

### Triggers automáticos
- `handle_lead_status_change` — cria notificação automática quando status de lead muda
- Triggers de auditoria para alterações sensíveis

---

## ⚡ Edge Functions

Localizadas em `supabase/functions/`:

| Função | Propósito |
|--------|-----------|
| `agente-prefeito` | Chat IA para prefeito |
| `agente-governador` | Chat IA estadual |
| `agente-secretario` | Chat IA por secretaria |
| `gerar-briefing-semanal` | Briefing executivo semanal |
| `analisar-arquivo` | Análise de documentos via IA |
| `benchmark-automatico` | Comparação inter-municípios |
| `monitor-captacao` | Monitor de oportunidades de recursos |
| `social-intel-coletor` | Coleta de menções nas redes |
| `sugerir-resposta-social` | Sugestões de resposta IA |
| `demo-snapshot` | Snapshot read-only para `/demo` |
| `seed-demo` | Popula tenant Marajoense de demo |
| `onboarding-tenant` | Provisiona novo tenant |
| `processar-importacao` | Importação de planilhas |
| `admin-users`, `get-audit-logs-admin`, `reset-demo-passwords` | Operações administrativas |

---

## 🔔 Sistema de Notificações

- Tabela `notifications` com RLS (usuário só vê as próprias)
- Coluna `notifications_enabled` em `profiles` para preferências
- Trigger `handle_lead_status_change` cria notificações automaticamente quando o status de um `lead_comercial` muda
- Hook `usePushNotifications` em `src/hooks/`

---

## 🤝 Portal do Parceiro

Rota: `/parceiro` (`src/routes/parceiro.tsx`)

### Funcionalidades
- ✅ Indicação de novos municípios (formulário completo)
- ✅ Listagem de leads com `LocalizacaoContato` (componente isolado)
- ✅ **Filtros**: por status + busca por nome/município
- ✅ **Paginação**: 5 itens por página
- ✅ **Edição de status otimista** com reversão em caso de erro e revalidação
- ✅ KPIs: total, novos, convertidos
- ✅ RLS garante que cada parceiro só vê seus próprios leads (`reseller_id`)

### Error Boundary com Modal de Diagnóstico

A rota possui um `errorComponent` avançado que exibe:

1. **Sugestão acionável** — traduz erros comuns (`is not defined`, `Unexpected token`, `expected "}"`, `failed to resolve import`) em orientações em português
2. **Detalhes técnicos** — arquivo + linha/coluna identificada
3. **Stack trace** com toggle:
   - **Filtrado (App)**: apenas linhas do código do projeto (oculta `node_modules`)
   - **Tudo (Node)**: stack completo
4. **Botão "Copiar"** — copia mensagem + stack para clipboard
5. **Botão "Gerar Ticket"** — gera resumo formatado com:
   - ID único do erro
   - Arquivo, local, mensagem
   - Trecho do stack (5 primeiras linhas filtradas)
   - URL e timestamp
6. **Recarregar e Validar** — invalida router e tenta novamente
7. **Logs no console** automáticos para auditoria

---

## 🌐 Demo Pública (Read-Only)

- Tenant **Marajoense** populado via `seed-demo`
- Snapshot servido por `demo-snapshot` (sem necessidade de auth)
- Rotas: `/demo`, `/demo/prefeito`, `/demo/cidadao`, `/demo/governador`
- Mesma API do app real, mas operações de escrita bloqueadas

---

## 🛠️ Diagnóstico e Estabilidade

### Pré-build syntax check
- **Script**: `scripts/check-syntax.ts`
- Roda automaticamente antes de `vite dev` (`bun scripts/check-syntax.ts && vite dev`)
- Limpa o cache do Vite (`node_modules/.vite`) para evitar versões antigas
- Valida `src/routes/parceiro.tsx` com `bun build` antes de servir

### Auto-restart no Vite
- `vite.config.ts` configurado com:
  - `usePolling: true` para detecção confiável de mudanças
  - Plugin custom `restart-on-major-change` que força `full-reload` em alterações grandes em `parceiro.tsx`

---

## 📜 Scripts e Comandos

```bash
bun dev          # roda check-syntax + vite dev
bun run build    # build de produção
bun run preview  # preview do build
bun run lint     # ESLint
bun run format   # Prettier
```

---

## 🔐 Segurança

- ✅ RLS em todas as tabelas multi-tenant
- ✅ Roles em tabela separada (`user_roles`)
- ✅ Funções `SECURITY DEFINER` para checagem segura
- ✅ Auditoria via `audit_logs`
- ✅ Secrets gerenciados via Lovable Cloud (nunca em código)

---

## 📝 Convenções de Código

- TypeScript estrito (`strict: true`)
- Imports devem resolver — nunca importar arquivo inexistente
- Componentes pequenos e focados
- Tokens semânticos do design system (definir em `src/styles.css` em `oklch`)
- Edits via search-replace, não rewrites completos
- Toda rota com loader deve ter `errorComponent` e `notFoundComponent`

---

**Última atualização**: Abril 2026
**Mantido por**: Equipe NovaeXis + Lovable AI
