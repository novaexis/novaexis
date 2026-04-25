import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CidadaoBottomNav } from "@/components/cidadao/CidadaoBottomNav";
import { StatusBadge } from "@/components/StatusBadge";
import { Loader2, MapPin, Calendar, Plus } from "lucide-react";

export const Route = createFileRoute("/cidadao/saude")({
  head: () => ({
    meta: [
      { title: "Saúde — App do Cidadão NovaeXis" },
      { name: "description", content: "Agende consultas, exames e vacinas." },
    ],
  }),
  component: () => (
    <RoleGuard allowed={["cidadao", "superadmin"]} title="Saúde" subtitle="Agendamentos">
      <SaudePage />
      <CidadaoBottomNav />
    </RoleGuard>
  ),
});

interface Unidade { id: string; nome: string; tipo: string; bairro: string | null }
interface Agendamento { id: string; tipo: string; especialidade: string | null; data_hora: string; unidade_saude: string; status: string }

function SaudePage() {
  const { user, profile } = useAuth();
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile?.tenant_id) return;
    void (async () => {
      const [{ data: u }, { data: a }] = await Promise.all([
        supabase.from("unidades_saude").select("id, nome, tipo, bairro").eq("tenant_id", profile.tenant_id!).eq("ativo", true),
        supabase.from("agendamentos_saude").select("id, tipo, especialidade, data_hora, unidade_saude, status").eq("cidadao_id", user.id).order("data_hora", { ascending: true }),
      ]);
      setUnidades((u ?? []) as Unidade[]);
      setAgendamentos((a ?? []) as Agendamento[]);
      setLoading(false);
    })();
  }, [user, profile?.tenant_id]);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-5 sm:px-6">
      <h1 className="mb-1 text-xl font-bold tracking-tight">Saúde</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Agende consultas, exames e vacinas nas unidades do município.
      </p>

      <Link to="/cidadao/saude/agendar">
        <Button className="mb-6 w-full gap-2" size="lg">
          <Plus className="h-4 w-4" />
          Agendar atendimento
        </Button>
      </Link>

      <section className="mb-6">
        <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Próximos agendamentos
        </h2>
        {loading ? (
          <div className="flex h-20 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : agendamentos.length === 0 ? (
          <Card className="p-5 text-center text-sm text-muted-foreground">Você não tem agendamentos.</Card>
        ) : (
          <ul className="space-y-2">
            {agendamentos.map((a) => (
              <li key={a.id}>
                <Card className="p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold capitalize">{a.tipo}{a.especialidade ? ` — ${a.especialidade}` : ""}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{a.unidade_saude}</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs">
                        <Calendar className="h-3 w-3" />
                        {new Date(a.data_hora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Unidades de saúde do município
        </h2>
        <ul className="space-y-2">
          {unidades.map((u) => (
            <li key={u.id}>
              <Card className="flex items-center gap-3 p-3.5">
                <MapPin className="h-5 w-5 shrink-0 text-rose-500" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{u.nome}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                    {u.tipo}{u.bairro ? ` • ${u.bairro}` : ""}
                  </p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>

    </div>
  );
}
