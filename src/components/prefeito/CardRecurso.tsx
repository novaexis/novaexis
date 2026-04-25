import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CountdownPrazo } from "./CountdownPrazo";
import { ChecklistRequisitos, type Requisito } from "./ChecklistRequisitos";
import { cn } from "@/lib/utils";

export interface AlertaRecurso {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  fonte: string | null;
  valor_estimado: number | null;
  prazo: string | null;
  status: string;
  requisitos: Requisito[] | null;
  url_edital: string | null;
}

interface Props {
  alerta: AlertaRecurso;
  onMarcarAndamento: (id: string) => void;
  onToggleRequisito: (id: string, requisitos: Requisito[]) => void;
  loading?: boolean;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  disponivel: { label: "Disponível", cls: "bg-muted text-muted-foreground" },
  pendente: { label: "Pendente", cls: "bg-warning/15 text-warning-foreground" },
  em_risco: { label: "Em risco", cls: "bg-destructive/15 text-destructive" },
  em_andamento: { label: "Em andamento", cls: "bg-primary/10 text-primary" },
  captado: { label: "Captado", cls: "bg-success/15 text-success" },
  perdido: { label: "Perdido", cls: "bg-muted text-muted-foreground line-through" },
};

export function CardRecurso({ alerta, onMarcarAndamento, onToggleRequisito, loading }: Props) {
  const requisitos = alerta.requisitos ?? [];
  const status = STATUS_LABEL[alerta.status] ?? STATUS_LABEL.disponivel;
  const dias = alerta.prazo
    ? Math.ceil((new Date(alerta.prazo).getTime() - Date.now()) / 86400000)
    : null;
  const urgente = dias != null && dias <= 15 && dias >= 0;

  return (
    <Card
      className={cn(
        "border-l-4 p-5 transition-shadow hover:shadow-md",
        urgente ? "border-l-destructive" : "border-l-primary/40",
      )}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {alerta.fonte && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {alerta.fonte}
              </span>
            )}
            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", status.cls)}>
              {status.label}
            </span>
          </div>
          <h3 className="mt-1.5 text-base font-semibold leading-tight">{alerta.titulo}</h3>
          {alerta.valor_estimado != null && (
            <p className="mt-0.5 font-mono text-sm text-muted-foreground">
              R$ {Number(alerta.valor_estimado).toLocaleString("pt-BR")} estimado
            </p>
          )}
        </div>
      </div>

      {alerta.descricao && (
        <p className="mb-3 text-sm text-muted-foreground">{alerta.descricao}</p>
      )}

      {alerta.prazo && <CountdownPrazo prazo={alerta.prazo} className="mb-4" />}

      {requisitos.length > 0 && (
        <div className="mb-4">
          <ChecklistRequisitos
            requisitos={requisitos}
            disabled={loading}
            onToggle={(idx, concluido) => {
              const next = requisitos.map((r, i) => (i === idx ? { ...r, concluido } : r));
              onToggleRequisito(alerta.id, next);
            }}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {alerta.status !== "em_andamento" && alerta.status !== "captado" && (
          <Button
            size="sm"
            disabled={loading}
            onClick={() => onMarcarAndamento(alerta.id)}
          >
            Marcar em andamento
          </Button>
        )}
        {alerta.url_edital && (
          <a
            href={alerta.url_edital}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Ver edital <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </Card>
  );
}
