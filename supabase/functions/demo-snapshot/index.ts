// Edge function pública: retorna snapshot read-only dos dados de Marajoense para a demo.
// Sem auth (verify_jwt = false). Usa service role internamente, mas filtra rigidamente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const DEMO_TENANT_NOME = "Marajoense";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const tipo = url.searchParams.get("tipo") ?? "prefeito";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Busca o tenant Marajoense
    const { data: tenant } = await admin
      .from("tenants")
      .select("id, nome, estado, populacao")
      .eq("nome", DEMO_TENANT_NOME)
      .maybeSingle();

    if (!tenant) {
      return json({ error: "demo tenant não encontrado. Rode o seed primeiro." }, 404);
    }

    const tid = tenant.id;

    if (tipo === "prefeito") {
      const [kpis, demandas, alertas, briefings] = await Promise.all([
        admin.from("kpis").select("*").eq("tenant_id", tid).limit(20),
        admin
          .from("demandas")
          .select("id, titulo, status, prioridade, secretaria_slug, created_at")
          .eq("tenant_id", tid)
          .order("created_at", { ascending: false })
          .limit(10),
        admin.from("alertas_prazos").select("*").eq("tenant_id", tid).limit(5),
        admin
          .from("briefings_semanais")
          .select("conteudo_markdown, semana_referencia")
          .eq("tenant_id", tid)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
      return json({
        tenant,
        kpis: kpis.data ?? [],
        demandas: demandas.data ?? [],
        alertas: alertas.data ?? [],
        briefing: briefings.data?.[0] ?? null,
      });
    }

    if (tipo === "cidadao") {
      const { data: secretarias } = await admin
        .from("secretarias")
        .select("slug, nome, ativo")
        .eq("tenant_id", tid)
        .eq("ativo", true);
      return json({
        tenant,
        secretarias: secretarias ?? [],
        servicos_destaque: [
          { slug: "saude", nome: "Agendar consulta", descricao: "UBS e especialidades" },
          { slug: "educacao", nome: "Matrícula escolar", descricao: "Solicitar vaga" },
          { slug: "ouvidoria", nome: "Ouvidoria", descricao: "Reclamar, sugerir, elogiar" },
        ],
      });
    }

    if (tipo === "governador") {
      // Lista municípios aderentes (todos os tenants ativos)
      const { data: municipios } = await admin
        .from("tenants")
        .select("id, nome, estado, populacao")
        .eq("ativo", true)
        .limit(20);

      // Resumo agregado de KPIs por município
      const ids = (municipios ?? []).map((m) => m.id);
      const { data: kpisAll } = await admin
        .from("kpis")
        .select("tenant_id, indicador, valor, status")
        .in("tenant_id", ids);

      return json({
        municipios: municipios ?? [],
        kpis: kpisAll ?? [],
      });
    }

    return json({ error: "tipo inválido (use prefeito|cidadao|governador)" }, 400);
  } catch (e) {
    console.error("demo-snapshot error", e);
    return json({ error: e instanceof Error ? e.message : "erro" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
