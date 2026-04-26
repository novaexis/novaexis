// @ts-nocheck
/**
 * sync-portal-transparencia — Bolsa Família, transferências SUS e FPE para o PA
 * API: https://api.portaldatransparencia.gov.br/api-de-dados
 *
 * Requer secret PORTAL_TRANSPARENCIA_API_KEY (gratuita).
 * Sem a key, retorna erro amigável e marca integrador como "erro".
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE = "https://api.portaldatransparencia.gov.br/api-de-dados";
const NOME_INTEGRADOR = "Portal Transparência Federal — Benefícios e Transferências";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: tenant } = await supabase
    .from("tenants").select("id").eq("tipo", "estado").eq("estado", "PA").maybeSingle();
  if (!tenant) {
    return new Response(JSON.stringify({ erro: "Tenant estadual não encontrado" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const tenantId = tenant.id as string;
  const inicio = Date.now();
  const erros: string[] = [];
  let kpisSalvos = 0;

  const apiKey = Deno.env.get("PORTAL_TRANSPARENCIA_API_KEY");
  const hoje = new Date();
  const referencia = hoje.toISOString().slice(0, 10);

  if (!apiKey) {
    erros.push("PORTAL_TRANSPARENCIA_API_KEY não configurada — solicite chave gratuita em portaldatransparencia.gov.br/api-de-dados");
  } else {
    const headers = { "chave-api-dados": apiKey, Accept: "application/json" };
    // referência de mês defasada: usa mês anterior (dado mais provável de existir)
    const mesRef = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const mesAno = `${mesRef.getFullYear()}${String(mesRef.getMonth() + 1).padStart(2, "0")}`;

    // ─── 1. Bolsa Família ────────────────────────────────────────────────
    try {
      const url = new URL(`${BASE}/novo-bolsa-familia-por-municipio`);
      url.searchParams.set("mesAno", mesAno);
      url.searchParams.set("codigoIbge", "15");
      url.searchParams.set("pagina", "1");

      const res = await fetch(url.toString(), { headers });
      if (!res.ok) throw new Error(`BF HTTP ${res.status}`);
      const data = await res.json();
      const itens = Array.isArray(data) ? data : [data];

      let beneficiarios = 0;
      let valorTotal = 0;
      for (const it of itens) {
        beneficiarios += parseInt(it.quantidadeBeneficiariosBolsaFamilia ?? it.quantidade ?? "0") || 0;
        valorTotal += parseFloat(it.valorTotalBolsaFamilia ?? it.valor ?? "0") || 0;
      }

      if (beneficiarios > 0 || valorTotal > 0) {
        const payload: any[] = [];
        if (beneficiarios > 0) payload.push({
          tenant_id: tenantId, secretaria_slug: "semas",
          indicador: "Beneficiários Bolsa Família",
          valor: beneficiarios, unidade: "pessoas", status: "ok",
          referencia_data: referencia, fonte: "api:portal-transparencia-bf",
        });
        if (valorTotal > 0) payload.push({
          tenant_id: tenantId, secretaria_slug: "semas",
          indicador: "Valor total Bolsa Família",
          valor: valorTotal, unidade: "R$", status: "ok",
          referencia_data: referencia, fonte: "api:portal-transparencia-bf",
        });
        const { error } = await supabase.from("kpis").upsert(payload, {
          onConflict: "tenant_id,indicador,referencia_data,secretaria_slug",
        });
        if (error) throw new Error(`upsert BF: ${error.message}`);
        kpisSalvos += payload.length;
      }
    } catch (err) {
      erros.push(`Bolsa Família: ${err instanceof Error ? err.message : String(err)}`);
    }

    await new Promise((r) => setTimeout(r, 500));

    // ─── 2. Transferências SUS (saúde) ───────────────────────────────────
    try {
      const ano = hoje.getFullYear();
      const url = new URL(`${BASE}/transferencias-voluntarias`);
      url.searchParams.set("dataInicioPagamento", `01/01/${ano}`);
      url.searchParams.set("dataFimPagamento", `31/12/${ano}`);
      url.searchParams.set("codigoOrgaoSuperior", "36000");
      url.searchParams.set("uf", "PA");
      url.searchParams.set("pagina", "1");

      const res = await fetch(url.toString(), { headers });
      if (!res.ok) throw new Error(`Transf SUS HTTP ${res.status}`);
      const data = await res.json();
      const itens = Array.isArray(data) ? data : [];
      const valor = itens.reduce((acc, it) => acc + (parseFloat(it.valorPago ?? it.valor ?? "0") || 0), 0);

      if (valor > 0) {
        const { error } = await supabase.from("kpis").upsert(
          [{
            tenant_id: tenantId, secretaria_slug: "sespa",
            indicador: "Transferências federais saúde (ano)",
            valor, unidade: "R$", status: "ok",
            referencia_data: referencia, fonte: "api:portal-transparencia-transf",
          }],
          { onConflict: "tenant_id,indicador,referencia_data,secretaria_slug" },
        );
        if (error) throw new Error(`upsert transf: ${error.message}`);
        kpisSalvos += 1;
      }
    } catch (err) {
      erros.push(`Transferências saúde: ${err instanceof Error ? err.message : String(err)}`);
    }

    await new Promise((r) => setTimeout(r, 500));

    // ─── 3. FPE ──────────────────────────────────────────────────────────
    try {
      const ano = hoje.getFullYear();
      const url = new URL(`${BASE}/transferencias-constitucionais`);
      url.searchParams.set("ano", String(ano));
      url.searchParams.set("uf", "PA");
      url.searchParams.set("tipo", "FPE");

      const res = await fetch(url.toString(), { headers });
      if (!res.ok) throw new Error(`FPE HTTP ${res.status}`);
      const data = await res.json();
      const itens = Array.isArray(data) ? data : [];
      const ultimo = itens[itens.length - 1];
      const valorFPE = parseFloat(ultimo?.valor ?? ultimo?.valorTransferido ?? "0") || 0;

      if (valorFPE > 0) {
        const { error } = await supabase.from("kpis").upsert(
          [{
            tenant_id: tenantId, secretaria_slug: "sefa",
            indicador: "FPE recebido (mês mais recente)",
            valor: valorFPE, unidade: "R$", status: "ok",
            referencia_data: referencia, fonte: "api:portal-transparencia-fpe",
          }],
          { onConflict: "tenant_id,indicador,referencia_data,secretaria_slug" },
        );
        if (error) throw new Error(`upsert FPE: ${error.message}`);
        kpisSalvos += 1;
      }
    } catch (err) {
      erros.push(`FPE: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ─── Integrador + log ───────────────────────────────────────────────────
  const status = !apiKey ? "aguardando_configuracao" : (erros.length === 0 ? "ativo" : kpisSalvos > 0 ? "ativo" : "erro");
  const { data: integ } = await supabase
    .from("integradores").select("id, total_registros_importados")
    .eq("tenant_id", tenantId).eq("nome", NOME_INTEGRADOR).maybeSingle();

  let integradorId: string | null = integ?.id ?? null;
  if (integ) {
    await supabase.from("integradores").update({
      status,
      ultimo_sync: new Date().toISOString(),
      ultimo_erro: erros.length ? erros.join(" | ").slice(0, 1000) : null,
      total_registros_importados: (integ.total_registros_importados ?? 0) + kpisSalvos,
    }).eq("id", integ.id);
  } else {
    const { data: novo } = await supabase.from("integradores").insert({
      tenant_id: tenantId, secretaria_slug: "semas",
      nome: NOME_INTEGRADOR,
      descricao: "Bolsa Família, transferências SUS e FPE — API Portal da Transparência Federal",
      tipo: "api_rest", endpoint: BASE,
      config: { uf: "PA", api_key_configured: !!apiKey },
      status,
      ultimo_sync: new Date().toISOString(),
      ultimo_erro: erros.length ? erros.join(" | ").slice(0, 1000) : null,
      total_registros_importados: kpisSalvos,
    }).select("id").single();
    integradorId = novo?.id ?? null;
  }

  await supabase.from("sync_logs").insert({
    tenant_id: tenantId, integrador_id: integradorId,
    iniciado_at: new Date(inicio).toISOString(),
    concluido_at: new Date().toISOString(),
    status: !apiKey ? "erro" : (erros.length === 0 ? "sucesso" : kpisSalvos > 0 ? "parcial" : "erro"),
    registros_salvos: kpisSalvos,
    duracao_ms: Date.now() - inicio,
    erro_mensagem: erros.length ? erros.join(" | ").slice(0, 2000) : null,
  });

  return new Response(
    JSON.stringify({ kpis_salvos: kpisSalvos, erros, api_key_configurada: !!apiKey }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
