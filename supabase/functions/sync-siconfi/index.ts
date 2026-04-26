// @ts-nocheck
/**
 * sync-siconfi
 *
 * Sincroniza dados de execução orçamentária do Estado do Pará
 * a partir da API pública do SICONFI (Tesouro Nacional / STN).
 *
 * Fonte: https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo
 * Auth: nenhuma (API pública)
 * Rate limit: ~1 req/s entre chamadas
 *
 * Indicadores extraídos (todos vinculados ao tenant do Estado do Pará,
 * resolvido dinamicamente da tabela `tenants` via tipo='estado' + estado='PA'):
 *   - Receita Realizada (R$)                 — secretaria 'financas'
 *   - Despesa Empenhada (R$)                 — secretaria 'financas'
 *   - Execução Orçamentária (%)              — secretaria 'financas'
 *   - Despesa por função: Saúde / Educação / Segurança / Infra / Assistência
 *
 * Idempotência: upsert via índice único parcial
 *   (tenant_id, indicador, referencia_data, secretaria_slug) WHERE fonte LIKE 'api:%'
 *
 * Agendamento: mensal (dia 5, dados bimestrais demoram ~30 dias para publicar).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SICONFI_BASE = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo";
const INTEGRADOR_NOME = "sync-siconfi";
const FONTE = "api:siconfi";

// Mapeamento: nome da função orçamentária (campo "conta" do Anexo 02)
// -> (indicador legível, secretaria_slug). Comparação case-insensitive exata.
const FUNCOES: Record<string, { nome: string; secretaria: string }> = {
  "saúde": { nome: "Despesa Empenhada - Saúde", secretaria: "saude" },
  "educação": { nome: "Despesa Empenhada - Educação", secretaria: "educacao" },
  "segurança pública": { nome: "Despesa Empenhada - Segurança Pública", secretaria: "seguranca" },
  "urbanismo": { nome: "Despesa Empenhada - Urbanismo", secretaria: "infraestrutura" },
  "saneamento": { nome: "Despesa Empenhada - Saneamento", secretaria: "infraestrutura" },
  "transporte": { nome: "Despesa Empenhada - Transporte", secretaria: "infraestrutura" },
  "assistência social": { nome: "Despesa Empenhada - Assistência Social", secretaria: "assistencia" },
};

interface SiconfiItem {
  cod_conta?: string;
  conta?: string;
  coluna?: string;
  valor?: number;
  cod_ibge?: number | string;
  exercicio?: number;
  periodo?: number;
  populacao?: number;
  anexo?: string;
}

interface SiconfiResponse {
  items?: SiconfiItem[];
  count?: number;
  hasMore?: boolean;
}

/** Calcula bimestre/ano alvo: último bimestre fechado há ≥30 dias. */
function calcularPeriodoAlvo(now = new Date()): { ano: number; bimestre: number; refDate: string } {
  // Volta ~45 dias para garantir que o bimestre já foi publicado
  const ref = new Date(now);
  ref.setDate(ref.getDate() - 45);
  const ano = ref.getFullYear();
  const mes = ref.getMonth() + 1; // 1-12
  const bimestre = Math.ceil(mes / 2); // 1-6
  // referencia_data = último dia do bimestre
  const ultimoMes = bimestre * 2;
  const refDate = new Date(ano, ultimoMes, 0).toISOString().slice(0, 10);
  return { ano, bimestre, refDate };
}

async function fetchSiconfi(params: Record<string, string>, retries = 3): Promise<SiconfiResponse> {
  const qs = new URLSearchParams(params).toString();
  const url = `${SICONFI_BASE}?${qs}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.status === 429) {
        const wait = 2 ** attempt * 1000;
        console.warn(`[siconfi] 429 rate-limited, aguardando ${wait}ms (tentativa ${attempt}/${retries})`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) throw new Error(`SICONFI HTTP ${res.status}: ${await res.text()}`);
      return (await res.json()) as SiconfiResponse;
    } catch (e) {
      if (attempt === retries) throw e;
      const wait = 2 ** attempt * 1000;
      console.warn(`[siconfi] erro tentativa ${attempt}: ${e instanceof Error ? e.message : e}; retry em ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error("SICONFI: esgotadas tentativas");
}

