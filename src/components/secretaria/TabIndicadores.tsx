import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import type { KPISecretaria } from "@/hooks/useSecretaria";

interface TabIndicadoresProps {
  kpis: KPISecretaria[];
}

export function TabIndicadores({ kpis }: TabIndicadoresProps) {
  const indicadores = useMemo(
    () => Array.from(new Set(kpis.map((k) => k.indicador))).sort(),
    [kpis],
  );
  const [indicador, setIndicador] = useState<string | null>(indicadores[0] ?? null);
  const [periodo, setPeriodo] = useState<"7" | "30" | "90">("30");

  const ativo = indicador ?? indicadores[0] ?? null;

  const data = useMemo(() => {
    if (!ativo) return [];
    const cutoff = Date.now() - Number(periodo) * 86400000;
    return kpis
      .filter((k) => k.indicador === ativo && new Date(k.referencia_data).getTime() >= cutoff)
      .sort((a, b) => a.referencia_data.localeCompare(b.referencia_data))
      .map((k) => ({
        data: k.referencia_data,
        valor: Number(k.valor),
        status: k.status,
      }));
  }, [kpis, ativo, periodo]);

  function exportarCSV() {
    if (!ativo) return;
    const linhas = [
      "data,valor,status",
      ...data.map((d) => `${d.data},${d.valor},${d.status}`),
    ];
    const blob = new Blob([linhas.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ativo.replace(/\s+/g, "_")}_${periodo}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (indicadores.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        Nenhum indicador cadastrado para esta secretaria ainda.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Select value={ativo ?? undefined} onValueChange={setIndicador}>
              <SelectTrigger className="w-[260px]"><SelectValue placeholder="Indicador" /></SelectTrigger>
              <SelectContent>
                {indicadores.map((i) => (
                  <SelectItem key={i} value={i}>{i}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as typeof periodo)}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={exportarCSV} disabled={data.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">{ativo}</h3>
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Sem dados no período selecionado.
          </p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer>
              <ComposedChart data={data}>
                <defs>
                  <linearGradient id="kpiGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="data"
                  tickFormatter={(v) => format(parseISO(v as string), "dd/MM", { locale: ptBR })}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(v) =>
                    format(parseISO(v as string), "dd MMM yyyy", { locale: ptBR })
                  }
                />
                <Area
                  type="monotone"
                  dataKey="valor"
                  stroke="hsl(var(--primary))"
                  fill="url(#kpiGrad)"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="valor"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
