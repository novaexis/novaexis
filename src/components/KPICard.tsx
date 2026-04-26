import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Status = "ok" | "atencao" | "critico";

interface KPICardProps {
  titulo: string;
  valor: string | number;
  unidade?: string;
  variacaoPct?: number | null;
  status?: Status;
  icon?: React.ReactNode;
  onClick?: () => void;
  fonte?: string | null;
}

const statusStyles: Record<Status, string> = {
  ok: "border-l-success",
  atencao: "border-l-warning",
  critico: "border-l-destructive",
};

export function KPICard({
  titulo,
  valor,
  unidade,
  variacaoPct,
  status = "ok",
  icon,
  onClick,
  fonte,
}: KPICardProps) {
  const fonteReal = !!fonte && fonte !== "seed" && fonte !== "manual";
  const trend =
    variacaoPct == null
      ? null
      : variacaoPct > 0
        ? "up"
        : variacaoPct < 0
          ? "down"
          : "flat";

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-success"
      : trend === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <Card
      onClick={onClick}
      className={cn(
        "border-l-4 p-4 transition-all hover:shadow-md",
        statusStyles[status],
        onClick && "cursor-pointer hover:-translate-y-0.5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {titulo}
          </p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
              {valor}
            </span>
            {unidade && <span className="text-sm text-muted-foreground">{unidade}</span>}
          </div>
          {variacaoPct != null && (
            <div className={cn("mt-1.5 flex items-center gap-1 text-xs", trendColor)}>
              <TrendIcon className="h-3 w-3" />
              <span className="font-mono tabular-nums">
                {variacaoPct > 0 ? "+" : ""}
                {variacaoPct.toFixed(1)}%
              </span>
              <span className="text-muted-foreground">vs. período anterior</span>
            </div>
          )}
        </div>
        {icon && <div className="shrink-0 text-primary">{icon}</div>}
      </div>
      {fonte !== undefined && (
        <div className="mt-2 flex justify-end">
          {fonteReal ? (
            <span
              className="rounded border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success"
              title={`Fonte: ${fonte}`}
            >
              ✓ Dado real
            </span>
          ) : (
            <span
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              title="Dado de demonstração (seed)"
            >
              Demo
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
