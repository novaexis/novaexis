import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper para formatar erros padronizados
const errorResponse = (code: string, message: string, details?: any, status = 400) => {
  return new Response(
    JSON.stringify({
      error: {
        code,
        message,
        details,
      },
    }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Validar Autorização
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return errorResponse("AUTH_HEADER_MISSING", "Cabeçalho de autorização não encontrado.", null, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return errorResponse("INVALID_TOKEN", "Sessão expirada ou token inválido.", authError?.message, 401);
    }

    const { data: isSuperadmin, error: rpcError } = await supabase.rpc("is_superadmin", { 
      _user_id: user.id 
    });

    if (rpcError || !isSuperadmin) {
      return errorResponse("UNAUTHORIZED", "Acesso restrito a Superadmins.", rpcError?.message, 403);
    }

    // 2. Extrair e validar parâmetros
    let params;
    if (req.method === "POST") {
      params = await req.json().catch(() => ({}));
    } else {
      const url = new URL(req.url);
      params = {
        page: parseInt(url.searchParams.get("page") || "1"),
        perPage: parseInt(url.searchParams.get("perPage") || "50"),
        action: url.searchParams.get("action"),
        severity: url.searchParams.get("severity"),
        dateFrom: url.searchParams.get("dateFrom"),
        dateTo: url.searchParams.get("dateTo"),
      };
    }

    const { page = 1, perPage = 50, action, severity, dateFrom, dateTo } = params;

    // Validação de Paginação
    if (page < 1 || perPage < 1 || perPage > 100) {
      return errorResponse("INVALID_PAGINATION", "Parâmetros de paginação inválidos. perPage deve estar entre 1 e 100.");
    }

    // Validação de Datas
    if (dateFrom && isNaN(Date.parse(dateFrom))) {
      return errorResponse("INVALID_DATE_FORMAT", "Formato da data inicial inválido.", { dateFrom });
    }
    if (dateTo && isNaN(Date.parse(dateTo))) {
      return errorResponse("INVALID_DATE_FORMAT", "Formato da data final inválido.", { dateTo });
    }

    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      return errorResponse("INVALID_DATE_RANGE", "A data inicial não pode ser posterior à data final.");
    }

    // 3. Construir query
    let query = supabase
      .from("audit_logs")
      .select("*, profiles:actor_id(email)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (action && action !== "all") query = query.eq("action", action);
    if (severity && severity !== "all") {
      const validSeverities = ["info", "warning", "critical"];
      if (!validSeverities.includes(severity)) {
        return errorResponse("INVALID_SEVERITY", "Nível de severidade não reconhecido.", { severity, validOptions: validSeverities });
      }
      query = query.eq("severity", severity);
    }
    
    // Filtro de datas considerando timezone (ISO 8601)
    // Se o cliente enviar apenas YYYY-MM-DD, tratamos como o início/fim do dia local (UTC-3 presumido ou dinâmico)
    // No entanto, para consistência, o frontend deve enviar ISO strings completas ou usamos timestamps absolutos.
    if (dateFrom) {
      // Garante que é o início do dia no timezone do servidor (UTC) se vier apenas YYYY-MM-DD
      const from = dateFrom.includes("T") ? dateFrom : `${dateFrom}T00:00:00Z`;
      query = query.gte("created_at", from);
    }
    if (dateTo) {
      // Garante que é o fim do dia no timezone do servidor (UTC) se vier apenas YYYY-MM-DD
      const to = dateTo.includes("T") ? dateTo : `${dateTo}T23:59:59.999Z`;
      query = query.lte("created_at", to);
    }

    const fromIdx = (page - 1) * perPage;
    const toIdx = fromIdx + perPage - 1;
    query = query.range(fromIdx, toIdx);

    const { data, count, error } = await query;

    if (error) {
      return errorResponse("DATABASE_ERROR", "Erro ao consultar o histórico de auditoria.", error.message, 500);
    }

    return new Response(
      JSON.stringify({
        logs: data,
        total: count,
        page,
        perPage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Critical Error:", error);
    return errorResponse("INTERNAL_SERVER_ERROR", "Ocorreu um erro inesperado no servidor.", error.message, 500);
  }
});
