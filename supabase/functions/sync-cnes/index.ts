// @ts-nocheck
/**
 * sync-cnes — Leitos SUS e estabelecimentos de saúde do Pará
 * via API DATASUS apidadosabertos.saude.gov.br
 *
 * UF Pará = código IBGE 15.
 * CNES_API_KEY é opcional — sem ela tenta de qualquer forma e marca
 * o integrador como "erro" amigável se a API exigir auth.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CNES_BASE = "https://apidadosabertos.saude.gov.br/v1";
const NOME_INTEGRADOR = "CNES — Cadastro Nacional de Estabelecimentos de Saúde";

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
  const referencia = new Date().toISOString().slice(0, 10);

  const apiKey = Deno.env.get("CNES_API_KEY");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  // ─── Leitos SUS ─────────────────────────────────────────────────────────
  try {
    const url = new URL(`${CNES_BASE}/cnes/leitos`);
    url.searchParams.set("codigo_uf", "15");
    url.searchParams.set("limit", "200");

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) throw new Error(`leitos HTTP ${res.status}`);

    const data = await res.json();
    const itens = data.results ?? data.data ?? data ?? [];

    let totalExist = 0;
    let totalSUS = 0;
    for (const it of itens) {
      totalExist += parseInt(it.qt_exist ?? it.leitos_existentes ?? "0") || 0;
      totalSUS += parseInt(it.qt_sus ?? it.leitos_sus ?? "0") || 0;
    }

    if (totalSUS > 0 || totalExist > 0) {
      const payload: any[] = [];
      if (totalSUS > 0) {
        payload.push({
          tenant_id: tenantId, secretaria_slug: "sespa",
          indicador: "Leitos SUS disponíveis",
          valor: totalSUS, unidade: "leitos",
          status: totalSUS > 3000 ? "ok" : totalSUS > 1500 ? "atencao" : "critico",
          referencia_data: referencia, fonte: "api:cnes",
        });
      }
      if (totalExist > 0) {
        payload.push({
          tenant_id: tenantId, secretaria_slug: "sespa",
          indicador: "Total leitos existentes",
          valor: totalExist, unidade: "leitos", status: "ok",
          referencia_data: referencia, fonte: "api:cnes",
        });
      }
      const { error } = await supabase.from("kpis").upsert(payload, {
        onConflict: "tenant_id,indicador,referencia_data,secretaria_slug",
      });
      if (error) throw new Error(`upsert leitos: ${error.message}`);
      kpisSalvos += payload.length;
    }
  } catch (err) {
    erros.push(`leitos: ${err instanceof Error ? err.message : String(err)}`);
  }

  await new Promise((r) => setTimeout(r, 500));

  // ─── Estabelecimentos ativos ────────────────────────────────────────────
  try {
    const url = new URL(`${CNES_BASE}/cnes/estabelecimentos`);
    url.searchParams.set("codigo_uf", "15");
    url.searchParams.set("situacao_estabelecimento", "A");
    url.searchParams.set("limit", "1");
    url.searchParams.set("count", "true");

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) throw new Error(`estabelecimentos HTTP ${res.status}`);

    const data = await res.json();
    const total = data.count ?? data.total ?? data.totalElements ?? 0;

    if (total > 0) {
      const { error } = await supabase.from("kpis").upsert(
        [{
          tenant_id: tenantId, secretaria_slug: "sespa",
          indicador: "Estabelecimentos SUS ativos",
          valor: total, unidade: "unidades", status: "ok",
          referencia_data: referencia, fonte: "api:cnes",
        }],
        { onConflict: "tenant_id,indicador,referencia_data,secretaria_slug" },
      );
      if (error) throw new Error(`upsert estab: ${error.message}`);
      kpisSalvos += 1;
    }
  } catch (err) {
    erros.push(`estabelecimentos: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ─── Integrador + log ───────────────────────────────────────────────────
  const status = erros.length === 0 ? "ativo" : kpisSalvos > 0 ? "ativo" : "erro";
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
      tenant_id: tenantId, secretaria_slug: "sespa",
      nome: NOME_INTEGRADOR,
      descricao: "Leitos SUS, estabelecimentos e profissionais de saúde no Pará",
      tipo: "api_rest", endpoint: CNES_BASE,
      config: { codigo_uf: "15", api_key_configured: !!apiKey },
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
    status: erros.length === 0 ? "sucesso" : kpisSalvos > 0 ? "parcial" : "erro",
    registros_salvos: kpisSalvos,
    duracao_ms: Date.now() - inicio,
    erro_mensagem: erros.length ? erros.join(" | ").slice(0, 2000) : null,
  });

  return new Response(
    JSON.stringify({ kpis_salvos: kpisSalvos, erros, api_key_configurada: !!apiKey }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