/**
 * Extrai KPIs do Anexo I (Balanço Orçamentário).
 * Conforme payload real do SICONFI, as colunas relevantes são:
 *   - "PREVISÃO ATUALIZADA (a)"   → receita prevista
 *   - "Até o Bimestre (c)"        → receita realizada acumulada
 *   - "DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)" → despesa empenhada
 */
function extrairKpisBalanco(items: SiconfiItem[], tenantId: string, refDate: string) {
  const kpis: Array<Record<string, unknown>> = [];
  const a01 = items.filter((i) => (i.anexo ?? "").includes("Anexo 01"));

  const find = (contaIncludes: string, colunaExact: string) =>
    a01.find(
      (i) =>
        (i.conta ?? "").toUpperCase().includes(contaIncludes.toUpperCase()) &&
        (i.coluna ?? "").trim().toUpperCase() === colunaExact.toUpperCase(),
    );

  const receitaPrevista = find("RECEITAS CORRENTES", "PREVISÃO ATUALIZADA (a)");
  const receitaRealizada = find("RECEITAS CORRENTES", "Até o Bimestre (c)");
  const despesaEmpenhada = a01.find(
    (i) =>
      (i.conta ?? "").toUpperCase().includes("DESPESAS CORRENTES") &&
      (i.coluna ?? "").toUpperCase().includes("EMPENHADAS ATÉ O BIMESTRE"),
  );

  if (receitaRealizada?.valor != null) {
    kpis.push({
      tenant_id: tenantId,
      secretaria_slug: "financas",
      indicador: "Receita Corrente Realizada (acum. bimestre)",
      valor: receitaRealizada.valor,
      unidade: "R$",
      referencia_data: refDate,
      fonte: FONTE,
      status: "ok",
    });
  }
  if (despesaEmpenhada?.valor != null) {
    kpis.push({
      tenant_id: tenantId,
      secretaria_slug: "financas",
      indicador: "Despesa Corrente Empenhada (acum. bimestre)",
      valor: despesaEmpenhada.valor,
      unidade: "R$",
      referencia_data: refDate,
      fonte: FONTE,
      status: "ok",
    });
  }
  if (receitaRealizada?.valor && receitaPrevista?.valor) {
    const pct = (receitaRealizada.valor / receitaPrevista.valor) * 100;
    kpis.push({
      tenant_id: tenantId,
      secretaria_slug: "financas",
      indicador: "Execução Orçamentária (Receita Realizada / Prevista)",
      valor: Math.round(pct * 100) / 100,
      unidade: "%",
      referencia_data: refDate,
      fonte: FONTE,
      status: pct >= 90 ? "ok" : pct >= 70 ? "atencao" : "critico",
    });
  }
  return kpis;
}

/**
 * Extrai KPIs por função orçamentária (Anexo II — Despesa por Função).
 * O campo `conta` contém o nome textual da função (ex: "Saúde", "Educação").
 * Coluna alvo: "DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)".
 */
