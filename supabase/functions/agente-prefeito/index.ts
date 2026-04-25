// Agente Estratégico do Prefeito — usa Lovable AI Gateway (Gemini)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Mensagem {
  role: "user" | "assistant";
  content: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const pergunta: string = (body.pergunta || "").toString().trim();
    const historico: Mensagem[] = Array.isArray(body.historico_conversa)
      ? body.historico_conversa
      : [];

    if (!pergunta) return json({ error: "Pergunta vazia" }, 400);
    if (pergunta.length > 2000)
      return json({ error: "Pergunta muito longa (máx 2000 chars)" }, 400);

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, nome")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id)
      return json({ error: "Usuário sem tenant" }, 403);

    const { data: tenant } = await supabase
      .from("tenants")
      .select("nome, populacao, idhm, bioma, ibge_codigo")
      .eq("id", profile.tenant_id)
      .single();

    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - 30);
    const dataInicioStr = dataInicio.toISOString().split("T")[0];

    const [
      { data: kpis },
      { data: alertas },
      { data: insights },
      { data: scoresSocial },
      { data: benchmark },
    ] = await Promise.all([
      supabase
        .from("kpis")
        .select(
          "secretaria_slug, indicador, valor, unidade, status, variacao_pct, referencia_data",
        )
        .eq("tenant_id", profile.tenant_id)
        .gte("referencia_data", dataInicioStr)
        .order("referencia_data", { ascending: false }),
      supabase
        .from("alertas_prazos")
        .select("titulo, tipo, valor_estimado, prazo, status")
        .eq("tenant_id", profile.tenant_id)
        .in("status", ["disponivel", "pendente", "em_risco", "em_andamento"])
        .order("prazo", { ascending: true })
        .limit(10),
      supabase
        .from("insights_cruzados")
        .select(
          "titulo, descricao, prioridade, secretarias, acao_recomendada",
        )
        .eq("tenant_id", profile.tenant_id)
        .gte(
          "created_at",
          new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        )
        .limit(5),
      supabase
        .from("scores_aprovacao")
        .select("data, score, total_mencoes, positivas, negativas, temas_trending")
        .eq("tenant_id", profile.tenant_id)
        .gte(
          "data",
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
        )
        .order("data", { ascending: false })
        .limit(1),
      supabase
        .from("benchmark_cache")
        .select("percentis, destaques_positivos, areas_criticas")
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle(),
    ]);

    const resumoKPIs = resumirKPIs(kpis || []);

    const systemPrompt = `Você é o assessor estratégico pessoal do prefeito ${profile.nome ?? ""}, gestor do município de ${tenant?.nome ?? "—"}, no Estado do Pará.
População: ${tenant?.populacao?.toLocaleString("pt-BR") ?? "—"} habitantes | IDHM: ${tenant?.idhm ?? "—"} | Bioma: ${tenant?.bioma ?? "—"}

Você tem acesso completo ao estado atual da gestão municipal. Use esses dados para responder de forma contextualizada, direta e orientada a ação. Seja como um assessor de confiança: honesto sobre problemas, propositivo nas soluções, respeitoso com a complexidade política.

=== SITUAÇÃO ATUAL DO MUNICÍPIO (últimos 30 dias) ===

KPIs por secretaria:
${JSON.stringify(resumoKPIs, null, 2)}

Alertas de captação ativos (${alertas?.length || 0}):
${JSON.stringify((alertas || []).slice(0, 5), null, 2)}

Insights cruzados recentes:
${JSON.stringify(insights || [], null, 2)}

Reputação nas redes sociais (últimos 7 dias):
${JSON.stringify(scoresSocial?.[0] || {}, null, 2)}

Posicionamento benchmark:
${JSON.stringify(benchmark || {}, null, 2)}

=== INSTRUÇÕES ===
- Responda sempre em português brasileiro
- Seja direto e objetivo — o prefeito tem pouco tempo
- Quando identificar problemas, mencione-os proativamente
- Quando sugerir ações, seja específico: secretaria, ação, prazo
- Máximo 4 parágrafos, salvo se pedido análise detalhada
- Se a pergunta for sobre tema sem dados, diga claramente
- Nunca invente dados — use apenas o fornecido acima
- Use markdown para destacar pontos-chave (negrito, listas)`;

    const mensagens = [
      { role: "system", content: systemPrompt },
      ...historico.slice(-8),
      { role: "user", content: pergunta },
    ];

    // Lovable AI Gateway com retry para 429
    const aiRes = await callAIWithRetry(mensagens);

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI Gateway error:", aiRes.status, errText);
      if (aiRes.status === 429)
        return json({ error: "Muitas requisições. Tente em instantes." }, 429);
      if (aiRes.status === 402)
        return json(
          { error: "Créditos de IA esgotados. Adicione créditos no workspace." },
          402,
        );
      return json({ error: "Falha ao consultar IA" }, 500);
    }

    const aiData = await aiRes.json();
    const resposta: string =
      aiData?.choices?.[0]?.message?.content ?? "Sem resposta.";
    const tokens =
      (aiData?.usage?.prompt_tokens || 0) +
      (aiData?.usage?.completion_tokens || 0);

    await supabase.from("conversas_ia").insert({
      tenant_id: profile.tenant_id,
      usuario_id: user.id,
      tipo: "prefeito",
      pergunta,
      resposta,
      tokens_usados: tokens,
    });

    return json({ resposta });
  } catch (err) {
    console.error("agente-prefeito error:", err);
    return json({ error: err instanceof Error ? err.message : "Erro" }, 500);
  }
});

async function callAIWithRetry(messages: any[], maxRetry = 2): Promise<Response> {
  let attempt = 0;
  let lastRes: Response | null = null;
  while (attempt <= maxRetry) {
    const res = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages,
        }),
      },
    );
    if (res.status !== 429 || attempt === maxRetry) return res;
    lastRes = res;
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    attempt++;
  }
  return lastRes!;
}

function resumirKPIs(kpis: any[]) {
  const porSecretaria: Record<string, any> = {};
  for (const kpi of kpis) {
    if (!porSecretaria[kpi.secretaria_slug]) {
      porSecretaria[kpi.secretaria_slug] = {
        indicadores: [],
        criticos: 0,
        atencao: 0,
        ok: 0,
      };
    }
    const sec = porSecretaria[kpi.secretaria_slug];
    if (!sec.indicadores.find((i: any) => i.indicador === kpi.indicador)) {
      sec.indicadores.push({
        indicador: kpi.indicador,
        valor: kpi.valor,
        unidade: kpi.unidade,
        status: kpi.status,
        variacao_pct: kpi.variacao_pct,
      });
      sec[kpi.status] = (sec[kpi.status] || 0) + 1;
    }
  }
  return porSecretaria;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
