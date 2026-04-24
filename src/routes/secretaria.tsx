import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/secretaria")({
  head: () => ({ meta: [{ title: "Painel da Secretaria — NovaeXis" }] }),
  component: () => (
    <RoleGuard
      allowed={["secretario", "superadmin"]}
      title="Painel da Secretaria"
      subtitle="Demandas e indicadores setoriais"
    >
      <SecretariaDashboard />
    </RoleGuard>
  ),
});

interface DemandaItem {
  id: string;
  protocolo: string;
  titulo: string;
  status: string;
  prioridade: string;
  created_at: string;
}

function SecretariaDashboard() {
  const { roles, profile } = useAuth();
  const secRole = roles.find((r) => r.role === "secretario");
  const slug = secRole?.secretaria_slug ?? null;
  const [tenantNome, setTenantNome] = useState("");
  const [demandas, setDemandas] = useState<DemandaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.tenant_id) return;
    void load(profile.tenant_id);
  }, [profile?.tenant_id]);

  async function load(tenantId: string) {
    setLoading(true);
    const [tenantRes, demandasRes] = await Promise.all([
      supabase.from("tenants").select("nome").eq("id", tenantId).maybeSingle(),
      supabase
        .from("demandas")
        .select("id, protocolo, titulo, status, prioridade, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setTenantNome(tenantRes.data?.nome ?? "");
    setDemandas((demandasRes.data ?? []) as DemandaItem[]);
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">{tenantNome}</p>
        <h1 className="text-2xl font-bold tracking-tight capitalize">
          Secretaria de {slug?.replace("_", " ") ?? "—"}
        </h1>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 text-base font-semibold">Demandas recebidas</h2>
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : demandas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma demanda visível.</p>
        ) : (
          <ul className="space-y-2">
            {demandas.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-muted-foreground">#{d.protocolo}</p>
                  <p className="truncate font-medium">{d.titulo}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={d.prioridade} />
                  <StatusBadge status={d.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-6 rounded-lg border bg-card p-4 text-xs text-muted-foreground">
        Bloco 4 (próximos prompts) trará KPIs específicos por secretaria, fluxo de
        atualização de status com notificação ao cidadão e exportação de relatórios.
      </div>
    </div>
  );
}
