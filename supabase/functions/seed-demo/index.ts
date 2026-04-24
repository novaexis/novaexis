// Seed de demonstração — cria 3 municípios fictícios do Pará com dados completos
// Idempotente: pode ser executado várias vezes sem duplicar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SECRETARIAS = [
  { slug: "saude", nome: "Secretaria de Saúde" },
  { slug: "educacao", nome: "Secretaria de Educação" },
  { slug: "financas", nome: "Secretaria de Finanças" },
  { slug: "infraestrutura", nome: "Secretaria de Infraestrutura" },
  { slug: "seguranca", nome: "Secretaria de Segurança" },
  { slug: "assistencia_social", nome: "Secretaria de Assistência Social" },
];

const MUNICIPIOS = [
  { slug: "santarinho-do-norte", nome: "Santarinho do Norte", populacao: 8200, idhm: 0.521, bioma: "amazonia", ibge_codigo: "1500001" },
  { slug: "marajoense", nome: "Marajoense", populacao: 42000, idhm: 0.634, bioma: "amazonia", ibge_codigo: "1500002" },
  { slug: "nova-belem-do-tapajos", nome: "Nova Belém do Tapajós", populacao: 185000, idhm: 0.712, bioma: "amazonia", ibge_codigo: "1500003" },
];

const TITULOS_DEMANDAS = [
  "Buraco grande na rua principal",
  "Iluminação pública queimada",
  "Coleta de lixo atrasada",
  "Posto de saúde sem médico",
  "Escola precisando de reforma",
  "Falta de água há 3 dias",
  "Esgoto vazando na esquina",
  "Pedido de poda de árvore",
  "Calçada quebrada",
  "Solicitação de matrícula urgente",
];

const KPIS_TEMPLATE = [
  { sec: "saude", ind: "Cobertura atenção básica", uni: "%", base: 75 },
  { sec: "educacao", ind: "Taxa de matrícula", uni: "%", base: 88 },
  { sec: "financas", ind: "Execução orçamentária", uni: "%", base: 62 },
  { sec: "infraestrutura", ind: "Ordens concluídas", uni: "/mês", base: 145 },
  { sec: "seguranca", ind: "Ocorrências registradas", uni: "/mês", base: 89 },
  { sec: "assistencia_social", ind: "Famílias CadÚnico", uni: "", base: 1240 },
];

