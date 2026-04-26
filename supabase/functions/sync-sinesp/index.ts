// @ts-nocheck
/**
 * sync-sinesp — Estatísticas criminais do Pará
 * Fonte: dados.gov.br (CSV mensal por UF). Sem auth.
 *
 * Estratégia: consultar metadados CKAN do dataset, baixar o CSV
 * mais recente e agregar por tipo de crime para UF=PA.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DATASET_URL = "https://dados.gov.br/api/3/action/package_show?id=sistema-nacional-de-estatisticas-de-seguranca-publica";
const NOME_INTEGRADOR = "SINESP — Estatísticas Nacionais de Segurança Pública";
const POP_PARA = 8777124; // estimativa IBGE 2024

const MAPEAMENTO: Record<string, string> = {
  "homicídio doloso": "Homicídios dolosos",
  "homicidio doloso": "Homicídios dolosos",
  "cvli": "Crimes violentos letais intencionais",
  "roubo": "Roubos totais",
  "furto": "Furtos totais",
  "feminicídio": "Feminicídios",
  "feminicidio": "Feminicídios",
  "estupro": "Estupros registrados",
  "tráfico de drogas": "Ocorrências tráfico de drogas",
  "trafico de drogas": "Ocorrências tráfico de drogas",
};

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

  try {
    const metaRes = await fetch(DATASET_URL);
    if (!metaRes.ok) throw new Error(`metadados HTTP ${metaRes.status}`);
    const meta = await metaRes.json();
    const resources = meta.result?.resources ?? [];

    const csv = resources
      .filter((r: any) => (r.format ?? "").toLowerCase() === "csv" || (r.url ?? "").toLowerCase().endsWith(".csv"))
      .sort((a: any, b: any) => new Date(b.created ?? 0).getTime() - new Date(a.created ?? 0).getTime())[0];

    if (!csv?.url) throw new Error("CSV não encontrado nos metadados");

    const csvRes = await fetch(csv.url);
    if (!csvRes.ok) throw new Error(`download CSV HTTP ${csvRes.status}`);

    // Tentar decodificar como ISO-8859-1 (encoding comum em CSV govbr)
    const buf = await csvRes.arrayBuffer();
    let text: string;
    try {
      text = new TextDecoder("iso-8859-1").decode(buf);
    } catch {
      text = new TextDecoder("utf-8").decode(buf);
    }

    const linhas = text.split(/\r?\n/);
    if (linhas.length < 2) throw new Error("CSV vazio");

    const sep = linhas[0].includes(";") ? ";" : ",";
    const cab = linhas[0].split(sep).map((c) => c.trim().toLowerCase().replace(/^"|"$/g, ""));

    const idx = (predicates: string[]) =>
      cab.findIndex((c) => predicates.some((p) => c.includes(p)));

    const idxUF = idx(["uf", "estado"]);
    const idxTipo = idx(["tipo", "natureza", "evento"]);
    const idxOcc = idx(["ocorrencia", "ocorrência", "quantidade", "vitimas", "vítimas"]);
    const idxAno = idx(["ano"]);
    const idxMes = idx(["mes", "mês"]);

    if (idxUF < 0 || idxTipo < 0 || idxOcc < 0) {
      throw new Error(`colunas não identificadas. Cabeçalho: ${cab.slice(0, 10).join(",")}`);
    }

    const crimes: Record<string, number> = {};
    let anoRef = new Date().getFullYear() - 1;
    let mesRef = 12;

    for (let i = 1; i < linhas.length; i++) {
      const l = linhas[i];
      if (!l.trim()) continue;
      const cols = l.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));

      const uf = (cols[idxUF] ?? "").toUpperCase();
      if (!["PA", "PARÁ", "PARA"].includes(uf)) continue;

      const tipo = (cols[idxTipo] ?? "").toLowerCase();
      const qtd = parseInt(cols[idxOcc] ?? "0") || 0;
      if (qtd <= 0) continue;

      if (idxAno >= 0) anoRef = parseInt(cols[idxAno]) || anoRef;
      if (idxMes >= 0) mesRef = parseInt(cols[idxMes]) || mesRef;

      crimes[tipo] = (crimes[tipo] ?? 0) + qtd;
    }

    const referencia = `${anoRef}-${String(Math.min(12, Math.max(1, mesRef))).padStart(2, "0")}-01`;
    const payload: any[] = [];

    for (const [tipo, qtd] of Object.entries(crimes)) {
      for (const [chave, indicador] of Object.entries(MAPEAMENTO)) {
        if (tipo.includes(chave)) {
          payload.push({
            tenant_id: tenantId, secretaria_slug: "segup",
            indicador, valor: qtd, unidade: "ocorrências", status: "ok",
            referencia_data: referencia, fonte: "api:sinesp",
          });
          break;
        }
      }
    }

    // Taxa de homicídios por 100k
    const homicidios = crimes["homicídio doloso"] ?? crimes["homicidio doloso"] ?? 0;
    if (homicidios > 0) {
      const taxa = (homicidios / POP_PARA) * 100000;
      payload.push({
        tenant_id: tenantId, secretaria_slug: "segup",
        indicador: "Taxa de homicídios por 100k habitantes",
        valor: Math.round(taxa * 10) / 10, unidade: "por 100k",
        status: taxa > 25 ? "critico" : taxa > 15 ? "atencao" : "ok",
        referencia_data: referencia, fonte: "api:sinesp",
      });
    }

    if (payload.length > 0) {
      const { error } = await supabase.from("kpis").upsert(payload, {
        onConflict: "tenant_id,indicador,referencia_data,secretaria_slug",
      });
      if (error) throw new Error(`upsert: ${error.message}`);
      kpisSalvos = payload.length;
    }
  } catch (err) {
    erros.push(err instanceof Error ? err.message : String(err));
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
      tenant_id: tenantId, secretaria_slug: "segup",
      nome: NOME_INTEGRADOR,
      descricao: "CSV mensal de estatísticas criminais via dados.gov.br (SINESP)",
      tipo: "api_rest", endpoint: DATASET_URL,
      config: { uf: "PA" },
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
    JSON.stringify({ kpis_salvos: kpisSalvos, erros }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
