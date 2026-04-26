// @ts-nocheck
/**
 * sync-siconfi-municipal
 *
 * Busca RREO + RGF do SICONFI para TODOS os municípios do PA em uma única
 * chamada por demonstrativo, e filtra localmente pelos tenants aderentes
 * (tipo='municipio', ativo=true, ibge_codigo NOT NULL).
 *
 * Salva em kpis: execução orçamentária por função (saúde, educação,
 * segurança, assistência, infraestrutura) + dotação atualizada + LRF pessoal.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SICONFI_BASE = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt";
const NOME_INTEGRADOR = "SICONFI Municipal — RREO/RGF";

const FUNCAO_PARA_SLUG: Record<string, string> = {
  "Saúde": "saude",
  "Educação": "educacao",
  "Segurança Pública": "seguranca",
  "Assistência Social": "assistencia",
  "Habitação": "infraestrutura",
  "Transporte": "infraestrutura",
  "Urbanismo": "infraestrutura",
};

function getBimestreAtual() {
  const mes = new Date().getMonth() + 1;
  const ano = new Date().getFullYear();
  let bimestre = Math.floor((mes - 1) / 2);
  if (bimestre < 1) bimestre = 6;
  return { ano: bimestre === 6 && mes < 3 ? ano - 1 : ano, bimestre };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const inicio = Date.now();
  const erros: string[] = [];
  let kpisSalvos = 0;

  const { data: municipios, error: errMun } = await supabase
    .from("tenants")
    .select("id, nome, ibge_codigo")
    .eq("tipo", "municipio")
    .eq("ativo", true)
    .not("ibge_codigo", "is", null);

  if (errMun || !municipios?.length) {
    return new Response(
      JSON.stringify({ erro: "Nenhum município com IBGE cadastrado", detalhe: errMun?.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const municipiosPorIBGE = new Map(municipios.map((m: any) => [String(m.ibge_codigo), m]));
  const resultados: any[] = [];

  // ─── RREO Municipal — todos do PA ────────────────────────────────────────
  const { ano, bimestre } = getBimestreAtual();
  try {
    const url = new URL(`${SICONFI_BASE}/rreo`);
    url.searchParams.set("an_exercicio", String(ano));
    url.searchParams.set("nr_periodo", String(bimestre));
    url.searchParams.set("co_tipo_demonstrativo", "RREO");
    url.searchParams.set("no_uf", "PA");
    url.searchParams.set("co_poder", "M");

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "NovaeXis-Integrador/1.0",
      },
    });
    if (!res.ok) throw new Error(`RREO HTTP ${res.status}`);

    const data = await res.json();
    const itens: any[] = data.items ?? data ?? [];

    // Acumula por município → função
    const acc: Record<string, Record<string, { dot: number; liq: number }>> = {};

    for (const it of itens) {
      const ibge = String(it.id_ente ?? it.cod_ibge ?? it.co_municipio ?? "");
      if (!municipiosPorIBGE.has(ibge)) continue;
      const funcao = String(it.ds_funcao ?? it.no_funcao ?? "");
      const slug = FUNCAO_PARA_SLUG[funcao];
      if (!slug) continue;

      acc[ibge] = acc[ibge] ?? {};
      acc[ibge][slug] = acc[ibge][slug] ?? { dot: 0, liq: 0 };
      acc[ibge][slug].dot += parseFloat(it.vl_dotacao_atualizada ?? it.vl_atualizado ?? "0") || 0;
      acc[ibge][slug].liq += parseFloat(it.vl_liquidado ?? it.vl_despesas_liquidadas ?? "0") || 0;
    }

    const referencia = `${ano}-${String(bimestre * 2).padStart(2, "0")}-28`;

    for (const [ibge, secs] of Object.entries(acc)) {
      const mun = municipiosPorIBGE.get(ibge)!;
      const payload: any[] = [];
      for (const [slug, d] of Object.entries(secs)) {
        const pct = d.dot > 0 ? (d.liq / d.dot) * 100 : 0;
        payload.push({
          tenant_id: mun.id,
          secretaria_slug: slug,
          indicador: "Execução orçamentária",
          valor: Math.round(pct * 100) / 100,
          unidade: "%",
          status: pct >= 70 ? "ok" : pct >= 40 ? "atencao" : "critico",
          referencia_data: referencia,
          fonte: "api:siconfi-rreo",
        });
        if (d.dot > 0) {
          payload.push({
            tenant_id: mun.id,
            secretaria_slug: slug,
            indicador: "Dotação atualizada",
            valor: d.dot,
            unidade: "R$",
            status: "ok",
            referencia_data: referencia,
            fonte: "api:siconfi-rreo",
          });
        }
      }
      if (payload.length > 0) {
        const { error } = await supabase.from("kpis").upsert(payload, {
          onConflict: "tenant_id,indicador,referencia_data,secretaria_slug",
        });
        if (error) {
          erros.push(`upsert ${mun.nome}: ${error.message}`);
        } else {
          kpisSalvos += payload.length;
          resultados.push({ municipio: mun.nome, ibge, kpis: payload.length });
        }
      }
    }
  } catch (err) {
    erros.push(`RREO: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ─── RGF Municipal (LRF — pessoal) ───────────────────────────────────────
  await new Promise((r) => setTimeout(r, 800));
  try {
    const url = new URL(`${SICONFI_BASE}/rgf`);
    url.searchParams.set("an_exercicio", String(ano));
    url.searchParams.set("nr_periodo", "3"); // 3º quadrimestre = anual
    url.searchParams.set("co_tipo_demonstrativo", "RGF");
    url.searchParams.set("no_uf", "PA");
    url.searchParams.set("co_poder", "M");

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": "NovaeXis-Integrador/1.0" },
    });
    if (!res.ok) throw new Error(`RGF HTTP ${res.status}`);

    const data = await res.json();
    const itens: any[] = data.items ?? data ?? [];

    const rgf: Record<string, { pessoal: number; rcl: number }> = {};
    for (const it of itens) {
      const ibge = String(it.id_ente ?? it.cod_ibge ?? "");
      if (!municipiosPorIBGE.has(ibge)) continue;
      const conta = String(it.ds_conta ?? "").toUpperCase();
      rgf[ibge] = rgf[ibge] ?? { pessoal: 0, rcl: 0 };
      const valor = parseFloat(it.vl_resultado ?? "0") || 0;
      if (conta.includes("DESPESA TOTAL COM PESSOAL")) rgf[ibge].pessoal = valor;
      if (conta.includes("RECEITA CORRENTE LÍQUIDA") || conta.includes("RECEITA CORRENTE LIQUIDA")) {
        rgf[ibge].rcl = valor;
      }
    }

    const referencia = `${ano}-12-31`;
    for (const [ibge, d] of Object.entries(rgf)) {
      if (d.rcl <= 0 || d.pessoal <= 0) continue;
      const mun = municipiosPorIBGE.get(ibge)!;
      const pct = (d.pessoal / d.rcl) * 100;
      const { error } = await supabase.from("kpis").upsert(
        [{
          tenant_id: mun.id,
          secretaria_slug: "financas",
          indicador: "Despesa pessoal — limite LRF",
          valor: Math.round(pct * 100) / 100,
          unidade: "%",
          status: pct >= 49 ? "critico" : pct >= 46 ? "atencao" : "ok",
          referencia_data: referencia,
          fonte: "api:siconfi-rgf",
        }],
        { onConflict: "tenant_id,indicador,referencia_data,secretaria_slug" },
      );
      if (error) erros.push(`RGF ${mun.nome}: ${error.message}`);
      else kpisSalvos += 1;
    }
  } catch (err) {
    erros.push(`RGF: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ─── Integradores + sync_logs (1 por município) ─────────────────────────
  for (const mun of municipios) {
    const { data: integ } = await supabase
      .from("integradores")
      .select("id, total_registros_importados")
      .eq("tenant_id", mun.id)
      .eq("nome", NOME_INTEGRADOR)
      .maybeSingle();

    const status = erros.length === 0 ? "ativo" : kpisSalvos > 0 ? "ativo" : "erro";
    let integradorId = integ?.id ?? null;

    if (integ) {
      await supabase.from("integradores").update({
        status,
        ultimo_sync: new Date().toISOString(),
        ultimo_erro: erros.length ? erros.join(" | ").slice(0, 1000) : null,
      }).eq("id", integ.id);
    } else {
      const { data: novo } = await supabase.from("integradores").insert({
        tenant_id: mun.id,
        secretaria_slug: "financas",
        nome: NOME_INTEGRADOR,
        descricao: "Execução orçamentária e LRF municipal via SICONFI (Tesouro Nacional)",
        tipo: "api_rest",
        endpoint: SICONFI_BASE,
        config: { ibge_codigo: mun.ibge_codigo, uf: "PA" },
        status,
        ultimo_sync: new Date().toISOString(),
        ultimo_erro: erros.length ? erros.join(" | ").slice(0, 1000) : null,
        total_registros_importados: 0,
      }).select("id").single();
      integradorId = novo?.id ?? null;
    }

    await supabase.from("sync_logs").insert({
      tenant_id: mun.id,
      integrador_id: integradorId,
      iniciado_at: new Date(inicio).toISOString(),
      concluido_at: new Date().toISOString(),
      status: erros.length === 0 ? "sucesso" : kpisSalvos > 0 ? "parcial" : "erro",
      registros_salvos: resultados.find((r) => r.ibge === mun.ibge_codigo)?.kpis ?? 0,
      duracao_ms: Date.now() - inicio,
      erro_mensagem: erros.length ? erros.join(" | ").slice(0, 2000) : null,
    });
  }

  return new Response(
    JSON.stringify({
      municipios_aderentes: municipios.length,
      municipios_processados: resultados.length,
      kpis_salvos: kpisSalvos,
      resultados,
      erros,
      executado_em: new Date().toISOString(),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
