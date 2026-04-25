// Reseta a senha de todos os usuários demo (exceto o owner) para uma senha
// gerada aleatoriamente a cada execução. A senha é retornada apenas para o
// superadmin que dispara a operação e nunca é registrada no código fonte.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

  try {
    const ownerEmail = (Deno.env.get("DEMO_OWNER_EMAIL") ?? "").toLowerCase();
    if (!ownerEmail) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "DEMO_OWNER_EMAIL não configurado nos secrets.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verifica que quem chama é superadmin
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(
        JSON.stringify({ ok: false, error: "Não autenticado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Sessão inválida." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isSuper, error: roleErr } = await admin.rpc("is_superadmin", {
      _user_id: userData.user.id,
    });
    if (roleErr || !isSuper) {
      return new Response(
        JSON.stringify({ ok: false, error: "Acesso restrito a superadmin." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const newPassword = generatePassword();

    let page = 1;
    const perPage = 200;
    const updated: string[] = [];
    const failed: { email: string; error: string }[] = [];

    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      if (!data.users.length) break;

      for (const u of data.users) {
        if (!u.email || u.email.toLowerCase() === ownerEmail) continue;
        const { error: upErr } = await admin.auth.admin.updateUserById(u.id, {
          password: newPassword,
          email_confirm: true,
        });
        if (upErr) failed.push({ email: u.email, error: upErr.message });
        else updated.push(u.email);
      }

      if (data.users.length < perPage) break;
      page++;
    }

    // Senha retornada apenas para o superadmin autenticado que disparou a ação.
    return new Response(
      JSON.stringify({
        ok: true,
        password: newPassword,
        updated_count: updated.length,
        failed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
