// Edge function: cria tenant + secretarias + checklist a partir do wizard de onboarding.
// Requer auth: usuário logado vira o "prefeito" do novo tenant (role atribuída).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface OnboardingPayload {
  municipio: {
    nome: string;
    uf: string;
    ibge_code?: string | null;
    populacao?: number | null;
  };
  prefeito: {
    nome: string;
    telefone?: string | null;
  };
  secretarias: string[]; // slugs
  plano: "basico" | "completo" | "estado";
  trial_dias?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "missing auth" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Cliente para verificar usuário
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: "unauthorized" }, 401);
    }
    const user = userData.user;

    const payload: OnboardingPayload = await req.json();
    if (!payload.municipio?.nome || !payload.municipio?.uf) {
      return json({ error: "municipio.nome e municipio.uf são obrigatórios" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // 1) cria tenant
    const trialDias = payload.trial_dias ?? 14;
    const trialEnd = new Date(Date.now() + trialDias * 24 * 60 * 60 * 1000).toISOString();

    const { data: tenant, error: tErr } = await admin
      .from("tenants")
      .insert({
        nome: payload.municipio.nome,
        uf: payload.municipio.uf,
        ibge_code: payload.municipio.ibge_code ?? null,
        populacao: payload.municipio.populacao ?? null,
        plano: payload.plano,
        ativo: true,
        trial_ends_at: trialEnd,
        stripe_subscription_status: "trialing",
      })
      .select("id, nome")
      .single();
    if (tErr) throw tErr;

    // 2) atualiza profile do usuário
    await admin
      .from("profiles")
      .update({
        tenant_id: tenant.id,
        nome: payload.prefeito.nome,
        telefone: payload.prefeito.telefone ?? null,
      })
      .eq("id", user.id);

    // 3) atribui role prefeito ao usuário
    await admin
      .from("user_roles")
      .upsert(
        { user_id: user.id, role: "prefeito", tenant_id: tenant.id },
        { onConflict: "user_id,role,tenant_id" },
      );

    // 4) cria secretarias selecionadas
    if (payload.secretarias.length > 0) {
      const rows = payload.secretarias.map((slug) => ({
        tenant_id: tenant.id,
        slug,
        nome: slug.charAt(0).toUpperCase() + slug.slice(1),
        ativo: true,
      }));
      await admin.from("secretarias").insert(rows);
    }

    // 5) cria checklist de onboarding
    await admin.from("onboarding_checklist").insert({
      tenant_id: tenant.id,
      primeiro_login: true,
      secretarios_convidados: 0,
      dados_importados: false,
      app_configurado: false,
      social_configurado: false,
    });

    // 6) audit log
    await admin.from("audit_logs").insert({
      action: "tenant.created.onboarding",
      actor_id: user.id,
      actor_email: user.email,
      resource_type: "tenant",
      resource_id: tenant.id,
      tenant_id: tenant.id,
      details: { plano: payload.plano, trial_dias: trialDias },
    });

    return json({ ok: true, tenant_id: tenant.id, trial_ends_at: trialEnd });
  } catch (e) {
    console.error("onboarding-tenant error", e);
    return json({ error: e instanceof Error ? e.message : "erro desconhecido" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