function extrairKpisPorFuncao(items: SiconfiItem[], tenantId: string, refDate: string) {
  const kpis: Array<Record<string, unknown>> = [];
  const a02 = items.filter((i) => (i.anexo ?? "").includes("Anexo 02"));

  for (const [funcKey, meta] of Object.entries(FUNCOES)) {
    const item = a02.find(
      (i) =>
        (i.conta ?? "").trim().toLowerCase() === funcKey.toLowerCase() &&
        (i.coluna ?? "").toUpperCase().includes("EMPENHADAS ATÉ O BIMESTRE"),
    );
    if (item?.valor != null) {
      kpis.push({
        tenant_id: tenantId,
        secretaria_slug: meta.secretaria,
        indicador: meta.nome,
        valor: item.valor,
        unidade: "R$",
        referencia_data: refDate,
        fonte: FONTE,
        status: "ok",
      });
    }
  }
  return kpis;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Resolver tenant do Estado do Pará dinamicamente.
  // Critério: tipo='estado' E (estado='PA' OU slug ILIKE '%para%').
  // Mais robusto do que depender de um secret estático — funciona mesmo se o
  // tenant for renomeado/recriado.
  const { data: tenantRow, error: tenantErr } = await supabase
    .from("tenants")
    .select("id, nome, slug, estado")
    .eq("tipo", "estado")
    .or("estado.eq.PA,slug.ilike.%para%")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (tenantErr || !tenantRow?.id) {
    const msg = tenantErr?.message ?? "Tenant 'Estado do Pará' não encontrado (tipo='estado', estado='PA').";
    console.error("[siconfi] resolução de tenant falhou:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const tenantId = tenantRow.id;
  console.log(`[siconfi] tenant estadual resolvido: ${tenantRow.nome} (${tenantId})`);

  // Garantir registro de integrador (idempotente: 1 por tenant + tipo + nome)
  let integradorId: string | null = null;
  {
    const { data: existing } = await supabase
      .from("integradores")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("tipo", "api_rest")
      .eq("nome", INTEGRADOR_NOME)
      .maybeSingle();

    if (existing?.id) {
      integradorId = existing.id;
    } else {
      const { data: novo, error: errIns } = await supabase
        .from("integradores")
        .insert({
          tenant_id: tenantId,
          secretaria_slug: "financas",
          nome: INTEGRADOR_NOME,
          descricao: "Sincronização automática RREO/SICONFI - Tesouro Nacional",
          tipo: "api_rest",
          status: "aguardando_configuracao",
          endpoint: SICONFI_BASE,
          config: { uf: "PA", demonstrativo: "RREO" },
        })
        .select("id")
        .single();
      if (errIns) {
        console.error("[siconfi] falha ao criar integrador:", errIns);
        return new Response(JSON.stringify({ error: errIns.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      integradorId = novo.id;
    }
  }

  const inicio = Date.now();
  const { data: log } = await supabase
    .from("sync_logs")
    .insert({ integrador_id: integradorId, tenant_id: tenantId, status: "em_andamento" })
    .select("id")
    .single();
  const logId = log?.id ?? null;

  try {
    // Tenta primeiro o período-alvo (recente). Se vier vazio (dados ainda não
    // publicados pelo Tesouro), faz fallback regredindo bimestres até achar
    // dados ou esgotar 6 tentativas (~1 ano).
    let ano = 0, bimestre = 0, refDate = "";
    let items: SiconfiItem[] = [];
    const alvo = calcularPeriodoAlvo();
    let tentativaAno = alvo.ano;
    let tentativaBim = alvo.bimestre;

    for (let i = 0; i < 6 && items.length === 0; i++) {
      console.log(`[siconfi] tentando exercício=${tentativaAno}, bimestre=${tentativaBim}`);
      const resp = await fetchSiconfi({
        an_exercicio: String(tentativaAno),
        nr_periodo: String(tentativaBim),
        co_tipo_demonstrativo: "RREO",
        id_ente: "15", // UF Pará (governo estadual)
      });
      if ((resp.items?.length ?? 0) > 0) {
        items = resp.items!;
        ano = tentativaAno;
        bimestre = tentativaBim;
        // referencia_data = último dia do bimestre encontrado
        refDate = new Date(ano, bimestre * 2, 0).toISOString().slice(0, 10);
        console.log(`[siconfi] dados encontrados: ${items.length} items para ${ano}/B${bimestre}`);
        break;
      }
      // Regride 1 bimestre
      tentativaBim--;
      if (tentativaBim < 1) {
        tentativaBim = 6;
        tentativaAno--;
      }
      await new Promise((r) => setTimeout(r, 1100));
    }

    if (items.length === 0) {
      throw new Error("SICONFI não retornou dados para o Pará nos últimos 6 bimestres.");
    }

    const kpisBalanco = extrairKpisBalanco(items, tenantId, refDate);
    const kpisFuncao = extrairKpisPorFuncao(items, tenantId, refDate);
    const todos = [...kpisBalanco, ...kpisFuncao];

    let salvos = 0;
    let ignorados = 0;
    const falhas: Array<{
      indicador: string;
      secretaria_slug: string;
      referencia_data: string;
      valor: unknown;
      erro_codigo?: string;
      erro_mensagem: string;
      erro_detalhe?: string;
      erro_hint?: string;
    }> = [];

    console.log(`[siconfi] iniciando upsert de ${todos.length} KPIs (tenant=${tenantId}, ref=${refDate})`);

    for (const kpi of todos) {
      const ctx = {
        indicador: kpi.indicador as string,
        secretaria_slug: kpi.secretaria_slug as string,
        referencia_data: kpi.referencia_data as string,
        valor: kpi.valor,
      };
      const { error, data } = await supabase
        .from("kpis")
        .upsert(kpi, { onConflict: "tenant_id,indicador,referencia_data,secretaria_slug" })
        .select("id");

      if (error) {
        const detalhe = {
          ...ctx,
          erro_codigo: (error as { code?: string }).code,
          erro_mensagem: error.message,
          erro_detalhe: (error as { details?: string }).details,
          erro_hint: (error as { hint?: string }).hint,
        };
        console.error(`[siconfi] FALHA upsert [${ctx.secretaria_slug}/${ctx.indicador}]:`, JSON.stringify(detalhe));
        falhas.push(detalhe);
        ignorados++;
      } else {
        const rowId = Array.isArray(data) && data[0]?.id ? data[0].id : "?";
        console.log(`[siconfi] OK upsert [${ctx.secretaria_slug}/${ctx.indicador}] valor=${ctx.valor} → id=${rowId}`);
        salvos++;
      }
    }

    console.log(`[siconfi] resumo upsert: total=${todos.length} salvos=${salvos} ignorados=${ignorados}`);
    if (falhas.length > 0) {
      console.error(`[siconfi] ${falhas.length} falha(s) detalhada(s):`, JSON.stringify(falhas, null, 2));
    }

    const resumoErro = falhas.length > 0
      ? `${falhas.length}/${todos.length} KPIs falharam: ` +
        falhas.slice(0, 3).map((f) => `[${f.secretaria_slug}/${f.indicador}] ${f.erro_codigo ?? ""} ${f.erro_mensagem}`).join(" | ") +
        (falhas.length > 3 ? ` (+${falhas.length - 3} mais)` : "")
      : null;

    if (logId) {
      await supabase
        .from("sync_logs")
        .update({
          concluido_at: new Date().toISOString(),
          status: ignorados > 0 && salvos === 0 ? "erro" : (ignorados > 0 ? "parcial" : "sucesso"),
          registros_processados: todos.length,
          registros_salvos: salvos,
          registros_ignorados: ignorados,
          erro_mensagem: resumoErro,
          duracao_ms: Date.now() - inicio,
        })
        .eq("id", logId);
    }
    await supabase
      .from("integradores")
      .update({
        status: ignorados > 0 && salvos === 0 ? "erro" : "ativo",
        ultimo_sync: new Date().toISOString(),
        ultimo_erro: resumoErro,
        total_registros_importados: salvos,
      })
      .eq("id", integradorId);

    return new Response(
      JSON.stringify({
        success: ignorados === 0,
        exercicio: ano,
        bimestre,
        referencia_data: refDate,
        processados: todos.length,
        salvos,
        ignorados,
        falhas, // detalhe completo de cada KPI que falhou
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[siconfi] erro fatal:", msg);
    if (logId) {
      await supabase
        .from("sync_logs")
        .update({
          concluido_at: new Date().toISOString(),
          status: "erro",
          erro_mensagem: msg,
          duracao_ms: Date.now() - inicio,
        })
        .eq("id", logId);
    }
    if (integradorId) {
      await supabase
        .from("integradores")
        .update({ status: "erro", ultimo_erro: msg })
        .eq("id", integradorId);
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
