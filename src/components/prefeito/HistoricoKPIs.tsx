import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Loader2 } from "lucide-react";

interface Props {
  tenantId: string;
  secretarias: { slug: string; nome: string }[];
}

interface Ponto {
  data: string;
  valor: number;
  status: string;
}

export function HistoricoKPIs({ tenantId, secretarias }: Props) {
  const [secSlug, setSecSlug] = useState(secretarias[0]?.slug ?? "saude");
  const [indicadores, setIndicadores] = useState<string[]>([]);
  const [indicador, setIndicador] = useState<string>("");
  const [periodo, setPeriodo] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<Ponto[]>([]);
  const [loading, setLoading] = useState(false);

  // Carrega lista de indicadores ao trocar secretaria
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const { data: lista } = await supabase
        .from("kpis")
        .select("indicador")
        .eq("tenant_id", tenantId)
        .eq("secretaria_slug", secSlug)
        .limit(500);
      if (cancelado) return;
      const unicos = Array.from(new Set((lista ?? []).map((k) => k.indicador)));
      setIndicadores(unicos);
      setIndicador((prev) => (unicos.includes(prev) ? prev : (unicos[0] ?? "")));
    })();
    return () => {
      cancelado = true;
    };
  }, [tenantId, secSlug]);

  // Carrega histórico
  useEffect(() => {
    if (!indicador) {
      setData([]);
      return;
    }
    let cancelado = false;
    setLoading(true);
    void (async () => {
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - periodo);
      const { data: hist } = await supabase
        .from("kpis")
        .select("referencia_data, valor, status")
        .eq("tenant_id", tenantId)
        .eq("secretaria_slug", secSlug)
        .eq("indicador", indicador)
        .gte("referencia_data", dataInicio.toISOString().slice(0, 10))
        .order("referencia_data", { ascending: true });
      if (cancelado) return;
      setData(
        (hist ?? []).map((p) => ({
          data: new Date(p.referencia_data).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          }),
          valor: Number(p.valor),
          status: p.status,
        })),
      );
      setLoading(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [tenantId, secSlug, indicador, periodo]);

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Histórico de indicadores</h3>
        <div className="flex flex-wrap gap-2">
          <select
            value={secSlug}
            onChange={(e) => setSecSlug(e.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-xs"
          >
            {secretarias.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.nome}
              </option>
            ))}
          </select>
          <select
            value={indicador}
            onChange={(e) => setIndicador(e.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-xs"
            disabled={!indicadores.length}
          >
            {indicadores.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <div className="flex overflow-hidden rounded-md border text-xs">
            {([7, 30, 90] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={
                  periodo === p
                    ? "bg-primary px-2.5 py-1 text-primary-foreground"
                    : "bg-background px-2.5 py-1 hover:bg-muted"
                }
              >
                {p}d
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="h-64 w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Sem dados para o período selecionado.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="data" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="valor"
                fill="hsl(var(--primary))"
                fillOpacity={0.15}
                stroke="none"
              />
              <Line
                type="monotone"
                dataKey="valor"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
