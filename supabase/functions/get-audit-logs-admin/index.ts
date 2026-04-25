import { createClient } from "https://esm.sh/@supabase/supabase-js@2.40.1";

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
    const token = authHeader.replace("Bearer ", "");
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isSuperadmin } = await supabase.rpc("is_superadmin", { _user_id: user.id });
    if (!isSuperadmin) {
      return new Response(JSON.stringify({ error: "Acesso restrito a Superadmins" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Extrair e validar parâmetros
    const { 
      page = 1, 
      perPage = 50, 
      action, 
      severity, 
      dateFrom, 
      dateTo 
    } = await req.json().catch(() => ({}));

    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      return new Response(JSON.stringify({ error: "Intervalo de datas inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Construir query
    let query = supabase
      .from("audit_logs")
      .select("*, profiles:actor_id(email)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (action) query = query.eq("action", action);
    if (severity) query = query.eq("severity", severity);
    if (dateFrom) query = query.gte("created_at", dateFrom);
    if (dateTo) query = query.lte("created_at", dateTo);

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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
