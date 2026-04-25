import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { Card } from "@/components/ui/card";
import { CidadaoBottomNav } from "@/components/cidadao/CidadaoBottomNav";
import { StatusBadge } from "@/components/StatusBadge";
import { Loader2, School } from "lucide-react";

export const Route = createFileRoute("/cidadao/educacao")({
  head: () => ({
    meta: [
      { title: "Educação — App do Cidadão NovaeXis" },
      { name: "description", content: "Matrículas e turmas escolares." },
    ],
  }),
  component: () => (
    <RoleGuard allowed={["cidadao", "superadmin"]} title="Educação" subtitle="Matrículas escolares">
      <EducacaoPage />
      <CidadaoBottomNav />
    </RoleGuard>
  ),
});

interface Escola { id: string; nome: string; bairro: string | null }
interface Turma { id: string; escola_id: string; serie: string; turno: string; vagas_total: number; vagas_ocupadas: number }
interface Matricula { id: string; nome_aluno: string; escola: string; serie: string | null; status: string }

function EducacaoPage() {
  const { user, profile } = useAuth();
  const [escolas, setEscolas] = useState<Escola[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile?.tenant_id) return;
    void (async () => {
      const [{ data: e }, { data: t }, { data: m }] = await Promise.all([
        supabase.from("escolas").select("id, nome, bairro").eq("tenant_id", profile.tenant_id!).eq("ativo", true),
        supabase.from("turmas").select("id, escola_id, serie, turno, vagas_total, vagas_ocupadas").eq("tenant_id", profile.tenant_id!),
        supabase.from("matriculas").select("id, nome_aluno, escola, serie, status").eq("responsavel_id", user.id),
      ]);
      setEscolas((e ?? []) as Escola[]);
      setTurmas((t ?? []) as Turma[]);
      setMatriculas((m ?? []) as Matricula[]);
      setLoading(false);
    })();
  }, [user, profile?.tenant_id]);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-5 sm:px-6">
      <h1 className="mb-1 text-xl font-bold tracking-tight">Educação</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Solicite matrículas e acompanhe vagas.
      </p>

      <section className="mb-6">
        <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Minhas matrículas
        </h2>
        {loading ? (
          <div className="flex h-20 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : matriculas.length === 0 ? (
          <Card className="p-5 text-center text-sm text-muted-foreground">Nenhuma matrícula solicitada.</Card>
        ) : (
          <ul className="space-y-2">
            {matriculas.map((m) => (
              <li key={m.id}>
                <Card className="flex items-center justify-between p-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{m.nome_aluno}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{m.escola}{m.serie ? ` • ${m.serie}` : ""}</p>
                  </div>
                  <StatusBadge status={m.status} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Escolas do município
        </h2>
        <ul className="space-y-3">
          {escolas.map((e) => {
            const turmasEscola = turmas.filter((t) => t.escola_id === e.id);
            return (
              <li key={e.id}>
                <Card className="p-4">
                  <div className="mb-2 flex items-start gap-3">
                    <School className="h-5 w-5 shrink-0 text-indigo-500" />
                    <div>
                      <p className="text-sm font-semibold">{e.nome}</p>
                      {e.bairro && <p className="text-xs text-muted-foreground">{e.bairro}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {turmasEscola.map((t) => {
                      const restante = t.vagas_total - t.vagas_ocupadas;
                      return (
                        <div key={t.id} className="flex items-center justify-between rounded border bg-muted/20 px-2.5 py-1.5 text-xs">
                          <span>{t.serie} ({t.turno})</span>
                          <span className={restante <= 5 ? "font-semibold text-warning-foreground" : "text-muted-foreground"}>
                            {restante} vaga{restante !== 1 ? "s" : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="mt-6 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        ✨ Próximo ciclo: wizard de matrícula em 4 passos com upload de documentos.
      </p>
    </div>
  );
}
