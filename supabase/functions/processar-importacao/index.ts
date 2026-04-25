// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { storage_path, tenant_id, secretaria_slug, periodo, mapeamentos_confirmados } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pegar integrador manual da secretaria (para sync_log)
    const { data: integrador } = await supabase
      .from("integradores")
      .select("id, total_registros_importados")
      .eq("tenant_id", tenant_id)
      .eq("secretaria_slug", secretaria_slug)
      .eq("tipo", "importacao_manual")
      .maybeSingle();

    const inicio = Date.now();
    let logId: string | null = null;
    if (integrador) {
      const { data: log } = await supabase
        .from("sync_logs")
        .insert({ integrador_id: integrador.id, tenant_id, status: "em_andamento" })
        .select("id")
        .single();
      logId = log?.id ?? null;
    }

    // Simulação: gera 1 KPI por mapeamento confirmado (em produção, parsear o arquivo real)
    const hoje = new Date().toISOString().split("T")[0];
    const kpis = mapeamentos_confirmados.map((m: any) => ({
      tenant_id,
      secretaria_slug,
      indicador: m.indicador_destino,
      valor: parseFloat(String(m.exemplo_valor).replace(/[^\d.,-]/g, "").replace(",", ".")) * (m.fator_conversao || 1) || 0,
      unidade: m.unidade,
      referencia_data: hoje,
      fonte: `importacao_manual:${storage_path}`,
      status: "ok",
    }));

    const { error: insertErr } = await supabase.from("kpis").insert(kpis);
    const salvos = insertErr ? 0 : kpis.length;
    const ignorados = insertErr ? kpis.length : 0;

    // Salvar mapeamentos aprendidos
    for (const m of mapeamentos_confirmados) {
      await supabase.from("mapeamentos_importacao").insert({
        tenant_id,
        secretaria_slug,
        nome_coluna_origem: m.coluna_origem,
        indicador_destino: m.indicador_destino,
        unidade: m.unidade,
        fator_conversao: m.fator_conversao || 1,
        exemplo_valor: m.exemplo_valor,
        vezes_usado: 1,
      });
    }

    if (logId && integrador) {
      await supabase.from("sync_logs").update({
        concluido_at: new Date().toISOString(),
        status: insertErr ? "erro" : "sucesso",
        registros_processados: kpis.length,
        registros_salvos: salvos,
        registros_ignorados: ignorados,
        erro_mensagem: insertErr?.message ?? null,
        duracao_ms: Date.now() - inicio,
      }).eq("id", logId);

      await supabase.from("integradores").update({
        ultimo_sync: new Date().toISOString(),
        total_registros_importados: (integrador.total_registros_importados ?? 0) + salvos,
      }).eq("id", integrador.id);
    }

    return new Response(JSON.stringify({ processados: kpis.length, salvos, ignorados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("processar-importacao error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
