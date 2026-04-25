import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { Card } from "@/components/ui/card";
import { CidadaoBottomNav } from "@/components/cidadao/CidadaoBottomNav";
import { StatusBadge } from "@/components/StatusBadge";
import { Loader2, Wrench, MessageSquare, ChevronRight } from "lucide-react";

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

interface Demanda {
  id: string;
  protocolo: string;
  titulo: string;
  status: string;
  created_at: string;
  secretaria_slug: string;
}

type Filtro = "todas" | "abertas" | "concluidas";

function ServicosPage() {
  const { user } = useAuth();
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("todas");

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("demandas")
        .select("id, protocolo, titulo, status, created_at, secretaria_slug")
        .eq("cidadao_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setDemandas((data ?? []) as Demanda[]);
      setLoading(false);
    })();
  }, [user]);

  const filtradas = demandas.filter((d) => {
    if (filtro === "abertas") return d.status !== "concluida" && d.status !== "rejeitada";
    if (filtro === "concluidas") return d.status === "concluida";
    return true;
  });

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-5 sm:px-6">
      <h1 className="mb-1 text-xl font-bold tracking-tight">Serviços</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Solicite serviços ou registre uma manifestação na ouvidoria.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-2.5">
        <Link to="/cidadao/servicos/solicitar">
          <Card className="flex h-full items-center gap-3 p-4 transition hover:shadow-md hover:-translate-y-0.5">
            <Wrench className="h-6 w-6 text-amber-500" />
            <span className="text-sm font-semibold">Solicitar Serviço</span>
          </Card>
        </Link>
        <Link to="/cidadao/servicos/ouvidoria">
          <Card className="flex h-full items-center gap-3 p-4 transition hover:shadow-md hover:-translate-y-0.5">
            <MessageSquare className="h-6 w-6 text-primary" />
            <span className="text-sm font-semibold">Ouvidoria</span>
          </Card>
        </Link>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Minhas solicitações
          </h2>
          <div className="flex gap-1 rounded-lg border bg-muted/40 p-0.5 text-xs">
            {(["todas", "abertas", "concluidas"] as Filtro[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                className={`rounded px-2.5 py-1 capitalize ${filtro === f ? "bg-background shadow-sm font-semibold" : "text-muted-foreground"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : filtradas.length === 0 ? (
          <Card className="p-5 text-center text-sm text-muted-foreground">
            Nenhuma solicitação {filtro !== "todas" ? filtro : "ainda"}.
          </Card>
        ) : (
          <ul className="space-y-2">
            {filtradas.map((d) => (
              <li key={d.id}>
                <Link to="/cidadao/demanda/$id" params={{ id: d.id }}>
                  <Card className="flex items-center gap-3 p-3.5 transition hover:shadow-md">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-muted-foreground">#{d.protocolo}</p>
                      <p className="mt-0.5 truncate text-sm font-medium">{d.titulo}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(d.created_at).toLocaleDateString("pt-BR")} • {d.secretaria_slug}
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
    </div>
  );
}
