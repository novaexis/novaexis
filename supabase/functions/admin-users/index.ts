// Operações administrativas de usuários: listar, criar/convidar, atribuir role,
// remover role, resetar senha, desativar. Apenas superadmin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type AppRole =
  | "superadmin"
  | "governador"
  | "prefeito"
  | "secretario"
  | "cidadao"
  | "reseller";

interface ListReq {
  action: "list";
  tenant_id?: string | null;
  search?: string | null;
}
interface CreateReq {
  action: "create";
  email: string;
  nome: string;
  password?: string;
  role: AppRole;
  tenant_id?: string | null;
  secretaria_slug?: string | null;
}
interface SetRoleReq {
  action: "set_role";
  user_id: string;
  role: AppRole;
  tenant_id?: string | null;
  secretaria_slug?: string | null;
}
interface RemoveRoleReq {
  action: "remove_role";
  user_id: string;
  role: AppRole;
  tenant_id?: string | null;
}
interface ResetPwReq {
  action: "reset_password";
  user_id: string;
  password: string;
}

type Req =
  | ListReq
  | CreateReq
  | SetRoleReq
  | RemoveRoleReq
  | ResetPwReq;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return jsonResponse({ error: "Missing auth" }, 401);

    // Cliente "como o usuário" para obter identidade
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Confere se é superadmin
    const { data: isSuper, error: roleErr } = await admin.rpc("is_superadmin", {
      _user_id: userData.user.id,
    });
    if (roleErr) return jsonResponse({ error: roleErr.message }, 500);
    if (!isSuper) return jsonResponse({ error: "Forbidden — superadmin only" }, 403);

    const body = (await req.json()) as Req;

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("cf-connecting-ip") ??
      null;
    const ua = req.headers.get("user-agent") ?? null;

    async function audit(
      action: string,
      resource_type: string,
      resource_id: string | null,
      details: Record<string, unknown>,
      tenant_id: string | null = null,
    ) {
      try {
        await admin.from("audit_logs").insert({
          actor_id: userData.user!.id,
          actor_email: userData.user!.email ?? null,
          action,
          resource_type,
          resource_id,
          tenant_id,
          details,
          ip_address: ip,
          user_agent: ua,
        });
      } catch (_) {
        // Audit não deve quebrar a operação
      }
    }

    switch (body.action) {
      case "list": {
        // Lista profiles + roles (filtra por tenant/search se vier)
        let q = admin
          .from("profiles")
          .select("id, nome, email, telefone, tenant_id, created_at")
          .order("created_at", { ascending: false })
          .limit(500);
        if (body.tenant_id) q = q.eq("tenant_id", body.tenant_id);
        if (body.search) {
          const s = body.search.trim();
          q = q.or(`email.ilike.%${s}%,nome.ilike.%${s}%`);
        }
        const { data: profiles, error: pErr } = await q;
        if (pErr) return jsonResponse({ error: pErr.message }, 500);

        const ids = (profiles ?? []).map((p) => p.id);
        const { data: roles, error: rErr } = await admin
          .from("user_roles")
          .select("user_id, role, tenant_id, secretaria_slug")
          .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
        if (rErr) return jsonResponse({ error: rErr.message }, 500);

        return jsonResponse({ profiles: profiles ?? [], roles: roles ?? [] });
      }

      case "create": {
        const { email, nome, password, role, tenant_id, secretaria_slug } = body;
        if (!email || !nome || !role) {
          return jsonResponse({ error: "email, nome e role são obrigatórios" }, 400);
        }
        const pw = password && password.length >= 8 ? password : crypto.randomUUID().slice(0, 12) + "!A";
        const { data: created, error: cErr } = await admin.auth.admin.createUser({
          email,
          password: pw,
          email_confirm: true,
          user_metadata: { nome },
        });
        if (cErr) return jsonResponse({ error: cErr.message }, 400);
        const newId = created.user!.id;

        // Garante profile (handle_new_user já cria, mas força update do tenant)
        await admin
          .from("profiles")
          .upsert({ id: newId, nome, email, tenant_id: tenant_id ?? null }, { onConflict: "id" });

        // Atribui role
        const { error: rrErr } = await admin.from("user_roles").insert({
          user_id: newId,
          role,
          tenant_id: tenant_id ?? null,
          secretaria_slug: secretaria_slug ?? null,
        });
        if (rrErr) return jsonResponse({ error: rrErr.message }, 400);

        await audit("user.create", "user", newId, { email, nome, role, secretaria_slug }, tenant_id ?? null);
        return jsonResponse({ ok: true, user_id: newId, password: pw });
      }

      case "set_role": {
        const { user_id, role, tenant_id, secretaria_slug } = body;
        const { error } = await admin.from("user_roles").upsert(
          {
            user_id,
            role,
            tenant_id: tenant_id ?? null,
            secretaria_slug: secretaria_slug ?? null,
          },
          { onConflict: "user_id,role" },
        );
        if (error) return jsonResponse({ error: error.message }, 400);
        // Se for prefeito/governador/secretario, alinhar tenant do profile
        if (
          tenant_id &&
          (role === "prefeito" || role === "governador" || role === "secretario")
        ) {
          await admin.from("profiles").update({ tenant_id }).eq("id", user_id);
        }
        await audit("user.set_role", "user", user_id, { role, secretaria_slug }, tenant_id ?? null);
        return jsonResponse({ ok: true });
      }

      case "remove_role": {
        const { user_id, role, tenant_id } = body;
        let q = admin.from("user_roles").delete().eq("user_id", user_id).eq("role", role);
        if (tenant_id) q = q.eq("tenant_id", tenant_id);
        const { error } = await q;
        if (error) return jsonResponse({ error: error.message }, 400);
        await audit("user.remove_role", "user", user_id, { role }, tenant_id ?? null);
        return jsonResponse({ ok: true });
      }

      case "reset_password": {
        const { user_id, password } = body;
        if (!password || password.length < 8) {
          return jsonResponse({ error: "Senha mínima 8 caracteres" }, 400);
        }
        const { error } = await admin.auth.admin.updateUserById(user_id, {
          password,
          email_confirm: true,
        });
        if (error) return jsonResponse({ error: error.message }, 400);
        await audit("user.reset_password", "user", user_id, {});
        return jsonResponse({ ok: true });
      }

      default:
        return jsonResponse({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
