// @ts-nocheck
/**
 * sync-siconfi-municipal — RREO Anexo 02 (Despesa por Função) + RGF
 *
 * SICONFI exige id_ente para queries municipais (não aceita filtro por UF).
 * Faz uma chamada por município aderente, parseia o Anexo 02 (despesas por
 * função orçamentária) e calcula execução = liquidado/dotação por secretaria.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SICONFI_BASE = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt";
const NOME_INTEGRADOR = "SICONFI Municipal — RREO/RGF";

// Mapeia conta (função orçamentária do RREO Anexo 02) → secretaria
const CONTA_PARA_SLUG: Record<string, string> = {
  "Saúde": "saude",
  "Educação": "educacao",
  "Segurança Pública": "seguranca",
  "Assistência Social": "assistencia",
  "Habitação": "infraestrutura",
  "Transporte": "infraestrutura",
  "Urbanismo": "infraestrutura",
  "Saneamento": "infraestrutura",
};

function ultimoBimestrePublicado() {
  // SICONFI publica o bimestre 60-90 dias após o fechamento.
  // Estratégia segura: usar último bimestre do ano anterior.
  const anoAnt = new Date().getFullYear() - 1;
  return { ano: anoAnt, bimestre: 6 };
}

async function fetchSiconfi(url: URL): Promise<any[]> {
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json", "User-Agent": "NovaeXis-Integrador/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items ?? [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const inicio = Date.now();
  const erros: string[] = [];
  const resultados: any[] = [];

  const { data: municipios } = await supabase
    .from("tenants")
    .select("id, nome, ibge_codigo")
    .eq("tipo", "municipio")
    .eq("ativo", true)
    .not("ibge_codigo", "is", null);

  if (!municipios?.length) {
    return new Response(
      JSON.stringify({ erro: "Nenhum município com IBGE cadastrado" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { ano, bimestre } = ultimoBimestrePublicado();
  const referencia = `${ano}-12-31`;

  for (const mun of municipios) {
    const t0 = Date.now();
    let kpisMun = 0;
    const errosMun: string[] = [];

    // ─── RREO Anexo 02 ──────────────────────────────────────────────────
    try {
      const url = new URL(`${SICONFI_BASE}/rreo`);
      url.searchParams.set("an_exercicio", String(ano));
      url.searchParams.set("nr_periodo", String(bimestre));
      url.searchParams.set("co_tipo_demonstrativo", "RREO");
      url.searchParams.set("id_ente", mun.ibge_codigo);
      url.searchParams.set("co_poder", "M");

      const items = await fetchSiconfi(url);
      const anexo02 = items.filter((i: any) => i.anexo === "RREO-Anexo 02");

      // Acumular por slug
      const acc: Record<string, { dot: number; liq: number }> = {};
      for (const it of anexo02) {
        const slug = CONTA_PARA_SLUG[it.conta];
        if (!slug) continue;
        const valor = parseFloat(it.valor ?? "0") || 0;
        acc[slug] = acc[slug] ?? { dot: 0, liq: 0 };
        if (it.coluna === "DOTAÇÃO ATUALIZADA (a)") acc[slug].dot += valor;
        if (it.coluna === "DESPESAS LIQUIDADAS ATÉ O BIMESTRE (d)") acc[slug].liq += valor;
      }

      const payload: any[] = [];
      for (const [slug, d] of Object.entries(acc)) {
        if (d.dot <= 0) continue;
        const pct = (d.liq / d.dot) * 100;
        payload.push(
          {
            tenant_id: mun.id, secretaria_slug: slug,
            indicador: "Execução orçamentária",
            valor: Math.round(pct * 100) / 100, unidade: "%",
            status: pct >= 70 ? "ok" : pct >= 40 ? "atencao" : "critico",
            referencia_data: referencia, fonte: "api:siconfi-rreo",
          },
          {
            tenant_id: mun.id, secretaria_slug: slug,
            indicador: "Dotação atualizada",
            valor: d.dot, unidade: "R$", status: "ok",
            referencia_data: referencia, fonte: "api:siconfi-rreo",
          },
        );
      }

      if (payload.length > 0) {
        const { error } = await supabase.from("kpis").upsert(payload, {
          onConflict: "tenant_id,indicador,referencia_data,secretaria_slug",
        });
        if (error) errosMun.push(`upsert RREO: ${error.message}`);
        else kpisMun += payload.length;
      }
    } catch (err) {
      errosMun.push(`RREO: ${err instanceof Error ? err.message : String(err)}`);
    }

    await new Promise((r) => setTimeout(r, 600)); // polidez

    // ─── RGF Anexo 01 (despesa pessoal x RCL) ──────────────────────────
    try {
      const url = new URL(`${SICONFI_BASE}/rgf`);
      url.searchParams.set("an_exercicio", String(ano));
      url.searchParams.set("nr_periodo", "3");
      url.searchParams.set("co_tipo_demonstrativo", "RGF");
      url.searchParams.set("id_ente", mun.ibge_codigo);
      url.searchParams.set("co_poder", "M");

      const items = await fetchSiconfi(url);
      // Procurar a linha "% DA DESPESA TOTAL COM PESSOAL - DTP / RCL (V)"
      const linhaPct = items.find((i: any) =>
        String(i.conta ?? "").toUpperCase().includes("DESPESA TOTAL COM PESSOAL") &&
        String(i.coluna ?? "").includes("%")
      );
      const pct = linhaPct ? parseFloat(linhaPct.valor ?? "0") : 0;

      if (pct > 0) {
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
        if (error) errosMun.push(`upsert RGF: ${error.message}`);
        else kpisMun += 1;
      }
    } catch (err) {
      errosMun.push(`RGF: ${err instanceof Error ? err.message : String(err)}`);
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
        tenant_id: mun.id,
        secretaria_slug: "financas",
        nome: NOME_INTEGRADOR,
        descricao: "Execução orçamentária e LRF municipal via SICONFI/Tesouro Nacional",
        tipo: "api_rest",
        endpoint: SICONFI_BASE,
        config: { ibge_codigo: mun.ibge_codigo, uf: "PA" },
        status,
        ultimo_sync: new Date().toISOString(),
        ultimo_erro: errosMun.length ? errosMun.join(" | ").slice(0, 1000) : null,
        total_registros_importados: kpisMun,
      }).select("id").single();
      integradorId = novo?.id ?? null;
    }

    await supabase.from("sync_logs").insert({
      tenant_id: mun.id,
      integrador_id: integradorId,
      iniciado_at: new Date(t0).toISOString(),
      concluido_at: new Date().toISOString(),
      status: errosMun.length === 0 ? "sucesso" : kpisMun > 0 ? "parcial" : "erro",
      registros_salvos: kpisMun,
      duracao_ms: Date.now() - t0,
      erro_mensagem: errosMun.length ? errosMun.join(" | ").slice(0, 2000) : null,
    });

    resultados.push({ municipio: mun.nome, ibge: mun.ibge_codigo, kpis_salvos: kpisMun, erros: errosMun });
    erros.push(...errosMun.map((e) => `${mun.nome}: ${e}`));

    await new Promise((r) => setTimeout(r, 600));
  }

  const totalKpis = resultados.reduce((a, r) => a + r.kpis_salvos, 0);

  return new Response(
    JSON.stringify({
      municipios_aderentes: municipios.length,
      municipios_processados: resultados.filter((r) => r.kpis_salvos > 0).length,
      kpis_salvos: totalKpis,
      periodo: { ano, bimestre },
      resultados,
      erros,
      duracao_ms: Date.now() - inicio,
      executado_em: new Date().toISOString(),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
