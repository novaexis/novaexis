// Monitor diário de oportunidades de captação (Transferegov + IA)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Aceita opcionalmente um tenant_id para teste manual de um único município
    const body = await req.json().catch(() => ({}));
    const tenantIdFiltro: string | undefined = body.tenant_id;

    let tenantsQuery = supabase
      .from("tenants")
      .select("id, nome, populacao, idhm, bioma, ibge_codigo")
      .eq("ativo", true);

    if (tenantIdFiltro) tenantsQuery = tenantsQuery.eq("id", tenantIdFiltro);

    const { data: tenants } = await tenantsQuery;

    const publicacoes = await buscarTransferegov();

    if (!publicacoes.length) {
      return json({
        ok: true,
        mensagem: "Nenhuma publicação nova encontrada",
        tenants: tenants?.length || 0,
      });
    }

    let totalAlertas = 0;
    for (const tenant of tenants || []) {
      const adicionados = await analisarOportunidades(
        supabase,
        tenant,
        publicacoes,
      );
      totalAlertas += adicionados;
      await new Promise((r) => setTimeout(r, 600));
    }

    return json({
      ok: true,
      tenants_processados: tenants?.length || 0,
      alertas_criados: totalAlertas,
    });
  } catch (err) {
    console.error("monitor-captacao error:", err);
    return json({ error: err instanceof Error ? err.message : "Erro" }, 500);
  }
});

async function buscarTransferegov() {
  try {
    const res = await fetch(
      "https://api.transfere.gov.br/api/v1/chamamentos-publicos?situacao=ABERTO&uf=PA",
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) {
      console.warn("Transferegov status", res.status);
      return [];
    }
    const data = await res.json();
    return (data.content || data || []).map((item: any) => ({
      titulo: item.titulo || item.objeto?.substring(0, 100) || "Chamamento",
      descricao: item.objeto || "",
      fonte: "Transferegov",
      prazo: item.dataFimVigencia || item.data_fim_vigencia,
      valor: item.valorGlobalConvenio || item.valor_global_convenio || 0,
      url: `https://www.gov.br/transferegov/pt-br`,
      tipo: "recurso_federal",
    }));
  } catch (err) {
    console.error("Erro Transferegov:", err);
    return [];
  }
}

async function analisarOportunidades(
  supabase: any,
  tenant: any,
  publicacoes: any[],
): Promise<number> {
  if (!publicacoes.length) return 0;

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
        messages: [
          {
            role: "system",
            content: `Você é especialista em captação de recursos para municípios brasileiros.
Município: ${tenant.nome} — Pará | População: ${tenant.populacao?.toLocaleString("pt-BR") ?? "—"} | IDHM: ${tenant.idhm ?? "—"}

Filtre as publicações abaixo e retorne APENAS as oportunidades RELEVANTES para este município.
Critérios:
- Atende municípios deste porte
- Prazo de inscrição não vencido (vence em mais de 5 dias)
- Programas que exigem porte > 100k habitantes para municípios menores: EXCLUIR

Retorne APENAS JSON válido (sem markdown, sem texto extra) no formato exato:
{"oportunidades":[{"titulo":"string","descricao":"string","tipo":"recurso_federal","fonte":"string","valor_estimado":0,"prazo":"YYYY-MM-DD","url_edital":"string","requisitos":[{"item":"string","concluido":false}],"relevancia_explicada":"string"}]}`,
          },
          {
            role: "user",
            content: `Publicações:\n${JSON.stringify(publicacoes.slice(0, 15), null, 2)}`,
          },
        ],
      }),
    },
  );

  if (!aiRes.ok) {
    console.error("AI falhou para tenant", tenant.id, aiRes.status);
    return 0;
  }

  const aiData = await aiRes.json();
  const conteudo = aiData?.choices?.[0]?.message?.content || "";

  let resultado: any;
  try {
    // remover possíveis cercas de markdown
    const limpo = conteudo
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    resultado = JSON.parse(limpo);
  } catch {
    console.error("JSON inválido de IA para tenant", tenant.id);
    return 0;
  }

  let inseridos = 0;
  for (const op of resultado.oportunidades || []) {
    const tituloPrefix = (op.titulo || "").substring(0, 50);
    if (!tituloPrefix) continue;

    const trintaDiasAtras = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: existente } = await supabase
      .from("alertas_prazos")
      .select("id")
      .eq("tenant_id", tenant.id)
      .ilike("titulo", `%${tituloPrefix}%`)
      .gte("created_at", trintaDiasAtras)
      .maybeSingle();

    if (existente) continue;

    await supabase.from("alertas_prazos").insert({
      tenant_id: tenant.id,
      titulo: op.titulo?.substring(0, 200),
      descricao: op.descricao,
      tipo: op.tipo || "recurso_federal",
      fonte: op.fonte || "Transferegov",
      valor_estimado: op.valor_estimado || null,
      prazo: op.prazo || null,
      status: "disponivel",
      requisitos: op.requisitos || [],
      url_edital: op.url_edital || null,
      criado_automaticamente: true,
    });
    inseridos++;
  }

  return inseridos;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
