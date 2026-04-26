// @ts-nocheck
/**
 * sync-saude-municipal — CNES por município
 *
 * Usa /v1/cnes/estabelecimentos (paginado, max 20/req) com filtro
 * codigo_municipio (6 dígitos = IBGE sem dígito verificador).
 *
 * KPIs gerados por município:
 *  - Estabelecimentos SUS ativos
 *  - Unidades com atendimento hospitalar
 *  - Unidades com centro cirúrgico
 *
 * (Endpoint /assistencia-a-saude/hospitais-e-leitos retorna 500 upstream
 *  no momento. Quando voltar, adicionar contagem de leitos.)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CNES_BASE = "https://apidadosabertos.saude.gov.br";
const NOME_INTEGRADOR = "CNES Municipal — Estabelecimentos SUS";

async function contarPaginado(
  baseUrl: string,
  params: Record<string, string>,
  apiKey?: string,
  maxPaginas = 40,
): Promise<{ total: number; com_hospitalar: number; com_cirurgico: number; paginas: number }> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  let total = 0, com_hospitalar = 0, com_cirurgico = 0, paginas = 0;
  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    url.searchParams.set("limit", "20");
    url.searchParams.set("offset", String(pagina));

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      if (res.status === 404 && pagina > 1) break;
      throw new Error(`HTTP ${res.status} pag ${pagina}`);
    }
    const data = await res.json();
    const arr = data.estabelecimentos ?? [];
    paginas = pagina;
    if (arr.length === 0) break;

    total += arr.length;
    for (const e of arr) {
      if (e.estabelecimento_possui_atendimento_hospitalar === 1) com_hospitalar++;
      if (e.estabelecimento_possui_centro_cirurgico === 1) com_cirurgico++;
    }
    if (arr.length < 20) break;
  }
  return { total, com_hospitalar, com_cirurgico, paginas };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const inicio = Date.now();
  const apiKey = Deno.env.get("CNES_API_KEY") || undefined;
  const referencia = new Date().toISOString().slice(0, 10);
  const erros: string[] = [];
  const resultados: any[] = [];

  const { data: municipios } = await supabase
    .from("tenants")
    .select("id, nome, ibge_codigo")
    .eq("tipo", "municipio")
    .eq("ativo", true)
    .not("ibge_codigo", "is", null);

  if (!municipios?.length) {
    return new Response(JSON.stringify({ erro: "Nenhum município com IBGE" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await Promise.all(municipios.map(async (mun) => {
    const t0 = Date.now();
    const errosMun: string[] = [];
    let kpisMun = 0;

    // CNES usa código IBGE de 6 dígitos (sem DV)
    const codMunic6 = String(mun.ibge_codigo).slice(0, 6);

    try {
      const c = await contarPaginado(
        `${CNES_BASE}/cnes/estabelecimentos`,
        { codigo_municipio: codMunic6, status: "1" },
        apiKey,
      );

      const payload: any[] = [];
      if (c.total > 0) {
        payload.push({
          tenant_id: mun.id, secretaria_slug: "saude",
          indicador: "Estabelecimentos SUS ativos",
          valor: c.total, unidade: "unidades",
          status: c.total > 20 ? "ok" : c.total > 5 ? "atencao" : "critico",
          referencia_data: referencia, fonte: "api:cnes",
        });
      }
      if (c.com_hospitalar > 0) {
        payload.push({
          tenant_id: mun.id, secretaria_slug: "saude",
          indicador: "Unidades com atendimento hospitalar",
          valor: c.com_hospitalar, unidade: "unidades",
          status: c.com_hospitalar >= 1 ? "ok" : "critico",
          referencia_data: referencia, fonte: "api:cnes",
        });
      }
      if (c.com_cirurgico > 0) {
        payload.push({
          tenant_id: mun.id, secretaria_slug: "saude",
          indicador: "Unidades com centro cirúrgico",
          valor: c.com_cirurgico, unidade: "unidades",
          status: "ok",
          referencia_data: referencia, fonte: "api:cnes",
        });
      }

      if (payload.length > 0) {
        const { error } = await supabase.from("kpis").upsert(payload, {
          onConflict: "tenant_id,indicador,referencia_data,secretaria_slug",
        });
        if (error) errosMun.push(`upsert: ${error.message}`);
        else kpisMun = payload.length;
      }
    } catch (err) {
      errosMun.push(err instanceof Error ? err.message : String(err));
    }

    // ─── Integrador + log ──────────────────────────────────────────────
    const status = errosMun.length === 0 ? "ativo" : kpisMun > 0 ? "ativo" : "erro";
    const { data: integ } = await supabase.from("integradores")
      .select("id, total_registros_importados")
      .eq("tenant_id", mun.id).eq("nome", NOME_INTEGRADOR).maybeSingle();

    let integradorId = integ?.id ?? null;
    if (integ) {
      await supabase.from("integradores").update({
        status,
        ultimo_sync: new Date().toISOString(),
        ultimo_erro: errosMun.length ? errosMun.join(" | ").slice(0, 1000) : null,
        total_registros_importados: (integ.total_registros_importados ?? 0) + kpisMun,
      }).eq("id", integ.id);
    } else {
      const { data: novo } = await supabase.from("integradores").insert({
        tenant_id: mun.id, secretaria_slug: "saude",
        nome: NOME_INTEGRADOR,
        descricao: "Estabelecimentos de saúde SUS ativos no município (CNES/DATASUS)",
        tipo: "api_rest", endpoint: `${CNES_BASE}/cnes/estabelecimentos`,
        config: { codigo_municipio: codMunic6, ibge_completo: mun.ibge_codigo, api_key_configured: !!apiKey },
        status,
        ultimo_sync: new Date().toISOString(),
        ultimo_erro: errosMun.length ? errosMun.join(" | ").slice(0, 1000) : null,
        total_registros_importados: kpisMun,
      }).select("id").single();
      integradorId = novo?.id ?? null;
    }

    await supabase.from("sync_logs").insert({
      tenant_id: mun.id, integrador_id: integradorId,
      iniciado_at: new Date(t0).toISOString(),
      concluido_at: new Date().toISOString(),
      status: errosMun.length === 0 ? "sucesso" : kpisMun > 0 ? "parcial" : "erro",
      registros_salvos: kpisMun,
      duracao_ms: Date.now() - t0,
      erro_mensagem: errosMun.length ? errosMun.join(" | ").slice(0, 2000) : null,
    });

    resultados.push({ municipio: mun.nome, ibge: mun.ibge_codigo, kpis_salvos: kpisMun, erros: errosMun });
    erros.push(...errosMun.map((e) => `${mun.nome}: ${e}`));
  }

  return new Response(
    JSON.stringify({
      municipios_aderentes: municipios.length,
      municipios_processados: resultados.filter((r) => r.kpis_salvos > 0).length,
      kpis_salvos: resultados.reduce((a, r) => a + r.kpis_salvos, 0),
      api_key_configurada: !!apiKey,
      resultados,
      erros,
      duracao_ms: Date.now() - inicio,
      executado_em: new Date().toISOString(),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
