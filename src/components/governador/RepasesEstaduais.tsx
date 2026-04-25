import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RepasseItem {
  id: string;
  fonte: string;
  descricao: string;
  valor: number | null;
  prazo: string;
  status: "recebido" | "em_andamento" | "pendente" | "em_risco";
  requisito_pendente: string | null;
  progresso_pct: number | null;
}

const STATUS_META: Record<RepasseItem["status"], { label: string; color: string; icon: typeof Clock }> = {
  recebido:     { label: "Recebido",     color: "bg-success/15 text-success border-success/30",          icon: CheckCircle2 },
  em_andamento: { label: "Em andamento", color: "bg-primary/10 text-primary border-primary/30",          icon: TrendingUp },
  pendente:     { label: "Pendente",     color: "bg-warning/15 text-warning-foreground border-warning/40", icon: Clock },
  em_risco:     { label: "Em risco",     color: "bg-destructive/15 text-destructive border-destructive/40 animate-pulse", icon: AlertTriangle },
};

function formatBRL(v: number | null) {
  if (v == null) return "—";
  if (v >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(2)} bi`;
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)} mi`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)} mil`;
  return `R$ ${v.toFixed(0)}`;
}

function diasAte(prazo: string): number {
  const d = new Date(prazo);
  return Math.ceil((d.getTime() - Date.now()) / (24 * 3600 * 1000));
}

export function RepasesEstaduais({ repasses }: { repasses: RepasseItem[] }) {
  // Ordenar: em_risco primeiro, depois pendente com prazo curto, depois resto
  const sorted = [...repasses].sort((a, b) => {
    const score = (r: RepasseItem) => {
      if (r.status === "em_risco") return 0;
      if (r.status === "pendente" && diasAte(r.prazo) < 15) return 1;
      if (r.status === "pendente") return 2;
      if (r.status === "em_andamento") return 3;
      return 4;
    };
    return score(a) - score(b);
  });

  return (
    <Card className="p-5">
      <h2 className="mb-1 text-base font-semibold">Repasses Federais ao Estado</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        {repasses.length} repasses ativos
      </p>
      <ul className="space-y-3">
        {sorted.map((r) => {
          const meta = STATUS_META[r.status];
          const Icon = meta.icon;
          const dias = diasAte(r.prazo);
          return (
            <li
              key={r.id}
              className="rounded-lg border bg-card p-3 transition hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.fonte}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {r.descricao}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
                    meta.color,
                  )}
                  title={r.requisito_pendente ?? undefined}
                >
                  <Icon className="h-3 w-3" />
                  {meta.label}
                </span>
              </div>

              <div className="mt-2.5 flex items-center justify-between text-xs">
                <span className="font-mono font-semibold tabular-nums">
                  {formatBRL(r.valor)}
                </span>
                <span
                  className={cn(
                    "tabular-nums",
                    dias < 0
                      ? "text-destructive font-medium"
                      : dias < 15
                        ? "text-warning-foreground"
                        : "text-muted-foreground",
                  )}
                >
                  {dias < 0 ? `Atrasado ${Math.abs(dias)}d` : `${dias}d até o prazo`}
                </span>
              </div>

              {r.status === "em_andamento" && r.progresso_pct != null && (
                <div className="mt-2">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${r.progresso_pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.progresso_pct}% concluído
                  </p>
                </div>
              )}

              {r.requisito_pendente && (
                <p className="mt-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                  ⚠ {r.requisito_pendente}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
