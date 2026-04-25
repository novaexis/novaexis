import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { CidadaoBottomNav } from "@/components/cidadao/CidadaoBottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Star, Clock, MapPin, Building2 } from "lucide-react";

export const Route = createFileRoute("/cidadao/demanda/$id")({
  head: () => ({ meta: [{ title: "Detalhe da Solicitação — NovaeXis" }] }),
  component: () => (
    <RoleGuard allowed={["cidadao", "superadmin"]} title="Solicitação" subtitle="Detalhe">
      <DemandaDetailPage />
      <CidadaoBottomNav />
    </RoleGuard>
  ),
});

interface Demanda {
  id: string;
  protocolo: string;
  titulo: string;
  descricao: string | null;
  status: string;
  prioridade: string;
  secretaria_slug: string;
  endereco: string | null;
  prazo_sla: string | null;
  created_at: string;
  updated_at: string;
  concluida_at: string | null;
}

const TIMELINE_STEPS = ["aberta", "em_analise", "em_andamento", "concluida"] as const;
const TIMELINE_LABELS: Record<string, string> = {
  aberta: "Solicitação aberta",
  em_analise: "Em análise",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

function DemandaDetailPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [demanda, setDemanda] = useState<Demanda | null>(null);
  const [secretariaNome, setSecretariaNome] = useState<string>("");
  const [avaliacao, setAvaliacao] = useState<{ nota: number; comentario: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState("");

  useEffect(() => {
    if (!user) return;
    void load();
  }, [id, user]);

  async function load() {
    setLoading(true);
    const { data: d } = await supabase
      .from("demandas")
      .select("id, protocolo, titulo, descricao, status, prioridade, secretaria_slug, endereco, prazo_sla, created_at, updated_at, concluida_at")
      .eq("id", id)
      .maybeSingle();
    if (!d) {
      toast.error("Solicitação não encontrada");
      void nav({ to: "/cidadao/servicos" });
      return;
    }
    setDemanda(d as Demanda);

    const [sec, av] = await Promise.all([
      supabase.from("secretarias").select("nome").eq("slug", (d as Demanda).secretaria_slug).limit(1).maybeSingle(),
      supabase.from("avaliacoes_demandas").select("nota, comentario").eq("demanda_id", id).eq("cidadao_id", user!.id).maybeSingle(),
    ]);
    setSecretariaNome((sec.data as { nome?: string } | null)?.nome ?? (d as Demanda).secretaria_slug);
    if (av.data) setAvaliacao(av.data as { nota: number; comentario: string | null });
    setLoading(false);
  }

  async function handleAvaliar() {
    if (!user || !demanda || nota === 0) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("avaliacoes_demandas").insert({
        cidadao_id: user.id,
        demanda_id: demanda.id,
        tenant_id: (await supabase.from("demandas").select("tenant_id").eq("id", demanda.id).single()).data!.tenant_id,
        nota,
        comentario: comentario.trim() || null,
      });
      if (error) throw error;
      toast.success("Avaliação enviada. Obrigado!");
      setAvaliacao({ nota, comentario });
    } catch (err) {
      toast.error("Erro ao avaliar", { description: String((err as Error).message) });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !demanda) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const stepIdx = TIMELINE_STEPS.indexOf(demanda.status as typeof TIMELINE_STEPS[number]);
  const prazoData = demanda.prazo_sla ? new Date(demanda.prazo_sla) : null;
  const diasRest = prazoData ? Math.ceil((prazoData.getTime() - Date.now()) / 86400000) : null;
  const atrasada = diasRest !== null && diasRest < 0 && demanda.status !== "concluida";

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-5 sm:px-6">
      <Link to="/cidadao/servicos" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <Card className="mb-4 p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-muted-foreground">#{demanda.protocolo}</p>
            <h1 className="mt-0.5 text-lg font-bold tracking-tight">{demanda.titulo}</h1>
          </div>
          <StatusBadge status={demanda.status} />
        </div>
        {demanda.descricao && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{demanda.descricao}</p>}
      </Card>

      <Card className="mb-4 grid gap-2 p-4 text-sm">
        <Info icon={Building2} label="Secretaria" value={secretariaNome} />
        <Info icon={Clock} label="Aberta em" value={new Date(demanda.created_at).toLocaleString("pt-BR")} />
        {prazoData && (
          <Info
            icon={Clock}
            label="Prazo"
            value={prazoData.toLocaleDateString("pt-BR")}
            extra={diasRest !== null ? (
              atrasada ? <span className="text-destructive">({Math.abs(diasRest)}d em atraso)</span>
                : demanda.status === "concluida" ? <span className="text-success">(concluída)</span>
                : <span className="text-success">({diasRest}d restantes)</span>
            ) : null}
          />
        )}
        {demanda.endereco && <Info icon={MapPin} label="Endereço" value={demanda.endereco} />}
      </Card>

      {/* Timeline */}
      <Card className="mb-4 p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Andamento
        </h2>
        <ol className="relative space-y-4 border-l-2 border-muted pl-5">
          {TIMELINE_STEPS.map((s, i) => {
            const done = i <= stepIdx;
            const current = i === stepIdx;
            return (
              <li key={s} className="relative">
                <span className={`absolute -left-[27px] flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                  done ? "border-primary bg-primary" : "border-muted bg-background"
                } ${current ? "ring-4 ring-primary/20" : ""}`} />
                <p className={`text-sm ${done ? "font-semibold" : "text-muted-foreground"}`}>
                  {TIMELINE_LABELS[s]}
                </p>
                {done && i === stepIdx && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Atualizado em {new Date(demanda.updated_at).toLocaleString("pt-BR")}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </Card>

      {/* Avaliação */}
      {demanda.status === "concluida" && (
        <Card className="p-4">
          {avaliacao ? (
            <div>
              <h2 className="mb-2 text-sm font-semibold">Sua avaliação</h2>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`h-5 w-5 ${n <= avaliacao.nota ? "fill-amber-400 text-amber-400" : "text-muted"}`} />
                ))}
              </div>
              {avaliacao.comentario && <p className="mt-2 text-sm text-muted-foreground">"{avaliacao.comentario}"</p>}
            </div>
          ) : (
            <div>
              <h2 className="mb-2 text-sm font-semibold">Avaliar atendimento</h2>
              <div className="mb-3 flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setNota(n)}>
                    <Star className={`h-7 w-7 transition ${n <= nota ? "fill-amber-400 text-amber-400" : "text-muted hover:text-amber-300"}`} />
                  </button>
                ))}
              </div>
              <Textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Comentário (opcional)"
                className="mb-3 min-h-20"
              />
              <Button onClick={handleAvaliar} disabled={nota === 0 || submitting} className="w-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar avaliação"}
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function Info({ icon: Icon, label, value, extra }: { icon: typeof Clock; label: string; value: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value} {extra}</p>
      </div>
    </div>
  );
}
