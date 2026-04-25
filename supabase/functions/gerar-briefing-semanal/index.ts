// Edge Function: gerar-briefing-semanal
// Gera briefing executivo semanal usando Lovable AI Gateway e persiste em briefings_semanais
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BriefingPayload {
  resumo: string;
  destaques: Array<{ titulo: string; descricao: string }>;
  alertas: Array<{ titulo: string; descricao: string; severidade: string }>;
  recomendacoes: Array<{ titulo: string; descricao: string; prioridade: string }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Identifica usuário e tenant
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, nome")
      .eq("id", userId)
      .maybeSingle();

    const tenantId = profile?.tenant_id;
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "Usuário sem tenant" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Coleta contexto: KPIs recentes, alertas, score social
    const seteDias = new Date();
    seteDias.setDate(seteDias.getDate() - 7);
    const seteDiasISO = seteDias.toISOString().slice(0, 10);

    const [tenant, kpis, alertas, scores] = await Promise.all([
      supabase.from("tenants").select("nome, populacao").eq("id", tenantId).maybeSingle(),
      supabase
        .from("kpis")
        .select("secretaria_slug, indicador, valor, unidade, variacao_pct, status, referencia_data")
        .eq("tenant_id", tenantId)
        .gte("referencia_data", seteDiasISO)
        .order("referencia_data", { ascending: false })
        .limit(40),
      supabase
        .from("alertas_prazos")
        .select("titulo, descricao, status, prazo, valor_estimado, tipo")
        .eq("tenant_id", tenantId)
        .in("status", ["em_risco", "pendente", "em_andamento", "disponivel"])
        .order("prazo", { ascending: true })
        .limit(15),
      supabase
        .from("scores_aprovacao")
        .select("data, score, total_mencoes, temas_trending")
        .eq("tenant_id", tenantId)
        .order("data", { ascending: false })
        .limit(7),
    ]);

    const contexto = {
      municipio: tenant.data?.nome ?? "Município",
      populacao: tenant.data?.populacao ?? null,
      semana: new Date().toISOString().slice(0, 10),
      kpis: kpis.data ?? [],
      alertas: alertas.data ?? [],
      scores: scores.data ?? [],
    };

    // Chama Lovable AI Gateway
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é um analista executivo sênior assessorando um prefeito brasileiro. Produza briefings semanais objetivos, em português, em tom profissional e direto. Sempre retorne JSON válido seguindo o schema solicitado.",
          },
          {
            role: "user",
            content: `Gere um briefing executivo semanal para o município de ${contexto.municipio} com base nestes dados:\n\n${JSON.stringify(contexto, null, 2)}\n\nRetorne JSON com este schema exato:\n{\n  "resumo": "2-3 frases de visão geral da semana",\n  "destaques": [{"titulo":"...", "descricao":"..."}],\n  "alertas": [{"titulo":"...", "descricao":"...", "severidade":"alta|media|baixa"}],\n  "recomendacoes": [{"titulo":"...", "descricao":"...", "prioridade":"alta|media|baixa"}]\n}\n\nLimite: 3 destaques, 3 alertas, 3 recomendações. Seja específico citando números reais dos KPIs.`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(
        JSON.stringify({ error: "Limite de uso da IA atingido. Tente novamente em alguns minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (aiRes.status === 402) {
      return new Response(
        JSON.stringify({ error: "Créditos da IA esgotados. Adicione créditos no workspace." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI Gateway error:", aiRes.status, txt);
      return new Response(
        JSON.stringify({ error: "Falha ao gerar briefing", detail: txt }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiRes.json();
    const raw = aiJson.choices?.[0]?.message?.content ?? "{}";
    let payload: BriefingPayload;
    try {
      payload = JSON.parse(raw);
    } catch (e) {
      console.error("Falha ao parsear JSON da IA:", raw);
      return new Response(
        JSON.stringify({ error: "Resposta da IA inválida" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Monta markdown amigável
    const md = [
      `# Briefing semanal — ${contexto.municipio}`,
      `_Semana de referência: ${contexto.semana}_`,
      "",
      "## Resumo executivo",
      payload.resumo ?? "—",
      "",
      "## Destaques",
      ...(payload.destaques ?? []).map((d) => `- **${d.titulo}** — ${d.descricao}`),
      "",
      "## Alertas",
      ...(payload.alertas ?? []).map(
        (a) => `- **[${(a.severidade ?? "media").toUpperCase()}] ${a.titulo}** — ${a.descricao}`,
      ),
      "",
      "## Recomendações",
      ...(payload.recomendacoes ?? []).map(
        (r) => `- **[${(r.prioridade ?? "media").toUpperCase()}] ${r.titulo}** — ${r.descricao}`,
      ),
    ].join("\n");

    // Persiste
    const { data: inserted, error: insErr } = await supabase
      .from("briefings_semanais")
      .insert({
        tenant_id: tenantId,
        semana_referencia: contexto.semana,
        conteudo_markdown: md,
        destaques: payload.destaques ?? [],
        alertas: payload.alertas ?? [],
        recomendacoes: payload.recomendacoes ?? [],
        gerado_por: userId,
      })
      .select()
      .single();

    if (insErr) {
      console.error("Erro inserindo briefing:", insErr);
      return new Response(
        JSON.stringify({ error: insErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true, briefing: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Erro inesperado:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
