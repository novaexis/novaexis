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
 * passado em PARA_STATE_TENANT_ID):
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

// Mapeamento: código de função orçamentária -> (indicador, secretaria_slug)
const FUNCOES = {
  "10": { nome: "Despesa Empenhada - Saúde", secretaria: "saude" },
  "12": { nome: "Despesa Empenhada - Educação", secretaria: "educacao" },
  "06": { nome: "Despesa Empenhada - Segurança Pública", secretaria: "seguranca" },
  "15": { nome: "Despesa Empenhada - Urbanismo/Infraestrutura", secretaria: "infraestrutura" },
  "08": { nome: "Despesa Empenhada - Assistência Social", secretaria: "assistencia" },
} as const;

interface SiconfiItem {
  cod_conta?: string;
  conta?: string;
  coluna?: string;
  valor?: number;
  cod_ibge?: string;
  exercicio?: number;
  periodo?: number;
  populacao?: number;
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
 * Extrai KPIs do payload RREO (Anexo I — Balanço Orçamentário).
 * O SICONFI retorna várias linhas; pegamos:
 *  - "RECEITAS CORRENTES" coluna "RECEITAS REALIZADAS"
 *  - "DESPESAS CORRENTES" coluna "DESPESAS EMPENHADAS"
 */
function extrairKpisBalanco(items: SiconfiItem[], tenantId: string, refDate: string) {
  const kpis: Array<Record<string, unknown>> = [];

  const findItem = (contaIncludes: string, colunaIncludes: string) =>
    items.find(
      (i) =>
        (i.conta ?? "").toUpperCase().includes(contaIncludes.toUpperCase()) &&
        (i.coluna ?? "").toUpperCase().includes(colunaIncludes.toUpperCase()),
    );

  const receitaRealizada = findItem("RECEITAS CORRENTES", "REALIZADAS");
  const receitaPrevista = findItem("RECEITAS CORRENTES", "PREVIS");
  const despesaEmpenhada = findItem("DESPESAS CORRENTES", "EMPENHADAS");

  if (receitaRealizada?.valor != null) {
    kpis.push({
      tenant_id: tenantId,
      secretaria_slug: "financas",
      indicador: "Receita Corrente Realizada",
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
      indicador: "Despesa Corrente Empenhada",
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
 * Extrai KPIs por função orçamentária (RREO Anexo II — Despesa por Função).
 * Cada item traz cod_conta = código da função (ex: "10").
 */
function extrairKpisPorFuncao(items: SiconfiItem[], tenantId: string, refDate: string) {
  const kpis: Array<Record<string, unknown>> = [];
  for (const [codigo, meta] of Object.entries(FUNCOES)) {
    // Procura linha cuja conta inicia com o código + " " e coluna de empenhadas
    const item = items.find(
      (i) =>
        (i.cod_conta === codigo || (i.conta ?? "").trim().startsWith(codigo)) &&
        (i.coluna ?? "").toUpperCase().includes("EMPENHADAS"),
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

  const tenantId = Deno.env.get("PARA_STATE_TENANT_ID");
  if (!tenantId) {
    return new Response(
      JSON.stringify({ error: "PARA_STATE_TENANT_ID não configurado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Garantir registro de integrador (idempotente: 1 por tenant + tipo + nome)
  let integradorId: string | null = null;
  {
    const { data: existing } = await supabase
      .from("integradores")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("tipo", "sync_externo")
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
          tipo: "sync_externo",
          status: "em_execucao",
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
    const { ano, bimestre, refDate } = calcularPeriodoAlvo();
    console.log(`[siconfi] sincronizando RREO Pará — exercício=${ano}, bimestre=${bimestre}, refDate=${refDate}`);

    // 1) Anexo I — Balanço Orçamentário
    const balanco = await fetchSiconfi({
      an_exercicio: String(ano),
      nr_periodo: String(bimestre),
      co_tipo_demonstrativo: "RREO",
      no_anexo: "RREO-Anexo 01",
      id_ente: "15", // UF Pará (governo estadual)
    });
    await new Promise((r) => setTimeout(r, 1100));

    // 2) Anexo II — Despesa por Função
    const porFuncao = await fetchSiconfi({
      an_exercicio: String(ano),
      nr_periodo: String(bimestre),
      co_tipo_demonstrativo: "RREO",
      no_anexo: "RREO-Anexo 02",
      id_ente: "15",
    });

    const kpisBalanco = extrairKpisBalanco(balanco.items ?? [], tenantId, refDate);
    const kpisFuncao = extrairKpisPorFuncao(porFuncao.items ?? [], tenantId, refDate);
    const todos = [...kpisBalanco, ...kpisFuncao];

    let salvos = 0;
    let ignorados = 0;
    for (const kpi of todos) {
      const { error } = await supabase
        .from("kpis")
        .upsert(kpi, { onConflict: "tenant_id,indicador,referencia_data,secretaria_slug" });
      if (error) {
        console.error("[siconfi] upsert error:", error.message, kpi);
        ignorados++;
      } else {
        salvos++;
      }
    }

    if (logId) {
      await supabase
        .from("sync_logs")
        .update({
          concluido_at: new Date().toISOString(),
          status: ignorados > 0 && salvos === 0 ? "erro" : "sucesso",
          registros_processados: todos.length,
          registros_salvos: salvos,
          registros_ignorados: ignorados,
          duracao_ms: Date.now() - inicio,
        })
        .eq("id", logId);
    }
    await supabase
      .from("integradores")
      .update({
        status: "ativo",
        ultimo_sync: new Date().toISOString(),
        ultimo_erro: null,
        total_registros_importados: salvos,
      })
      .eq("id", integradorId);

    return new Response(
      JSON.stringify({
        success: true,
        exercicio: ano,
        bimestre,
        referencia_data: refDate,
        processados: todos.length,
        salvos,
        ignorados,
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
