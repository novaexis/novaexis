import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Validar Autorização (Superadmin apenas)
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Cabeçalho de autorização ausente" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado ou token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isSuperadmin, error: rpcError } = await supabase.rpc("is_superadmin", { 
      _user_id: user.id 
    });

    if (rpcError || !isSuperadmin) {
      return new Response(JSON.stringify({ error: "Acesso restrito a Superadmins" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Extrair e validar parâmetros da URL (GET) ou Body (POST)
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

    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      return new Response(JSON.stringify({ error: "Intervalo de datas inválido: data inicial maior que a final" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Construir query
    let query = supabase
      .from("audit_logs")
      .select("*, profiles:actor_id(email)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (action && action !== "all") query = query.eq("action", action);
    if (severity && severity !== "all") query = query.eq("severity", severity);
    if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
    if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);

    // Paginação
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) throw error;

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
    console.error("Erro na Edge Function audit-logs:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
