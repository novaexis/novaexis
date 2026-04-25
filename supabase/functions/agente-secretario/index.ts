// Agente Estratégico do Secretário — contexto restrito à secretaria
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const NOMES_SECRETARIA: Record<string, string> = {
  saude: "Saúde",
  educacao: "Educação",
  financas: "Finanças",
  infraestrutura: "Infraestrutura",
  seguranca: "Segurança",
  assistencia: "Assistência Social",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization" }, 401);

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
    const historico = Array.isArray(body.historico_conversa)
      ? body.historico_conversa
      : [];
    const secretariaSlugBody: string | undefined = body.secretaria_slug;

    if (!pergunta) return json({ error: "Pergunta vazia" }, 400);

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, nome")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id)
      return json({ error: "Sem tenant" }, 403);

    // Secretaria pode vir do body ou da role do usuário
    const { data: roleSecretario } = await supabase
      .from("user_roles")
      .select("secretaria_slug")
      .eq("user_id", user.id)
      .eq("role", "secretario")
      .maybeSingle();

    const secretariaSlug =
      secretariaSlugBody || roleSecretario?.secretaria_slug;
    if (!secretariaSlug)
      return json({ error: "Secretaria não identificada" }, 400);

    const nomeSecretaria =
      NOMES_SECRETARIA[secretariaSlug] || secretariaSlug;

    const { data: tenant } = await supabase
      .from("tenants")
      .select("nome, populacao")
      .eq("id", profile.tenant_id)
      .single();

    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - 30);

    const [{ data: kpis }, { data: demandas }] = await Promise.all([
      supabase
        .from("kpis")
        .select(
          "indicador, valor, unidade, status, variacao_pct, referencia_data",
        )
        .eq("tenant_id", profile.tenant_id)
        .eq("secretaria_slug", secretariaSlug)
        .gte("referencia_data", dataInicio.toISOString().split("T")[0])
        .order("referencia_data", { ascending: false }),
      supabase
        .from("demandas")
        .select("status, prazo_sla, prioridade")
        .eq("tenant_id", profile.tenant_id)
        .eq("secretaria_slug", secretariaSlug),
    ]);

    const demandasAbertas = (demandas || []).filter(
      (d: any) => d.status !== "concluida" && d.status !== "cancelada",
    ).length;
    const demandasVencidas = (demandas || []).filter(
      (d: any) =>
        d.status !== "concluida" &&
        d.prazo_sla &&
        new Date(d.prazo_sla) < new Date(),
    ).length;

    const systemPrompt = `Você é o assessor estratégico do secretário de ${nomeSecretaria} do município de ${tenant?.nome ?? "—"}, Pará.

Foco EXCLUSIVO na ${nomeSecretaria}. Suas respostas devem considerar:
- Os indicadores e metas da secretaria
- As demandas abertas dos cidadãos
- O orçamento disponível e execução
- As integrações com outras secretarias QUANDO relevante para ${nomeSecretaria}

Você NUNCA deve revelar dados de outras secretarias que não foram fornecidos neste contexto.
Seja prático e operacional — o secretário precisa de orientações táticas, não estratégicas.

=== DADOS DA ${nomeSecretaria.toUpperCase()} ===
KPIs atuais (últimos 30 dias):
${JSON.stringify(kpis || [], null, 2)}

Demandas abertas: ${demandasAbertas} | Vencidas SLA: ${demandasVencidas}

=== INSTRUÇÕES ===
- Sempre em português brasileiro
- Direto e objetivo, máximo 4 parágrafos
- Use markdown para destacar pontos
- Nunca invente dados`;

    const mensagens = [
      { role: "system", content: systemPrompt },
      ...historico.slice(-8),
      { role: "user", content: pergunta },
    ];

    const aiRes = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: mensagens,
        }),
      },
    );

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      if (aiRes.status === 429)
        return json({ error: "Muitas requisições. Aguarde." }, 429);
      if (aiRes.status === 402)
        return json({ error: "Créditos de IA esgotados." }, 402);
      return json({ error: "Falha IA" }, 500);
    }

    const aiData = await aiRes.json();
    const resposta = aiData?.choices?.[0]?.message?.content ?? "Sem resposta.";
    const tokens =
      (aiData?.usage?.prompt_tokens || 0) +
      (aiData?.usage?.completion_tokens || 0);

    await supabase.from("conversas_ia").insert({
      tenant_id: profile.tenant_id,
      usuario_id: user.id,
      tipo: "secretario",
      secretaria_slug: secretariaSlug,
      pergunta,
      resposta,
      tokens_usados: tokens,
    });

    return json({ resposta });
  } catch (err) {
    console.error("agente-secretario error:", err);
    return json({ error: err instanceof Error ? err.message : "Erro" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
