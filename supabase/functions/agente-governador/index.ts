// Assessor estratégico do Governador — usa Lovable AI Gateway (Gemini)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é o assessor estratégico do Governador do Estado do Pará.

Analise os indicadores das secretarias estaduais fornecidos e responda de forma direta,
orientada a decisão política e administrativa de alto nível.

Você tem acesso a: KPIs das 6 secretarias estaduais (snapshot atual + histórico recente),
repasses federais ativos com seu status e alertas de prazos.

Para cada resposta, estruture obrigatoriamente nestes três blocos com esses títulos exatos em markdown:

## Situação atual
[O que os dados revelam sobre o estado do Pará hoje — máximo 2 parágrafos]

## Problemas identificados
[Máximo 3 problemas críticos que precisam de atenção imediata, com a secretaria responsável entre parênteses]

## Estratégias recomendadas
[Ações concretas, com secretaria responsável e prazo sugerido para cada uma — formato de lista]

Responda sempre em português brasileiro. Linguagem executiva, direta, sem jargão técnico. Máximo 400 palavras.`;

interface Body {
  pergunta: string;
  secretaria_slug?: string | null;
  historico?: { role: "user" | "assistant"; content: string }[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return json({ error: "LOVABLE_API_KEY não configurada" }, 500);
    }

    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Não autenticado" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: auth } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Não autenticado" }, 401);

    const body = (await req.json()) as Body;
    if (!body.pergunta || body.pergunta.trim().length < 3) {
      return json({ error: "Pergunta vazia" }, 400);
    }

    // Tenant do estado
    const { data: tenants } = await supabase
      .from("tenants")
      .select("id, nome")
      .eq("tipo", "estado")
      .limit(1);
    const tenantEstado = tenants?.[0];
    if (!tenantEstado) return json({ error: "Tenant estado não encontrado" }, 404);

    // Buscar contexto
    let kpisQuery = supabase
      .from("kpis")
      .select("secretaria_slug, indicador, valor, unidade, variacao_pct, status, referencia_data")
      .eq("tenant_id", tenantEstado.id)
      .gte("referencia_data", new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().split("T")[0])
      .order("referencia_data", { ascending: false })
      .limit(200);
    if (body.secretaria_slug) {
      kpisQuery = kpisQuery.eq("secretaria_slug", body.secretaria_slug);
    }

    const [{ data: kpis }, { data: repasses }, { data: alertas }] = await Promise.all([
      kpisQuery,
      supabase
        .from("repasses_estaduais")
        .select("fonte, descricao, valor, prazo, status, requisito_pendente, progresso_pct")
        .eq("tenant_id", tenantEstado.id)
        .in("status", ["pendente", "em_risco", "em_andamento"]),
      supabase
        .from("alertas_prazos")
        .select("titulo, tipo, status, prazo, valor_estimado")
        .eq("tenant_id", tenantEstado.id)
        .limit(20),
    ]);

    const contexto = {
      estado: tenantEstado.nome,
      secretaria_focada: body.secretaria_slug ?? "todas",
      kpis_estaduais: kpis ?? [],
      repasses_pendentes_em_risco: repasses ?? [],
      alertas_ativos: alertas ?? [],
    };

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(body.historico ?? []).slice(-6),
      {
        role: "user",
        content: `Dados do contexto (JSON):\n\`\`\`json\n${JSON.stringify(contexto, null, 2)}\n\`\`\`\n\nPergunta do governador: ${body.pergunta}`,
      },
    ];

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
      }),
    });

    if (aiRes.status === 429) {
      return json({ error: "Limite de requisições atingido. Tente novamente em alguns instantes." }, 429);
    }
    if (aiRes.status === 402) {
      return json({ error: "Créditos da IA esgotados. Adicione créditos em Settings > Workspace > Usage." }, 402);
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, t);
      return json({ error: "Erro ao consultar IA" }, 500);
    }

    const aiData = await aiRes.json();
    const resposta = aiData?.choices?.[0]?.message?.content ?? "(resposta vazia)";

    return json({ resposta });
  } catch (err) {
    console.error("agente-governador error:", err);
    return json({ error: err instanceof Error ? err.message : "Erro desconhecido" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
