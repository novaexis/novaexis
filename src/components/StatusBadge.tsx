import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusKind = "ok" | "atencao" | "critico" | "info" | "neutral";

const styleByKind: Record<StatusKind, string> = {
  ok: "bg-success/15 text-success border-success/30",
  atencao: "bg-warning/15 text-warning-foreground border-warning/40",
  critico: "bg-destructive/15 text-destructive border-destructive/30",
  info: "bg-primary/10 text-primary border-primary/25",
  neutral: "bg-muted text-muted-foreground border-border",
};

const STATUS_MAP: Record<string, { label: string; kind: StatusKind }> = {
  ok: { label: "OK", kind: "ok" },
  atencao: { label: "Atenção", kind: "atencao" },
  critico: { label: "Crítico", kind: "critico" },
  aberta: { label: "Aberta", kind: "info" },
  em_analise: { label: "Em análise", kind: "info" },
  em_andamento: { label: "Em andamento", kind: "atencao" },
  concluida: { label: "Concluída", kind: "ok" },
  rejeitada: { label: "Rejeitada", kind: "neutral" },
  disponivel: { label: "Disponível", kind: "info" },
  perdido: { label: "Perdido", kind: "critico" },
  captado: { label: "Captado", kind: "ok" },
  agendado: { label: "Agendado", kind: "info" },
  confirmado: { label: "Confirmado", kind: "ok" },
  realizado: { label: "Realizado", kind: "ok" },
  cancelado: { label: "Cancelado", kind: "neutral" },
  faltou: { label: "Faltou", kind: "critico" },
  solicitada: { label: "Solicitada", kind: "info" },
  deferida: { label: "Deferida", kind: "ok" },
  indeferida: { label: "Indeferida", kind: "critico" },
  urgente: { label: "Urgente", kind: "critico" },
  alta: { label: "Alta", kind: "atencao" },
  media: { label: "Média", kind: "info" },
  baixa: { label: "Baixa", kind: "neutral" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const meta = STATUS_MAP[status] ?? { label: status, kind: "neutral" as StatusKind };
  return (
    <Badge variant="outline" className={cn("font-medium", styleByKind[meta.kind], className)}>
      {meta.label}
    </Badge>
  );
}
