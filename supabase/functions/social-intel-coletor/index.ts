// Coletor de menções sociais — RSS + análise de sentimento via Lovable AI Gateway
// Roda por cron (a cada 6h). Sem JWT (verify_jwt=false).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Fonte {
  id: string;
  tenant_id: string;
  plataforma: string;
  identificador: string;
  ativo: boolean;
}

interface MencaoColetada {
  tenant_id: string;
  plataforma: string;
  conteudo: string;
  autor: string | null;
  url: string | null;
  coletado_at: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const tenantFilter: string | undefined = body.tenant_id;

    let q = admin.from("fontes_monitoramento").select("*").eq("ativo", true);
    if (tenantFilter) q = q.eq("tenant_id", tenantFilter);
    const { data: fontes, error } = await q;
    if (error) throw error;

    const stats = { fontes: fontes?.length ?? 0, coletadas: 0, falhas: 0 };
    const novas: MencaoColetada[] = [];

    for (const f of (fontes ?? []) as Fonte[]) {
      try {
        let items: MencaoColetada[] = [];
        if (f.plataforma === "noticias" && f.identificador.startsWith("http")) {
          items = await coletarRSS(f);
        } else {
          // Plataformas que exigem API key — placeholder, marca último_sync sem coletar
          items = [];
        }
        novas.push(...items);
        await admin
          .from("fontes_monitoramento")
          .update({ ultimo_sync: new Date().toISOString(), ultimo_erro: null })
          .eq("id", f.id);
        stats.coletadas += items.length;
      } catch (e) {
        stats.falhas++;
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Falha em ${f.plataforma}/${f.identificador}:`, msg);
        await admin
          .from("fontes_monitoramento")
          .update({ ultimo_erro: msg.slice(0, 500) })
          .eq("id", f.id);
      }
    }

    // Deduplicação simples por (tenant_id, conteudo)
    const insertedByTenant: Record<string, number> = {};
    for (const m of novas) {
      const { data: exists } = await admin
        .from("mencoes_sociais")
        .select("id")
        .eq("tenant_id", m.tenant_id)
        .eq("conteudo", m.conteudo)
        .limit(1)
        .maybeSingle();
      if (exists) continue;

      const analise = await analisarSentimento(m.conteudo).catch((e) => {
        console.error("IA sentimento falhou:", e);
        return null;
      });

      await admin.from("mencoes_sociais").insert({
        tenant_id: m.tenant_id,
        plataforma: m.plataforma,
        conteudo: m.conteudo,
        conteudo_resumido: analise?.resumo ?? null,
        autor: m.autor,
        url: m.url,
        sentimento: analise?.sentimento ?? "neutro",
        score_sentimento: analise?.score ?? 0,
        temas: analise?.temas ?? [],
        secretarias_impactadas: analise?.secretarias ?? [],
        coletado_at: m.coletado_at,
        processado_at: new Date().toISOString(),
      });
      insertedByTenant[m.tenant_id] = (insertedByTenant[m.tenant_id] ?? 0) + 1;
    }

    // Atualizar score diário e detectar crise
    for (const tenantId of Object.keys(insertedByTenant)) {
      await atualizarScoreDiario(admin, tenantId);
    }

    return json({ ok: true, stats, inseridas: Object.values(insertedByTenant).reduce((a, b) => a + b, 0) });
  } catch (err) {
    console.error("social-intel-coletor error:", err);
    return json({ error: err instanceof Error ? err.message : "erro" }, 500);
  }
});

async function coletarRSS(f: Fonte): Promise<MencaoColetada[]> {
  const res = await fetch(f.identificador, {
    headers: { "User-Agent": "NovaeXis-SocialIntelBot/1.0 (+novaexis.lovable.app)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  const items: MencaoColetada[] = [];
  const itemRegex = /<item[\s\S]*?<\/item>/g;
  const matches = xml.match(itemRegex) ?? [];
  for (const item of matches.slice(0, 20)) {
    const title = extractTag(item, "title");
    const desc = extractTag(item, "description");
    const link = extractTag(item, "link");
    const pubDate = extractTag(item, "pubDate");
    const conteudo = stripHtml([title, desc].filter(Boolean).join(" — ")).slice(0, 1000);
    if (!conteudo) continue;
    items.push({
      tenant_id: f.tenant_id,
      plataforma: "noticias",
      conteudo,
      autor: null,
      url: link || null,
      coletado_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
    });
  }
  return items;
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  if (!m) return "";
  return m[1]
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .trim();
}
function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

interface Analise {
  sentimento: "positivo" | "negativo" | "neutro";
  score: number;
  temas: string[];
  secretarias: string[];
  resumo: string;
}

async function analisarSentimento(texto: string): Promise<Analise> {
  const prompt = `Analise a menção a uma prefeitura municipal e retorne JSON estrito:
{
 "sentimento": "positivo"|"negativo"|"neutro",
 "score": -1.0..1.0,
 "temas": ["string", ...],   // até 5 palavras-chave curtas em pt-BR
 "secretarias": ["saude"|"educacao"|"infraestrutura"|"assistencia"|"seguranca"|"financas"|"meio_ambiente"|"cultura"|"esporte"|"administracao"], // afetadas
 "resumo": "1 frase em português"
}
Texto: """${texto.slice(0, 1500)}"""`;

  const r = await callAIWithRetry([
    { role: "system", content: "Você é um analisador de sentimento e tópicos. Responda SOMENTE JSON válido." },
    { role: "user", content: prompt },
  ]);
  if (!r.ok) throw new Error(`AI ${r.status}`);
  const data = await r.json();
  const txt = data?.choices?.[0]?.message?.content ?? "{}";
  const jsonStr = txt.replace(/^```json\s*/i, "").replace(/```$/g, "").trim();
  let parsed: Analise;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    parsed = { sentimento: "neutro", score: 0, temas: [], secretarias: [], resumo: "" };
  }
  return parsed;
}

async function callAIWithRetry(messages: unknown[], maxRetry = 2): Promise<Response> {
  let attempt = 0;
  while (true) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages }),
    });
    if (res.status !== 429 || attempt >= maxRetry) return res;
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    attempt++;
  }
}

async function atualizarScoreDiario(admin: ReturnType<typeof createClient>, tenantId: string) {
  const hoje = new Date().toISOString().split("T")[0];
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: mencoes } = await admin
    .from("mencoes_sociais")
    .select("sentimento, score_sentimento, temas")
    .eq("tenant_id", tenantId)
    .gte("coletado_at", desde);

  const list = mencoes ?? [];
  const pos = list.filter((m: any) => m.sentimento === "positivo").length;
  const neg = list.filter((m: any) => m.sentimento === "negativo").length;
  const neu = list.filter((m: any) => m.sentimento === "neutro").length;
  const total = list.length;
  const score = total > 0 ? Math.max(0, Math.min(100, ((pos - neg) / total) * 50 + 50)) : 50;

  // Temas trending
  const temaCount: Record<string, { mencoes: number; soma: number }> = {};
  for (const m of list as any[]) {
    for (const t of m.temas ?? []) {
      const key = String(t).toLowerCase();
      temaCount[key] ??= { mencoes: 0, soma: 0 };
      temaCount[key].mencoes++;
      temaCount[key].soma += Number(m.score_sentimento ?? 0);
    }
  }
  const temas_trending = Object.entries(temaCount)
    .map(([tema, v]) => ({ tema, mencoes: v.mencoes, sentimento: v.mencoes > 0 ? v.soma / v.mencoes : 0 }))
    .sort((a, b) => b.mencoes - a.mencoes)
    .slice(0, 10);

  // Detecção de crise: queda >15pts em 24h OU >40% negativas
  const ontem = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().split("T")[0];
  const { data: scoreOntem } = await admin
    .from("scores_aprovacao")
    .select("score")
    .eq("tenant_id", tenantId)
    .lte("data", ontem)
    .order("data", { ascending: false })
    .limit(1)
    .maybeSingle();
  const queda = scoreOntem ? Number(scoreOntem.score) - score : 0;
  const pctNeg = total > 0 ? (neg / total) * 100 : 0;
  const alerta_crise = queda > 15 || pctNeg > 40;

  await admin.from("scores_aprovacao").upsert(
    {
      tenant_id: tenantId,
      data: hoje,
      score,
      total_mencoes: total,
      positivas: pos,
      negativas: neg,
      neutras: neu,
      temas_trending,
      alerta_crise,
    },
    { onConflict: "tenant_id,data" },
  );
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
