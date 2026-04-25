import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { CidadaoBottomNav } from "@/components/cidadao/CidadaoBottomNav";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  Heart,
  GraduationCap,
  Wrench,
  MessageSquare,
  Loader2,
  Megaphone,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/cidadao")({
  head: () => ({
    meta: [
      { title: "Início — App do Cidadão NovaeXis" },
      { name: "description", content: "Serviços públicos do seu município na palma da mão." },
    ],
  }),
  component: CidadaoHomePage,
});

function CidadaoHomePage() {
  return (
    <RoleGuard
      allowed={["cidadao", "superadmin"]}
      title="App do Cidadão"
      subtitle="NovaeXis"
    >
      <CidadaoHome />
      <CidadaoBottomNav />
    </RoleGuard>
  );
}

interface DemandaItem {
  id: string;
  protocolo: string;
  titulo: string;
  status: string;
  created_at: string;
}

interface AvisoItem {
  id: string;
  titulo: string;
  descricao: string | null;
  created_at: string;
}

const ATALHOS = [
  { to: "/cidadao/saude",    label: "Agendar Saúde",  icon: Heart,         color: "text-rose-500" },
  { to: "/cidadao/educacao", label: "Matrícula",      icon: GraduationCap, color: "text-indigo-500" },
  { to: "/cidadao/servicos", label: "Pedir Serviço",  icon: Wrench,        color: "text-amber-500" },
  { to: "/cidadao/servicos", label: "Reclamar",       icon: MessageSquare, color: "text-primary" },
] as const;

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function CidadaoHome() {
  const { profile, user } = useAuth();
  const [tenantNome, setTenantNome] = useState("");
  const [demandas, setDemandas] = useState<DemandaItem[]>([]);
  const [avisos, setAvisos] = useState<AvisoItem[]>([]);
  const [loading, setLoading] = useState(true);

  usePushNotifications(user?.id);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user, profile?.tenant_id]);

  async function load() {
    setLoading(true);
    const tenantP = profile?.tenant_id
      ? supabase.from("tenants").select("nome").eq("id", profile.tenant_id).maybeSingle()
      : Promise.resolve({ data: null });
    const demandasP = supabase
      .from("demandas")
      .select("id, protocolo, titulo, status, created_at")
      .eq("cidadao_id", user!.id)
      .neq("status", "concluida")
      .order("created_at", { ascending: false })
      .limit(3);
    const avisosP = profile?.tenant_id
      ? supabase
          .from("alertas_prazos")
          .select("id, titulo, descricao, created_at")
          .eq("tenant_id", profile.tenant_id)
          .order("created_at", { ascending: false })
          .limit(2)
      : Promise.resolve({ data: [] });

    const [tenantRes, demandasRes, avisosRes] = await Promise.all([tenantP, demandasP, avisosP]);
    setTenantNome((tenantRes.data as { nome?: string } | null)?.nome ?? "");
    setDemandas((demandasRes.data ?? []) as DemandaItem[]);
    setAvisos((avisosRes.data ?? []) as AvisoItem[]);
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-5 sm:px-6">
      {/* Saudação */}
      <header className="mb-5">
        <p className="text-sm text-muted-foreground">
          {saudacao()}, {profile?.nome?.split(" ")[0] ?? "cidadão"} 👋
        </p>
        {tenantNome && (
          <h1 className="mt-0.5 text-xl font-bold tracking-tight">
            {tenantNome} <span className="text-muted-foreground font-normal">— PA</span>
          </h1>
        )}
      </header>

      {/* Atalhos */}
      <section className="mb-6">
        <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Atalhos rápidos
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {ATALHOS.map((a) => {
            const Icon = a.icon;
            return (
              <Link key={a.label} to={a.to}>
                <Card className="flex h-full items-center gap-3 p-4 transition hover:shadow-md hover:-translate-y-0.5 active:translate-y-0">
                  <Icon className={`h-6 w-6 shrink-0 ${a.color}`} />
                  <span className="text-sm font-semibold">{a.label}</span>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Solicitações ativas */}
      <section className="mb-6">
        <div className="mb-2.5 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Minhas solicitações ativas
          </h2>
          <Link
            to="/cidadao/servicos"
            className="text-xs text-primary hover:underline"
          >
            Ver todas →
          </Link>
        </div>

        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : demandas.length === 0 ? (
          <Card className="p-5 text-center text-sm text-muted-foreground">
            Você não tem solicitações abertas.
          </Card>
        ) : (
          <ul className="space-y-2">
            {demandas.map((d) => (
              <li key={d.id}>
                <Link to="/cidadao/demanda/$id" params={{ id: d.id }}>
                  <Card className="flex items-center gap-3 p-3.5 transition hover:shadow-md">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-muted-foreground">
                        #{d.protocolo}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-medium">
                        {d.titulo}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Aberta em {new Date(d.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusBadge status={d.status} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Avisos */}
      {avisos.length > 0 && (
        <section>
          <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Avisos da prefeitura
          </h2>
          <ul className="space-y-2">
            {avisos.map((a) => (
              <li key={a.id}>
                <Card className="flex gap-3 p-3.5">
                  <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{a.titulo}</p>
                    {a.descricao && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {a.descricao}
                      </p>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
