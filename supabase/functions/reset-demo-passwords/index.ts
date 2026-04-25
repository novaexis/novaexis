// Edge Function para reset de senhas com verificação forte, rate limit e auditoria.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Rate limit simples em memória (limpa ao reiniciar a function)
// Para produção escala real, usar Redis ou tabela no banco.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const MAX_ATTEMPTS = 3;
const attempts = new Map<string, { count: number; lastAttempt: number }>();

function generatePassword(length = 20): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    
    if (!token) {
      return new Response(
        JSON.stringify({ ok: false, error: "Não autenticado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Validar Usuário
    const { data: { user }, error: userErr } = await adminClient.auth.getUser(token);
    if (userErr || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Sessão inválida." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Rate Limit por Superadmin
    const now = Date.now();
    const userAttempts = attempts.get(user.id) || { count: 0, lastAttempt: 0 };
    
    if (now - userAttempts.lastAttempt < RATE_LIMIT_WINDOW_MS) {
      if (userAttempts.count >= MAX_ATTEMPTS) {
        // Registrar tentativa bloqueada no log de auditoria
        await adminClient.rpc("log_action", {
          p_action: "PASSWORD_RESET_REJECTED_RATELIMIT",
          p_payload: { user_id: user.id, count: userAttempts.count },
          p_severity: "warning"
        });

        return new Response(
          JSON.stringify({ ok: false, error: "Limite de tentativas excedido. Tente novamente em 15 minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userAttempts.count++;
    } else {
      userAttempts.count = 1;
    }
    userAttempts.lastAttempt = now;
    attempts.set(user.id, userAttempts);

    // 3. Verificação de Superadmin (Verificação Forte)
    const { data: isSuper, error: roleErr } = await adminClient.rpc("is_superadmin", {
      _user_id: user.id,
    });

    if (roleErr || !isSuper) {
      await adminClient.rpc("log_action", {
        p_action: "PASSWORD_RESET_UNAUTHORIZED_ATTEMPT",
        p_payload: { user_id: user.id, email: user.email },
        p_severity: "critical"
      });

      return new Response(
        JSON.stringify({ ok: false, error: "Acesso restrito a superadmin." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Executar Reset
    const ownerEmail = (Deno.env.get("DEMO_OWNER_EMAIL") ?? "").toLowerCase();
    const newPassword = generatePassword();
    const updated: string[] = [];
    const failed: { email: string; error: string }[] = [];

    let page = 1;
    const perPage = 200;

    while (true) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      if (!data.users.length) break;

      for (const u of data.users) {
        if (!u.email || u.email.toLowerCase() === ownerEmail) continue;
        const { error: upErr } = await adminClient.auth.admin.updateUserById(u.id, {
          password: newPassword,
          email_confirm: true,
        });
        if (upErr) failed.push({ email: u.email, error: upErr.message });
        else updated.push(u.email);
      }

      if (data.users.length < perPage) break;
      page++;
    }

    // 5. Registrar Sucesso na Auditoria
    await adminClient.rpc("log_action", {
      p_action: "PASSWORD_RESET_BULK_SUCCESS",
      p_payload: { 
        actor_id: user.id, 
        updated_count: updated.length, 
        failed_count: failed.length,
        failed_details: failed 
      },
      p_severity: "info"
    });

    return new Response(
      JSON.stringify({
        ok: true,
        password: newPassword,
        updated_count: updated.length,
        failed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("Erro no reset de senhas:", e);
    return new Response(
      JSON.stringify({ ok: false, error: "Erro interno ao processar a solicitação." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
