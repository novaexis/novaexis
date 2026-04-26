// @ts-nocheck
/**
 * sync-municipal-completo — Orquestrador das integrações municipais.
 *
 * Por enquanto invoca apenas sync-siconfi-municipal. Próximas funções
 * (sync-saude-municipal, sync-educacao-municipal, sync-assistencia-municipal)
 * serão adicionadas incrementalmente nesta lista.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FUNCOES = [
  { nome: "sync-siconfi-municipal", descricao: "SICONFI — Finanças municipais", delay: 2000 },
  { nome: "sync-saude-municipal", descricao: "CNES — Saúde municipal", delay: 2000 },
  // { nome: "sync-educacao-municipal", descricao: "FNDE — Educação", delay: 2000 },
  // { nome: "sync-assistencia-municipal", descricao: "Portal Transparência — Assistência", delay: 2000 },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const baseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const inicio = Date.now();
  const resultados: any[] = [];

  for (const f of FUNCOES) {
    const t0 = Date.now();
    try {
      const res = await fetch(`${baseUrl}/functions/v1/${f.nome}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      const json = await res.json().catch(() => ({}));
      resultados.push({
        funcao: f.nome,
        descricao: f.descricao,
        sucesso: res.ok,
        status_http: res.status,
        kpis_salvos: json.kpis_salvos ?? 0,
        municipios_processados: json.municipios_processados ?? 0,
        erros: json.erros ?? [],
        duracao_ms: Date.now() - t0,
      });
    } catch (err) {
      resultados.push({
        funcao: f.nome,
        descricao: f.descricao,
        sucesso: false,
        erro: err instanceof Error ? err.message : String(err),
        duracao_ms: Date.now() - t0,
      });
    }
    if (f.delay) await new Promise((r) => setTimeout(r, f.delay));
  }

  const totalKpis = resultados.reduce((acc, r) => acc + (r.kpis_salvos || 0), 0);

  return new Response(
    JSON.stringify({
      total_kpis_salvos: totalKpis,
      total_funcoes: FUNCOES.length,
      duracao_total_ms: Date.now() - inicio,
      resultados,
      executado_em: new Date().toISOString(),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
