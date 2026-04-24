// Reseta a senha de todos os usuários demo (exceto o owner) para uma senha fixa
// usada pelos botões de "Login rápido" na tela de login.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const OWNER_EMAIL = "edsonsguedes@gmail.com";
const DEMO_PASSWORD = "Demo@2026";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let page = 1;
    const perPage = 200;
    const updated: string[] = [];
    const failed: { email: string; error: string }[] = [];

    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      if (!data.users.length) break;

      for (const u of data.users) {
        if (!u.email || u.email.toLowerCase() === OWNER_EMAIL.toLowerCase()) continue;
        const { error: upErr } = await admin.auth.admin.updateUserById(u.id, {
          password: DEMO_PASSWORD,
          email_confirm: true,
        });
        if (upErr) failed.push({ email: u.email, error: upErr.message });
        else updated.push(u.email);
      }

      if (data.users.length < perPage) break;
      page++;
    }

    return new Response(
      JSON.stringify({ ok: true, password: DEMO_PASSWORD, updated, failed }),
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
