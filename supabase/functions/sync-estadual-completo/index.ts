// @ts-nocheck
/**
 * sync-estadual-completo — Orquestra todas as sincronizações da camada estadual
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FUNCOES = [
  { nome: "sync-siconfi", descricao: "SICONFI — Dados financeiros", delay: 2000 },
  { nome: "sync-cnes", descricao: "CNES — Saúde", delay: 1000 },
  { nome: "sync-portal-transparencia", descricao: "Portal Transparência", delay: 1000 },
  { nome: "sync-sinesp", descricao: "SINESP — Segurança", delay: 2000 },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const baseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resultados: any[] = [];

  for (const fn of FUNCOES) {
    try {
      const res = await fetch(`${baseUrl}/functions/v1/${fn.nome}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      const data = await res.json().catch(() => ({}));
      resultados.push({ funcao: fn.nome, sucesso: res.ok, ...data });
      console.log(`[orquestrador] ${fn.descricao}: ${data.kpis_salvos ?? 0} KPIs`);
    } catch (err) {
      resultados.push({
        funcao: fn.nome,
        sucesso: false,
        erro: err instanceof Error ? err.message : String(err),
      });
    }
    await new Promise((r) => setTimeout(r, fn.delay));
  }

  const totalKpis = resultados.reduce((acc, r) => acc + (r.kpis_salvos ?? 0), 0);
  const erros = resultados.filter((r) => !r.sucesso || (r.erros?.length ?? 0) > 0);

  return new Response(
    JSON.stringify({
      resultados,
      total_kpis_salvos: totalKpis,
      funcoes_com_erro: erros.map((e) => e.funcao),
      executado_em: new Date().toISOString(),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
