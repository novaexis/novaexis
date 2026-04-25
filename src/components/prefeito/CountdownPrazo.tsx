import { cn } from "@/lib/utils";

interface Props {
  prazo: string; // ISO date
  className?: string;
}

export function CountdownPrazo({ prazo, className }: Props) {
  const dias = Math.ceil((new Date(prazo).getTime() - Date.now()) / 86400000);
  const totalProgress = Math.max(0, Math.min(100, (dias / 60) * 100));
  const vencido = dias < 0;
  const critico = !vencido && dias <= 15;
  const atencao = !vencido && !critico && dias <= 30;

  const cor = vencido
    ? "bg-destructive"
    : critico
      ? "bg-destructive animate-pulse"
      : atencao
        ? "bg-warning"
        : "bg-success";

  const texto = vencido
    ? `Vencido há ${Math.abs(dias)} dias`
    : dias === 0
      ? "Vence hoje"
      : `${dias} dias restantes`;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Prazo:{" "}
          {new Date(prazo).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            vencido || critico
              ? "text-destructive"
              : atencao
                ? "text-warning-foreground"
                : "text-success",
          )}
        >
          {texto}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", cor)}
          style={{ width: `${vencido ? 100 : 100 - totalProgress}%` }}
        />
      </div>
    </div>
  );
}