const ALERTAS_TEMPLATE = [
  { titulo: "Edital FNDE — Reforma de escolas rurais", tipo: "recurso_federal", valor: 850000, dias: 12 },
  { titulo: "Convênio MS — Atenção básica ampliada", tipo: "recurso_federal", valor: 1200000, dias: 28 },
  { titulo: "Emenda parlamentar — Pavimentação", tipo: "recurso_federal", valor: 500000, dias: 45 },
  { titulo: "Programa Caminho da Escola", tipo: "recurso_estadual", valor: 320000, dias: 7 },
  { titulo: "Prestação de contas LRF Q1", tipo: "obrigacao_legal", valor: null, dias: 22 },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generatePassword(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "A")
    .replace(/\//g, "B")
    .replace(/=/g, "");
  return `Demo!${b64}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1) Verificar JWT do chamador
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 2) Confirmar role superadmin server-side
    const { data: roleRow, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "superadmin")
      .maybeSingle();
    if (roleErr || !roleRow) {
      return jsonResponse({ error: "Forbidden: superadmin role required" }, 403);
    }

    // 3) Senha de demo aleatória por execução
    const demoPassword = generatePassword();

    const result = {
      tenants: 0,
      users: 0,
      demandas: 0,
      kpis: 0,
      alertas: 0,
      demoPassword,
    };

    // 1) Estado tenant
    let { data: estado } = await admin
      .from("tenants")
      .select("id")
      .eq("slug", "estado-para")
      .maybeSingle();
    if (!estado) {
      const { data } = await admin
        .from("tenants")
        .insert({
          slug: "estado-para",
          nome: "Estado do Pará",
          tipo: "estado",
          estado: "PA",
          plano: "estado",
          populacao: 8700000,
        })
        .select("id")
        .single();
      estado = data;
    }

    // 2) Para cada município
    for (const mun of MUNICIPIOS) {
      let { data: tenant } = await admin
        .from("tenants")
        .select("id")
        .eq("slug", mun.slug)
        .maybeSingle();

      if (!tenant) {
        const { data } = await admin
          .from("tenants")
          .insert({
            slug: mun.slug,
            nome: mun.nome,
            tipo: "municipio",
            estado: "PA",
            ibge_codigo: mun.ibge_codigo,
            populacao: mun.populacao,
            idhm: mun.idhm,
            bioma: mun.bioma,
            plano: mun.populacao > 100000 ? "completo" : "basico",
          })
          .select("id")
          .single();
        tenant = data;
        result.tenants++;
      }
      const tenantId = tenant!.id;

      // Secretarias
      for (const s of SECRETARIAS) {
        await admin
          .from("secretarias")
          .upsert({ tenant_id: tenantId, slug: s.slug, nome: s.nome }, { onConflict: "tenant_id,slug" });
      }

      // Usuários demo
      const usersToCreate = [
        { email: `prefeito@${mun.slug}.pa.gov.br`, nome: `Prefeito de ${mun.nome}`, role: "prefeito", sec: null },
        { email: `cidadao@${mun.slug}.pa.gov.br`, nome: `Cidadão Demo ${mun.nome}`, role: "cidadao", sec: null },
        ...SECRETARIAS.map((s) => ({
          email: `secretario.${s.slug}@${mun.slug}.pa.gov.br`,
          nome: `Secretário(a) de ${s.nome.replace("Secretaria de ", "")}`,
          role: "secretario",
          sec: s.slug,
        })),
      ];

      let prefeitoUserId: string | null = null;
      let cidadaoUserId: string | null = null;

      for (const u of usersToCreate) {
        // Tenta criar; se já existe, busca
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: u.email,
          password: demoPassword,
          email_confirm: true,
          user_metadata: { nome: u.nome },
        });

        let userId: string | undefined = created?.user?.id;
        if (createErr || !userId) {
          const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
          userId = list.users.find((x) => x.email === u.email)?.id;
          if (userId) {
            await admin.auth.admin.updateUserById(userId, { password: demoPassword });
          }
        }
        if (!userId) continue;

        // Garante profile (handle_new_user pode já ter criado)
        await admin
          .from("profiles")
          .upsert(
            { id: userId, tenant_id: tenantId, nome: u.nome, email: u.email },
            { onConflict: "id" },
          );

        // Garante role
        await admin
          .from("user_roles")
          .upsert(
            {
              user_id: userId,
              tenant_id: tenantId,
              role: u.role,
              secretaria_slug: u.sec,
            },
            { onConflict: "user_id,tenant_id,role,secretaria_slug" },
          );

        if (u.role === "prefeito") prefeitoUserId = userId;
        if (u.role === "cidadao") cidadaoUserId = userId;
        result.users++;
      }

      // Governador (uma única vez, vinculado ao estado)
      const { data: govList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      let governadorId = govList.users.find((x) => x.email === "governador@pa.gov.br")?.id;
      if (!governadorId) {
        const { data: gc } = await admin.auth.admin.createUser({
          email: "governador@pa.gov.br",
          password: demoPassword,
          email_confirm: true,
          user_metadata: { nome: "Governador do Pará" },
        });
        governadorId = gc?.user?.id;
      } else {
        await admin.auth.admin.updateUserById(governadorId, { password: demoPassword });
      }
      if (governadorId && estado) {
        await admin.from("profiles").upsert(
          { id: governadorId, tenant_id: estado.id, nome: "Governador do Pará", email: "governador@pa.gov.br" },
          { onConflict: "id" },
        );
        await admin.from("user_roles").upsert(
          { user_id: governadorId, tenant_id: estado.id, role: "governador", secretaria_slug: null },
          { onConflict: "user_id,tenant_id,role,secretaria_slug" },
        );
      }

      // Demandas (apenas se ainda não houver para este tenant)
      const { count: demCount } = await admin
        .from("demandas")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);

      if ((demCount ?? 0) === 0 && cidadaoUserId) {
        const demandas = [];
        const totalDemandas = Math.min(40, Math.floor(mun.populacao / 1000));
        const statuses = ["aberta", "em_analise", "em_andamento", "concluida"];
        const prioridades = ["baixa", "media", "alta", "urgente"];
        for (let i = 0; i < totalDemandas; i++) {
          const sec = SECRETARIAS[i % SECRETARIAS.length].slug;
          const titulo = TITULOS_DEMANDAS[i % TITULOS_DEMANDAS.length];
          const status = statuses[Math.floor(Math.random() * statuses.length)];
          const ano = new Date().getFullYear();
          const prot = `${ano}-${mun.ibge_codigo}-${String(i + 1).padStart(5, "0")}`;
          demandas.push({
            tenant_id: tenantId,
            cidadao_id: cidadaoUserId,
            secretaria_slug: sec,
            protocolo: prot,
            tipo: "servico",
            titulo,
            descricao: `${titulo}. Solicitação registrada via app NovaeXis.`,
            status,
            prioridade: prioridades[Math.floor(Math.random() * prioridades.length)],
            created_at: new Date(Date.now() - i * 86400000 * 2).toISOString(),
          });
        }
        if (demandas.length) {
          await admin.from("demandas").insert(demandas);
          result.demandas += demandas.length;
        }
      }

      // KPIs (90 dias) — só se vazio
      const { count: kpiCount } = await admin
        .from("kpis")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);

      if ((kpiCount ?? 0) === 0) {
        const kpis = [];
        for (let d = 0; d < 90; d++) {
          const data = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
          for (const t of KPIS_TEMPLATE) {
            const variacao = (Math.random() - 0.5) * 8;
            const valor = Math.max(0, t.base + variacao - d * 0.05);
            const status = valor < t.base * 0.7 ? "critico" : valor < t.base * 0.9 ? "atencao" : "ok";
            kpis.push({
              tenant_id: tenantId,
              secretaria_slug: t.sec,
              indicador: t.ind,
              valor: Number(valor.toFixed(2)),
              unidade: t.uni || null,
              variacao_pct: Number(variacao.toFixed(2)),
              status,
              referencia_data: data,
              fonte: "Seed demo",
            });
          }
        }
        // chunked insert
        for (let i = 0; i < kpis.length; i += 200) {
          await admin.from("kpis").insert(kpis.slice(i, i + 200));
        }
        result.kpis += kpis.length;
      }

      // Alertas de prazos
      const { count: alCount } = await admin
        .from("alertas_prazos")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);

      if ((alCount ?? 0) === 0) {
        const alertas = ALERTAS_TEMPLATE.map((a) => ({
          tenant_id: tenantId,
          titulo: a.titulo,
          descricao: `Oportunidade detectada para ${mun.nome}`,
          tipo: a.tipo,
          fonte: "DOU/Diário Oficial PA",
          valor_estimado: a.valor,
          prazo: new Date(Date.now() + a.dias * 86400000).toISOString().slice(0, 10),
          status: "disponivel",
          requisitos: ["Plano municipal aprovado", "Contrapartida 5%", "CNPJ regular"],
          criado_automaticamente: true,
        }));
        await admin.from("alertas_prazos").insert(alertas);
        result.alertas += alertas.length;
      }
    }

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seed-demo error", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
