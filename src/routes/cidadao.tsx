import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Heart,
  GraduationCap,
  MessageSquare,
  ShieldAlert,
  HandHeart,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/cidadao")({
  head: () => ({ meta: [{ title: "App do Cidadão — NovaeXis" }] }),
  component: () => (
    <RoleGuard
      allowed={["cidadao", "superadmin"]}
      title="App do Cidadão"
      subtitle="Serviços públicos no seu bolso"
    >
      <CidadaoHome />
    </RoleGuard>
  ),
});

interface DemandaItem {
  id: string;
  protocolo: string;
  titulo: string;
  status: string;
  created_at: string;
}

const SERVICOS = [
  { icon: Heart, label: "Saúde", desc: "Agendar consulta" },
  { icon: GraduationCap, label: "Educação", desc: "Matrícula escolar" },
  { icon: MessageSquare, label: "Ouvidoria", desc: "Reclamar / sugerir" },
  { icon: ShieldAlert, label: "Segurança", desc: "Reportar ocorrência" },
  { icon: HandHeart, label: "Benefícios", desc: "Consultar direitos" },
];

function CidadaoHome() {
  const { profile, user } = useAuth();
  const [tenantNome, setTenantNome] = useState("");
  const [demandas, setDemandas] = useState<DemandaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user, profile?.tenant_id]);

  async function load() {
    setLoading(true);
    const tenantPromise = profile?.tenant_id
      ? supabase
          .from("tenants")
          .select("nome")
          .eq("id", profile.tenant_id)
          .maybeSingle()
      : Promise.resolve({ data: null });
    const demandasPromise = supabase
      .from("demandas")
      .select("id, protocolo, titulo, status, created_at")
      .eq("cidadao_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(10);
    const [tenantRes, demandasRes] = await Promise.all([tenantPromise, demandasPromise]);
    setTenantNome(tenantRes.data?.nome ?? "");
    setDemandas((demandasRes.data ?? []) as DemandaItem[]);
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">Olá,</p>
        <h1 className="text-2xl font-bold tracking-tight">
          {profile?.nome ?? "Cidadão"}
        </h1>
        {tenantNome && (
          <p className="mt-1 text-sm text-muted-foreground">
            Município de <span className="font-medium text-foreground">{tenantNome}</span>
          </p>
        )}
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Serviços
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SERVICOS.map((s) => {
            const Icon = s.icon;
            return (
              <Card
                key={s.label}
                className="cursor-pointer p-4 text-center transition hover:shadow-md hover:-translate-y-0.5"
              >
                <Icon className="mx-auto h-7 w-7 text-primary" />
                <p className="mt-2.5 text-sm font-semibold">{s.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.desc}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Minhas solicitações
        </h2>
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : demandas.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Você ainda não tem solicitações abertas.
          </Card>
        ) : (
          <ul className="space-y-2">
            {demandas.map((d) => (
              <li key={d.id}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-muted-foreground">
                        #{d.protocolo}
                      </p>
                      <p className="mt-0.5 truncate font-medium">{d.titulo}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(d.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8 rounded-lg border bg-card p-4 text-xs text-muted-foreground">
        Próximos blocos liberarão agendamento de saúde, matrícula escolar,
        ouvidoria com mídia e modo offline (PWA).
        <Link to="/" className="ml-1 underline hover:text-foreground">
          Voltar à home
        </Link>
      </div>
    </div>
  );
}
