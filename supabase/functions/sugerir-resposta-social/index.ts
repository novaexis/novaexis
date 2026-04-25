// Sugere resposta institucional para uma menção social
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const mencaoId = String(body.mencao_id ?? "");
    if (!mencaoId) return json({ error: "mencao_id requerido" }, 400);

    const { data: m, error } = await supabase
      .from("mencoes_sociais")
      .select("id, tenant_id, plataforma, conteudo, autor, sentimento, temas")
      .eq("id", mencaoId)
      .single();
    if (error || !m) return json({ error: "Menção não encontrada" }, 404);

    const { data: tenant } = await supabase
      .from("tenants")
      .select("nome")
      .eq("id", m.tenant_id)
      .single();

    const sys = `Você é assessor de comunicação da Prefeitura de ${tenant?.nome ?? "—"}.
Gere 3 versões de resposta institucional curta para uma menção em ${m.plataforma}, em pt-BR.
Tom: empático, transparente, propositivo. Nunca prometa o que não pode cumprir. Máx 280 caracteres por versão.
Formato de retorno: JSON estrito {"versoes": ["...", "...", "..."]}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Menção (sentimento=${m.sentimento}): "${m.conteudo}"` },
        ],
      }),
    });

    if (!r.ok) {
      if (r.status === 429) return json({ error: "Muitas requisições" }, 429);
      if (r.status === 402) return json({ error: "Créditos esgotados" }, 402);
      return json({ error: "Falha IA" }, 500);
    }
    const data = await r.json();
    const txt = data?.choices?.[0]?.message?.content ?? "{}";
    const clean = txt.replace(/^```json\s*/i, "").replace(/```$/g, "").trim();
    let versoes: string[] = [];
    try {
      versoes = JSON.parse(clean).versoes ?? [];
    } catch {
      versoes = [clean];
    }

    // Persistir 1ª como sugestão padrão
    if (versoes[0]) {
      await supabase
        .from("mencoes_sociais")
        .update({ sugestao_resposta: versoes[0] })
        .eq("id", mencaoId);
    }

    return json({ versoes });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : "erro" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
