// @ts-nocheck
/**
 * sync-siconfi (Bloco 9 — Prompt 41)
 *
 * Sincroniza dados reais do Estado do Pará a partir da API pública do
 * Tesouro Nacional (SICONFI/STN). Cobre três demonstrativos:
 *   - RREO   (bimestral)  → execução orçamentária por função
 *   - RGF    (quadrimestral) → pessoal vs RCL, dívida consolidada
 *   - FINBRA (anual)      → receita total consolidada
 *
 * Indicadores são UPSERTed na tabela `kpis` com `fonte` específica
 * (api:siconfi-rreo / -rgf / -finbra). Dados seed são preservados —
 * a UI prefere o registro mais recente por (secretaria, indicador).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SICONFI_BASE = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt";
const UA = "NovaeXis-Integrador/1.0 (contato@novaexis.com.br)";

// Mapeamento função orçamentária → secretaria estadual NovaeXis
const FUNCAO_PARA_SLUG: Record<string, string> = {
  "Saúde": "sespa",
  "Educação": "seduc",
  "Segurança Pública": "segup",
  "Assistência Social": "semas",
  "Habitação": "seinfra",
  "Transporte": "seinfra",
  "Urbanismo": "seinfra",
};

function getBimestreDisponivel(now = new Date()): { ano: number; bimestre: number } {
  // Volta ~45 dias para garantir que o bimestre já foi publicado pelo STN
  const ref = new Date(now);
  ref.setDate(ref.getDate() - 45);
  const ano = ref.getFullYear();
  const mes = ref.getMonth() + 1;
  const bimestre = Math.max(1, Math.min(6, Math.ceil(mes / 2)));
  return { ano, bimestre };
}

function getQuadrimestreDisponivel(now = new Date()): { ano: number; periodo: string } {
  // RGF: 600000 (1° Jan-Abr), 600001 (2° Mai-Ago), 600002 (3° Set-Dez)
  // Disponibilidade ~60 dias após fechamento
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();
  if (mes >= 11) return { ano, periodo: "600001" };       // 2° quad fechado em ago
  if (mes >= 7) return { ano, periodo: "600000" };        // 1° quad fechado em abr
  return { ano: ano - 1, periodo: "600002" };             // 3° quad ano anterior
}

async function fetchSiconfi(path: string, params: Record<string, string>, retries = 3): Promise<any> {
  const url = new URL(`${SICONFI_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json", "User-Agent": UA },
      });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
        continue;
      }
      if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt === retries) throw e;
      await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
    }
  }
  throw new Error(`${path}: esgotadas tentativas`);
}

function num(v: any): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Resolver tenant estadual do Pará
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, nome")
    .eq("tipo", "estado")
    .eq("estado", "PA")
    .maybeSingle();

  if (!tenant) {
    return new Response(
      JSON.stringify({ erro: "Tenant estadual do Pará não encontrado" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const tenantId = tenant.id as string;
  const inicio = Date.now();
  const resultados: Record<string, any> = {};
  const erros: string[] = [];
  let kpisTotais = 0;

  // ─── 1. RREO — Execução por função ──────────────────────────────────────
  try {
    const { ano, bimestre } = getBimestreDisponivel();
    console.log(`[siconfi] RREO ${ano}/${bimestre} PA`);

    const data = await fetchSiconfi("rreo", {
      an_exercicio: String(ano),
      nr_periodo: String(bimestre),
      co_tipo_demonstrativo: "RREO",
      no_uf: "PA",
      co_poder: "E",
    });

    const itens = data.items ?? data ?? [];
    if (!Array.isArray(itens)) throw new Error("RREO: payload sem 'items'");

    // Agregar por função
    const porFuncao: Record<string, { dotacao: number; empenhada: number; liquidada: number; paga: number }> = {};
    for (const item of itens) {
      const funcao = item.ds_funcao ?? item.no_funcao ?? item.conta;
      if (!funcao) continue;
      const slug = FUNCAO_PARA_SLUG[String(funcao).trim()];
      if (!slug) continue;

      if (!porFuncao[slug]) porFuncao[slug] = { dotacao: 0, empenhada: 0, liquidada: 0, paga: 0 };
      const f = porFuncao[slug];
      f.dotacao += num(item.vl_dotacao_atualizada ?? item.vl_atualizado);
      f.empenhada += num(item.vl_empenhado ?? item.vl_despesas_empenhadas);
      f.liquidada += num(item.vl_liquidado ?? item.vl_despesas_liquidadas);
      f.paga += num(item.vl_pago ?? item.vl_despesas_pagas);
    }

    const refDate = new Date(ano, bimestre * 2, 0).toISOString().slice(0, 10);
    const kpisRREO: any[] = [];

    for (const [slug, dados] of Object.entries(porFuncao)) {
      const execPct = dados.dotacao > 0 ? (dados.liquidada / dados.dotacao) * 100 : 0;

      kpisRREO.push(
        {
          tenant_id: tenantId, secretaria_slug: slug,
          indicador: "Execução orçamentária",
          valor: Math.round(execPct * 100) / 100, unidade: "%",
          status: execPct >= 70 ? "ok" : execPct >= 40 ? "atencao" : "critico",
          referencia_data: refDate, fonte: "api:siconfi-rreo",
        },
        {
          tenant_id: tenantId, secretaria_slug: slug,
          indicador: "Dotação atualizada",
          valor: dados.dotacao, unidade: "R$",
          status: "ok", referencia_data: refDate, fonte: "api:siconfi-rreo",
        },
        {
          tenant_id: tenantId, secretaria_slug: slug,
          indicador: "Despesas liquidadas",
          valor: dados.liquidada, unidade: "R$",
          status: "ok", referencia_data: refDate, fonte: "api:siconfi-rreo",
        },
      );
    }

    if (kpisRREO.length > 0) {
      const { error } = await supabase
        .from("kpis")
        .upsert(kpisRREO, { onConflict: "tenant_id,indicador,referencia_data,secretaria_slug" });
      if (error) throw new Error(`upsert RREO: ${error.message}`);
      kpisTotais += kpisRREO.length;
    }

    resultados.rreo = {
      bimestre: `${ano}/${bimestre}`,
      secretarias: Object.keys(porFuncao),
      kpis_salvos: kpisRREO.length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    erros.push(`RREO: ${msg}`);
    console.error("[siconfi] RREO erro:", msg);
  }

  await new Promise((r) => setTimeout(r, 1000));

  // ─── 2. RGF — Pessoal e Dívida (LRF) ────────────────────────────────────
  try {
    const { ano, periodo } = getQuadrimestreDisponivel();
    console.log(`[siconfi] RGF ${ano}/${periodo} PA`);

    const data = await fetchSiconfi("rgf", {
      an_exercicio: String(ano),
      co_periodo: periodo,
      no_uf: "PA",
      co_poder: "E",
    });

    const itens = data.items ?? data ?? [];
    let despesaPessoal = 0;
    let rcl = 0;
    let dividaConsolidada = 0;

    for (const item of itens) {
      const conta = String(item.ds_conta ?? item.no_conta ?? item.conta ?? "").toUpperCase();
      const valor = num(item.vl_resultado ?? item.vl_ultimo_periodo ?? item.valor);

      if (conta.includes("DESPESA TOTAL COM PESSOAL")) despesaPessoal = Math.max(despesaPessoal, valor);
      else if (conta.includes("RECEITA CORRENTE LÍQUIDA") || conta.includes("RECEITA CORRENTE LIQUIDA")) {
        rcl = Math.max(rcl, valor);
      } else if (conta.includes("DÍVIDA CONSOLIDADA LÍQUIDA") || conta.includes("DIVIDA CONSOLIDADA LIQUIDA")) {
        dividaConsolidada = Math.max(dividaConsolidada, valor);
      }
    }

    const pctPessoal = rcl > 0 ? (despesaPessoal / rcl) * 100 : 0;
    const pctDivida = rcl > 0 ? (dividaConsolidada / rcl) * 100 : 0;
    const mesRef = periodo === "600000" ? "04" : periodo === "600001" ? "08" : "12";
    const refDate = `${ano}-${mesRef}-30`;

    const kpisRGF: any[] = [];
    if (pctPessoal > 0) {
      kpisRGF.push({
        tenant_id: tenantId, secretaria_slug: "sefa",
        indicador: "Despesa pessoal — limite LRF",
        valor: Math.round(pctPessoal * 100) / 100, unidade: "%",
        status: pctPessoal >= 49 ? "critico" : pctPessoal >= 46 ? "atencao" : "ok",
        referencia_data: refDate, fonte: "api:siconfi-rgf",
      });
    }
    if (rcl > 0) {
      kpisRGF.push({
        tenant_id: tenantId, secretaria_slug: "sefa",
        indicador: "Receita Corrente Líquida",
        valor: rcl, unidade: "R$", status: "ok",
        referencia_data: refDate, fonte: "api:siconfi-rgf",
      });
    }
    if (pctDivida > 0) {
      kpisRGF.push({
        tenant_id: tenantId, secretaria_slug: "sefa",
        indicador: "Dívida Consolidada / RCL",
        valor: Math.round(pctDivida * 100) / 100, unidade: "%",
        status: pctDivida >= 150 ? "critico" : pctDivida >= 100 ? "atencao" : "ok",
        referencia_data: refDate, fonte: "api:siconfi-rgf",
      });
    }

    if (kpisRGF.length > 0) {
      const { error } = await supabase
        .from("kpis")
        .upsert(kpisRGF, { onConflict: "tenant_id,indicador,referencia_data,secretaria_slug" });
      if (error) throw new Error(`upsert RGF: ${error.message}`);
      kpisTotais += kpisRGF.length;
    }

    resultados.rgf = { periodo: `${ano}/${periodo}`, pct_pessoal: pctPessoal, rcl, pct_divida: pctDivida, kpis_salvos: kpisRGF.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    erros.push(`RGF: ${msg}`);
    console.error("[siconfi] RGF erro:", msg);
  }

  await new Promise((r) => setTimeout(r, 1000));

  // ─── 3. FINBRA — Receita anual consolidada ──────────────────────────────
  try {
    const anoAnterior = new Date().getFullYear() - 1;
    console.log(`[siconfi] FINBRA ${anoAnterior} PA`);

    const data = await fetchSiconfi("finbra", {
      an_exercicio: String(anoAnterior),
      no_uf: "PA",
      co_tipo_demonstrativo: "DCA",
    });

    const itens = data.items ?? data ?? [];
    let receitaTotal = 0;
    for (const item of itens) {
      const conta = String(item.ds_conta ?? item.conta ?? "").toUpperCase();
      if (conta.includes("RECEITA TOTAL") || conta.includes("RECEITAS CORRENTES")) {
        receitaTotal = Math.max(receitaTotal, num(item.vl_resultado ?? item.valor));
      }
    }

    if (receitaTotal > 0) {
      const refDate = `${anoAnterior}-12-31`;
      const { error } = await supabase.from("kpis").upsert(
        [{
          tenant_id: tenantId, secretaria_slug: "sefa",
          indicador: "Receita total anual",
          valor: receitaTotal, unidade: "R$", status: "ok",
          referencia_data: refDate, fonte: "api:siconfi-finbra",
        }],
        { onConflict: "tenant_id,indicador,referencia_data,secretaria_slug" },
      );
      if (error) throw new Error(`upsert FINBRA: ${error.message}`);
      kpisTotais += 1;
    }

    resultados.finbra = { ano: anoAnterior, receita_total: receitaTotal };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    erros.push(`FINBRA: ${msg}`);
    console.error("[siconfi] FINBRA erro:", msg);
  }

  // ─── 4. Atualizar / criar integrador ────────────────────────────────────
  const NOME_INTEGRADOR = "STN SICONFI — Execução Orçamentária e Fiscal";
  const status = erros.length === 0 ? "ativo" : kpisTotais > 0 ? "ativo" : "erro";

  const { data: integ } = await supabase
    .from("integradores")
    .select("id, total_registros_importados")
    .eq("tenant_id", tenantId)
    .eq("nome", NOME_INTEGRADOR)
    .maybeSingle();

  let integradorId: string | null = integ?.id ?? null;
  if (integ) {
    await supabase.from("integradores").update({
      status,
      ultimo_sync: new Date().toISOString(),
      ultimo_erro: erros.length > 0 ? erros.join(" | ").slice(0, 1000) : null,
      total_registros_importados: (integ.total_registros_importados ?? 0) + kpisTotais,
    }).eq("id", integ.id);
  } else {
    const { data: novo } = await supabase.from("integradores").insert({
      tenant_id: tenantId,
      secretaria_slug: "sefa",
      nome: NOME_INTEGRADOR,
      descricao: "API pública do Tesouro Nacional — RREO, RGF e FINBRA do Estado do Pará",
      tipo: "api_rest",
      endpoint: SICONFI_BASE,
      config: { no_uf: "PA", co_poder: "E", fontes: ["rreo", "rgf", "finbra"] },
      status,
      ultimo_sync: new Date().toISOString(),
      ultimo_erro: erros.length > 0 ? erros.join(" | ").slice(0, 1000) : null,
      total_registros_importados: kpisTotais,
    }).select("id").single();
    integradorId = novo?.id ?? null;
  }

  // ─── 5. Log de sincronização ────────────────────────────────────────────
  const duracao = Date.now() - inicio;
  const logStatus = erros.length === 0 ? "sucesso" : kpisTotais > 0 ? "parcial" : "erro";
  await supabase.from("sync_logs").insert({
    tenant_id: tenantId,
    integrador_id: integradorId,
    iniciado_at: new Date(inicio).toISOString(),
    concluido_at: new Date().toISOString(),
    status: logStatus,
    registros_salvos: kpisTotais,
    duracao_ms: duracao,
    erro_mensagem: erros.length > 0 ? erros.join(" | ").slice(0, 2000) : null,
    erro_detalhes: erros.length > 0 ? { erros, resultados } : null,
  });

  return new Response(
    JSON.stringify({ resultados, erros, kpis_salvos: kpisTotais, duracao_ms: duracao }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
