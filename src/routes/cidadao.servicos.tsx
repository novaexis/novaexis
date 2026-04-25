import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { Card } from "@/components/ui/card";
import { CidadaoBottomNav } from "@/components/cidadao/CidadaoBottomNav";
import { StatusBadge } from "@/components/StatusBadge";
import { Loader2, Wrench, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/cidadao/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços — App do Cidadão NovaeXis" },
      { name: "description", content: "Solicite serviços públicos e acompanhe protocolos." },
    ],
  }),
  component: () => (
    <RoleGuard allowed={["cidadao", "superadmin"]} title="Serviços" subtitle="Catálogo e ouvidoria">
      <ServicosPage />
      <CidadaoBottomNav />
    </RoleGuard>
  ),
});

interface Tipo { id: string; categoria: string; nome: string; prazo_sla_dias: number }
interface Demanda { id: string; protocolo: string; titulo: string; status: string; created_at: string }

function ServicosPage() {
  const { user } = useAuth();
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: t }, { data: d }] = await Promise.all([
        supabase.from("tipos_servico").select("id, categoria, nome, prazo_sla_dias").eq("ativo", true).limit(20),
        supabase.from("demandas").select("id, protocolo, titulo, status, created_at").eq("cidadao_id", user.id).order("created_at", { ascending: false }).limit(20),
      ]);
      setTipos((t ?? []) as Tipo[]);
      setDemandas((d ?? []) as Demanda[]);
      setLoading(false);
    })();
  }, [user]);

  const categorias = Array.from(new Set(tipos.map((t) => t.categoria)));

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-5 sm:px-6">
      <h1 className="mb-1 text-xl font-bold tracking-tight">Serviços</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Solicite serviços ou registre uma manifestação na ouvidoria.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-2.5">
        <Card className="flex items-center gap-3 p-4 cursor-pointer hover:shadow-md">
          <Wrench className="h-6 w-6 text-amber-500" />
          <span className="text-sm font-semibold">Solicitar Serviço</span>
        </Card>
        <Card className="flex items-center gap-3 p-4 cursor-pointer hover:shadow-md">
          <MessageSquare className="h-6 w-6 text-primary" />
          <span className="text-sm font-semibold">Ouvidoria</span>
        </Card>
      </div>

      <section className="mb-6">
        <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Catálogo ({tipos.length} serviços disponíveis)
        </h2>
        {loading ? (
          <div className="flex h-20 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-3">
            {categorias.map((cat) => (
              <div key={cat}>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{cat}</p>
                <div className="space-y-1.5">
                  {tipos.filter((t) => t.categoria === cat).map((t) => (
                    <Card key={t.id} className="flex items-center justify-between p-3">
                      <span className="text-sm">{t.nome}</span>
                      <span className="text-xs text-muted-foreground">{t.prazo_sla_dias}d</span>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Minhas solicitações
        </h2>
        {demandas.length === 0 ? (
          <Card className="p-5 text-center text-sm text-muted-foreground">Nenhuma solicitação ainda.</Card>
        ) : (
          <ul className="space-y-2">
            {demandas.map((d) => (
              <li key={d.id}>
                <Card className="flex items-center justify-between p-3.5">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">#{d.protocolo}</p>
                    <p className="mt-0.5 truncate text-sm font-medium">{d.titulo}</p>
                  </div>
                  <StatusBadge status={d.status} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-6 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        ✨ Próximo ciclo: wizards completos de solicitação (4 passos), ouvidoria com sigilo e upload de mídia.
      </p>
    </div>
  );
}
