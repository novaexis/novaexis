// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INDICADORES_VALIDOS: Record<string, string[]> = {
  saude: ["atendimentos_mes", "consultas_realizadas", "doses_aplicadas", "cobertura_apf_pct", "orcamento_executado", "tempo_medio_espera_min"],
  educacao: ["matriculas_total", "evasao_pct", "ideb", "merenda_servida", "frequencia_pct", "orcamento_executado"],
  financas: ["receita_corrente", "despesa_corrente", "orcamento_executado", "repasses_recebidos", "saldo_caixa"],
  infraestrutura: ["obras_em_andamento", "obras_concluidas", "valor_executado", "km_pavimentados"],
  seguranca: ["ocorrencias_total", "tempo_resposta_min", "efetivo_ativo"],
  assistencia: ["familias_acompanhadas", "atendimentos_cras", "beneficios_concedidos", "visitas_realizadas"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { storage_path, secretaria_slug, tenant_id, arquivo_nome } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Baixa cabeçalhos amostrais via Storage
    const { data: file, error: dlErr } = await supabase.storage.from("arquivos-importacao").download(storage_path);
    if (dlErr) throw dlErr;
    const text = (await file.text()).slice(0, 4000);

    // Mapeamentos anteriores
    const { data: anteriores } = await supabase
      .from("mapeamentos_importacao")
      .select("nome_coluna_origem, indicador_destino, unidade, fator_conversao")
      .eq("tenant_id", tenant_id)
      .eq("secretaria_slug", secretaria_slug)
      .limit(50);

    const prompt = `Analise o início deste arquivo de dados da secretaria de ${secretaria_slug} e identifique os indicadores.

Conteúdo (primeiros 4KB):
${text}

Mapeamentos já confirmados antes: ${JSON.stringify(anteriores ?? [])}

Indicadores válidos: ${JSON.stringify(INDICADORES_VALIDOS[secretaria_slug] ?? [])}

Retorne APENAS JSON válido neste formato exato:
{"total_linhas_estimado":number,"periodo_detectado":"string","confianca_analise":"alta|media|baixa","mapeamentos":[{"coluna_origem":"string","indicador_destino":"string","unidade":"string","fator_conversao":number,"exemplo_valor":"string","confianca":"alta|media|baixa","observacao":"string"}],"colunas_nao_identificadas":["string"],"avisos":["string"]}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um especialista em dados do setor público brasileiro. Responda APENAS com JSON válido." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Limite de uso atingido. Tente em alguns minutos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados na IA Gateway." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiRes.ok) throw new Error(`AI gateway: ${aiRes.status}`);

    const json = await aiRes.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("analisar-arquivo error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
