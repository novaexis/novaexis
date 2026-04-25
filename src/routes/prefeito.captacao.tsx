import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { CardRecurso, type AlertaRecurso } from "@/components/prefeito/CardRecurso";
import type { Requisito } from "@/components/prefeito/ChecklistRequisitos";
import { ComunicadosEstadoSection } from "@/components/prefeito/ComunicadosEstadoSection";
import { Loader2, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/prefeito/captacao")({
  head: () => ({ meta: [{ title: "Captação de recursos — Prefeito — NovaeXis" }] }),
  component: CaptacaoPage,
});

const FILTROS_STATUS = [
  { v: "todos", label: "Todos" },
  { v: "em_risco", label: "Em risco" },
  { v: "em_andamento", label: "Em andamento" },
  { v: "disponivel", label: "Disponíveis" },
  { v: "pendente", label: "Pendentes" },
];

const FILTROS_TIPO = [
  { v: "todos", label: "Todos" },
  { v: "recurso_federal", label: "Federal" },
  { v: "recurso_estadual", label: "Estadual" },
  { v: "obrigacao_legal", label: "Obrigação legal" },
];

function CaptacaoPage() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;
  const [alertas, setAlertas] = useState<AlertaRecurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [busca, setBusca] = useState("");

  async function load(tid: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from("alertas_prazos")
      .select("*")
      .eq("tenant_id", tid)
      .order("prazo", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar oportunidades");
    } else {
      setAlertas((data ?? []) as unknown as AlertaRecurso[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!tenantId) return;
    void load(tenantId);
  }, [tenantId]);

  async function marcarAndamento(id: string) {
    if (!tenantId) return;
    setUpdating(id);
    const { error } = await supabase
      .from("alertas_prazos")
      .update({ status: "em_andamento" })
      .eq("id", id)
      .eq("tenant_id", tenantId);
    setUpdating(null);
    if (error) {
      toast.error("Falha ao atualizar status");
      return;
    }
    toast.success("Recurso marcado como em andamento");
    setAlertas((prev) => prev.map((a) => (a.id === id ? { ...a, status: "em_andamento" } : a)));
  }

  async function toggleRequisito(id: string, requisitos: Requisito[]) {
    if (!tenantId) return;
    setUpdating(id);
    // Otimista
    setAlertas((prev) => prev.map((a) => (a.id === id ? { ...a, requisitos } : a)));
    const { error } = await supabase
      .from("alertas_prazos")
      .update({ requisitos: requisitos as unknown as never })
      .eq("id", id)
      .eq("tenant_id", tenantId);
    setUpdating(null);
    if (error) {
      toast.error("Falha ao salvar requisito");
      if (tenantId) void load(tenantId);
    }
  }

  const filtrados = useMemo(() => {
    return alertas.filter((a) => {
      if (filtroStatus !== "todos" && a.status !== filtroStatus) return false;
      if (filtroTipo !== "todos" && a.tipo !== filtroTipo) return false;
      if (busca && !a.titulo.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [alertas, filtroStatus, filtroTipo, busca]);

  const grupos = useMemo(() => {
    const g = { urgentes: [] as AlertaRecurso[], andamento: [] as AlertaRecurso[], disponiveis: [] as AlertaRecurso[] };
    for (const a of filtrados) {
      if (a.status === "em_andamento") g.andamento.push(a);
      else if (a.status === "em_risco" || (a.prazo && Math.ceil((new Date(a.prazo).getTime() - Date.now()) / 86400000) <= 15))
        g.urgentes.push(a);
      else g.disponiveis.push(a);
    }
    return g;
  }, [filtrados]);

  const urgentesPrazo = useMemo(
    () =>
      alertas.filter((a) => {
        if (!a.prazo) return false;
        const d = Math.ceil((new Date(a.prazo).getTime() - Date.now()) / 86400000);
        return d >= 0 && d <= 15;
      }).length,
    [alertas],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pl-16 sm:px-6 md:pl-6 lg:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Captação de Recursos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Oportunidades federais, estaduais e obrigações para o município
        </p>
      </header>

      <ComunicadosEstadoSection />

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
        >
          {FILTROS_STATUS.map((f) => (
            <option key={f.v} value={f.v}>
              Status: {f.label}
            </option>
          ))}
        </select>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
        >
          {FILTROS_TIPO.map((f) => (
            <option key={f.v} value={f.v}>
              Tipo: {f.label}
            </option>
          ))}
        </select>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="rounded-md border bg-background py-1.5 pl-7 pr-2 text-sm"
          />
        </div>
      </div>

      {urgentesPrazo > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">
            {urgentesPrazo} recurso(s) com prazo em menos de 15 dias
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma oportunidade encontrada com os filtros atuais.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grupos.urgentes.length > 0 && (
            <Grupo
              titulo="URGENTE"
              descricao="Prazo em ≤ 15 dias ou em risco"
              alertas={grupos.urgentes}
              onMarcarAndamento={marcarAndamento}
              onToggleRequisito={toggleRequisito}
              updatingId={updating}
            />
          )}
          {grupos.andamento.length > 0 && (
            <Grupo
              titulo="EM ANDAMENTO"
              descricao="Recursos com captação em curso"
              alertas={grupos.andamento}
              onMarcarAndamento={marcarAndamento}
              onToggleRequisito={toggleRequisito}
              updatingId={updating}
            />
          )}
          {grupos.disponiveis.length > 0 && (
            <Grupo
              titulo="DISPONÍVEIS"
              descricao="Oportunidades abertas para análise"
              alertas={grupos.disponiveis}
              onMarcarAndamento={marcarAndamento}
              onToggleRequisito={toggleRequisito}
              updatingId={updating}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Grupo(props: {
  titulo: string;
  descricao: string;
  alertas: AlertaRecurso[];
  onMarcarAndamento: (id: string) => void;
  onToggleRequisito: (id: string, requisitos: Requisito[]) => void;
  updatingId: string | null;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {props.titulo}
        </h2>
        <p className="text-xs text-muted-foreground/80">{props.descricao}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {props.alertas.map((a) => (
          <CardRecurso
            key={a.id}
            alerta={a}
            onMarcarAndamento={props.onMarcarAndamento}
            onToggleRequisito={props.onToggleRequisito}
            loading={props.updatingId === a.id}
          />
        ))}
      </div>
    </section>
  );
}
