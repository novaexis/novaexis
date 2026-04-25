import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/prefeito/benchmark")({
  head: () => ({
    meta: [{ title: "Benchmark intermunicipal — Prefeito — NovaeXis" }],
  }),
  component: BenchmarkPage,
});

const INDICADORES = [
  { secretaria: "saude", indicador: "Cobertura atenção básica", label: "Cobertura saúde", maiorMelhor: true },
  { secretaria: "educacao", indicador: "Taxa de matrícula", label: "Matrícula escolar", maiorMelhor: true },
  { secretaria: "infraestrutura", indicador: "Ordens concluídas", label: "Ordens de serviço", maiorMelhor: true },
  { secretaria: "assistencia_social", indicador: "Famílias CadÚnico", label: "Famílias atendidas", maiorMelhor: true },
  { secretaria: "financas", indicador: "Execução orçamentária", label: "Execução orçamentária", maiorMelhor: true },
  { secretaria: "seguranca", indicador: "Ocorrências registradas", label: "Ocorrências (↓ melhor)", maiorMelhor: false },
];

interface MunicipioRow {
  tenant_id: string;
  nome: string;
  valor: number;
  unidade: string | null;
  variacao_pct: number | null;
  isUser: boolean;
}

function BenchmarkPage() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;
  const [indicadorIdx, setIndicadorIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MunicipioRow[]>([]);
  const [tenantNome, setTenantNome] = useState<string>("");

  const indicador = INDICADORES[indicadorIdx];

  useEffect(() => {
    if (!tenantId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, indicadorIdx]);

  async function load() {
    setLoading(true);
    try {
      // 1) Lista de municípios
      const { data: tenants, error: terr } = await supabase
        .from("tenants")
        .select("id, nome")
        .eq("tipo", "municipio")
        .eq("ativo", true);
      if (terr) throw terr;

      // 2) Para cada município, último valor do indicador
      const list: MunicipioRow[] = [];
      for (const t of tenants ?? []) {
        const { data: kpi } = await supabase
          .from("kpis")
          .select("valor, unidade, variacao_pct")
          .eq("tenant_id", t.id)
          .eq("secretaria_slug", indicador.secretaria)
          .eq("indicador", indicador.indicador)
          .order("referencia_data", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (kpi) {
          list.push({
            tenant_id: t.id,
            nome: t.nome,
            valor: Number(kpi.valor),
            unidade: kpi.unidade,
            variacao_pct: kpi.variacao_pct ? Number(kpi.variacao_pct) : null,
            isUser: t.id === tenantId,
          });
        }
        if (t.id === tenantId) setTenantNome(t.nome);
      }

      // Ordenação
      list.sort((a, b) =>
        indicador.maiorMelhor ? b.valor - a.valor : a.valor - b.valor,
      );
      setRows(list);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar benchmark");
    } finally {
      setLoading(false);
    }
  }

  const userRow = useMemo(
    () => rows.find((r) => r.isUser),
    [rows],
  );
  const userPos = useMemo(
    () => (userRow ? rows.findIndex((r) => r.isUser) + 1 : 0),
    [rows, userRow],
  );
  const media = useMemo(
    () => (rows.length ? rows.reduce((s, r) => s + r.valor, 0) / rows.length : 0),
    [rows],
  );

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Benchmark intermunicipal
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compare seu município com outros do estado
        </p>
      </header>

      {/* Filtro indicador */}
      <div className="mb-6 flex flex-wrap gap-2">
        {INDICADORES.map((ind, i) => (
          <button
            key={ind.indicador}
            onClick={() => setIndicadorIdx(i)}
            className={
              "rounded-full border px-3 py-1.5 text-sm transition-colors " +
              (i === indicadorIdx
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted")
            }
          >
            {ind.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Sem dados disponíveis para este indicador.
          </p>
        </div>
      ) : (
        <>
          {/* Resumo posição */}
          <section className="mb-6 grid gap-4 md:grid-cols-3">
            <CardResumo
              titulo="Sua posição"
              valor={userRow ? `${userPos}º` : "—"}
              sub={userRow ? `de ${rows.length} municípios` : "Sem dado"}
              icon={<Trophy className="h-5 w-5 text-primary" />}
            />
            <CardResumo
              titulo={tenantNome || "Seu valor"}
              valor={
                userRow
                  ? `${userRow.valor.toFixed(1)}${userRow.unidade ?? ""}`
                  : "—"
              }
              sub={
                userRow?.variacao_pct != null
                  ? `${userRow.variacao_pct > 0 ? "+" : ""}${userRow.variacao_pct.toFixed(1)}% vs período anterior`
                  : ""
              }
              icon={
                userRow?.variacao_pct == null ? (
                  <Minus className="h-5 w-5 text-muted-foreground" />
                ) : userRow.variacao_pct > 0 ? (
                  <TrendingUp className="h-5 w-5 text-primary" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-destructive" />
                )
              }
            />
            <CardResumo
              titulo="Média do estado"
              valor={`${media.toFixed(1)}${rows[0]?.unidade ?? ""}`}
              sub={
                userRow
                  ? userRow.valor >= media
                    ? "Você está acima da média"
                    : "Você está abaixo da média"
                  : ""
              }
              icon={<TrendingUp className="h-5 w-5 text-muted-foreground" />}
            />
          </section>

          {/* Gráfico */}
          <section className="rounded-lg border bg-card p-4 md:p-6">
            <h2 className="mb-4 text-base font-semibold">
              Comparativo entre municípios
            </h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={rows.map((r) => ({
                    nome: r.nome,
                    valor: r.valor,
                    isUser: r.isUser,
                  }))}
                  layout="vertical"
                  margin={{ left: 16, right: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    type="number"
                    className="fill-muted-foreground text-xs"
                  />
                  <YAxis
                    dataKey="nome"
                    type="category"
                    width={140}
                    className="fill-muted-foreground text-xs"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                    }}
                    formatter={(v: number) =>
                      `${v.toFixed(1)}${rows[0]?.unidade ?? ""}`
                    }
                  />
                  <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                    {rows.map((r) => (
                      <Cell
                        key={r.tenant_id}
                        fill={
                          r.isUser
                            ? "hsl(var(--primary))"
                            : "hsl(var(--muted-foreground) / 0.4)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Tabela ranking */}
          <section className="mt-6 overflow-hidden rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Município</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-right">vs período</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.tenant_id}
                    className={
                      "border-b last:border-0 " +
                      (r.isUser ? "bg-primary/5 font-medium" : "")
                    }
                  >
                    <td className="px-4 py-3">{i + 1}º</td>
                    <td className="px-4 py-3">
                      {r.nome}
                      {r.isUser && (
                        <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                          você
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.valor.toFixed(1)}
                      {r.unidade ?? ""}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.variacao_pct == null ? (
                        "—"
                      ) : (
                        <span
                          className={
                            r.variacao_pct > 0
                              ? "text-primary"
                              : "text-destructive"
                          }
                        >
                          {r.variacao_pct > 0 ? "+" : ""}
                          {r.variacao_pct.toFixed(1)}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

function CardResumo({
  titulo,
  valor,
  sub,
  icon,
}: {
  titulo: string;
  valor: string;
  sub: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {titulo}
        </p>
        {icon}
      </div>
      <p className="text-2xl font-bold tabular-nums">{valor}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
