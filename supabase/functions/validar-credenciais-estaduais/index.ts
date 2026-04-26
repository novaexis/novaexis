// @ts-nocheck
/**
 * validar-credenciais-estaduais — Testa as API keys configuradas
 * (PORTAL_TRANSPARENCIA_API_KEY e CNES_API_KEY) fazendo uma chamada
 * mínima a cada API e retornando status detalhado.
 *
 * Não escreve nada no banco — uso seguro para validação manual.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ResultadoCheck = {
  servico: string;
  configurada: boolean;
  ok: boolean;
  http_status?: number;
  mensagem: string;
  amostra?: unknown;
};

async function checarCNES(): Promise<ResultadoCheck> {
  const key = Deno.env.get("CNES_API_KEY");
  const base = "https://apidadosabertos.saude.gov.br/v1/cnes/estabelecimentos";
  const url = new URL(base);
  url.searchParams.set("codigo_uf", "15");
  url.searchParams.set("limit", "1");

  const headers: Record<string, string> = { Accept: "application/json" };
  if (key) headers["Authorization"] = `Bearer ${key}`;

  try {
    const res = await fetch(url.toString(), { headers });
    const text = await res.text();
    let amostra: unknown = text.slice(0, 200);
    try {
      amostra = JSON.parse(text);
    } catch {
      // mantém texto truncado
    }
    return {
      servico: "CNES — Cadastro Nacional de Estabelecimentos de Saúde",
      configurada: !!key,
      ok: res.ok,
      http_status: res.status,
      mensagem: res.ok
        ? "API respondeu com sucesso"
        : `Erro HTTP ${res.status}${key ? "" : " (chave não configurada — algumas rotas exigem auth)"}`,
      amostra,
    };
  } catch (err) {
    return {
      servico: "CNES — Cadastro Nacional de Estabelecimentos de Saúde",
      configurada: !!key,
      ok: false,
      mensagem: `Falha de rede: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function checarPortalTransparencia(): Promise<ResultadoCheck> {
  const key = Deno.env.get("PORTAL_TRANSPARENCIA_API_KEY");
  const url =
    "https://api.portaldatransparencia.gov.br/api-de-dados/bolsa-familia-por-municipio?codigoIbge=1501402&mesAno=202401&pagina=1";

  if (!key) {
    return {
      servico: "Portal da Transparência",
      configurada: false,
      ok: false,
      mensagem: "Chave PORTAL_TRANSPARENCIA_API_KEY não configurada",
    };
  }

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "chave-api-dados": key },
    });
    const text = await res.text();
    let amostra: unknown = text.slice(0, 200);
    try {
      amostra = JSON.parse(text);
    } catch {}
    return {
      servico: "Portal da Transparência",
      configurada: true,
      ok: res.ok,
      http_status: res.status,
      mensagem: res.ok
        ? "Chave válida — API respondeu com sucesso"
        : res.status === 401 || res.status === 403
        ? "Chave rejeitada pela API (401/403). Verifique se foi cadastrada corretamente."
        : `Erro HTTP ${res.status}`,
      amostra,
    };
  } catch (err) {
    return {
      servico: "Portal da Transparência",
      configurada: true,
      ok: false,
      mensagem: `Falha de rede: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const [cnes, portal] = await Promise.all([checarCNES(), checarPortalTransparencia()]);

  return new Response(
    JSON.stringify({
      verificado_em: new Date().toISOString(),
      resultados: [cnes, portal],
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
