import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Requisito {
  item: string;
  concluido: boolean;
}

interface Props {
  requisitos: Requisito[];
  onToggle: (index: number, concluido: boolean) => void;
  disabled?: boolean;
}

export function ChecklistRequisitos({ requisitos, onToggle, disabled }: Props) {
  const total = requisitos.length;
  const feitos = requisitos.filter((r) => r.concluido).length;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Requisitos: <span className="text-foreground">{feitos} de {total}</span> concluídos
      </p>
      <ul className="space-y-1.5">
        {requisitos.map((r, i) => (
          <li key={i} className="flex items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onToggle(i, !r.concluido)}
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                r.concluido
                  ? "border-success bg-success text-success-foreground"
                  : "border-muted-foreground/30 hover:border-foreground",
                disabled && "cursor-not-allowed opacity-50",
              )}
              aria-label={r.concluido ? "Desmarcar" : "Marcar como concluído"}
            >
              {r.concluido && <Check className="h-3 w-3" strokeWidth={3} />}
            </button>
            <span
              className={cn(
                "text-sm",
                r.concluido ? "text-muted-foreground line-through" : "text-foreground",
              )}
            >
              {r.item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
