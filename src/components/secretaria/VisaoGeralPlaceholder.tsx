import { useMemo } from "react";
import { KPICard } from "@/components/KPICard";
import { Card } from "@/components/ui/card";
import type { KPISecretaria } from "@/hooks/useSecretaria";

interface VisaoGeralPlaceholderProps {
  kpis: KPISecretaria[];
  nome: string;
}

/**
 * Visão Geral genérica: lista os 4 KPIs mais recentes da secretaria.
 * Será substituída por implementações específicas em cada painel.
 */
export function VisaoGeralPlaceholder({ kpis, nome }: VisaoGeralPlaceholderProps) {
  const ultimos = useMemo(() => {
    const porIndicador = new Map<string, KPISecretaria>();
    for (const k of kpis) {
      const existente = porIndicador.get(k.indicador);
      if (!existente || existente.referencia_data < k.referencia_data) {
        porIndicador.set(k.indicador, k);
      }
    }
    return Array.from(porIndicador.values()).slice(0, 4);
  }, [kpis]);

  return (
    <div className="space-y-4">
      {ultimos.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Nenhum KPI cadastrado para a {nome} ainda.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {ultimos.map((k) => (
            <KPICard
              key={k.id}
              titulo={k.indicador}
              valor={Number(k.valor).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
              unidade={k.unidade ?? undefined}
              variacaoPct={k.variacao_pct}
              status={k.status}
            />
          ))}
        </div>
      )}

      <Card className="border-dashed bg-muted/30 p-4 text-xs text-muted-foreground">
        Painel específico desta secretaria será detalhado nas próximas entregas (componentes
        especializados, mapas de calor, kanban, alertas LRF etc.).
      </Card>
    </div>
  );
}
