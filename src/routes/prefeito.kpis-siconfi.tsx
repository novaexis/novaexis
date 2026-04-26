import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { ArrowDown, ArrowUp, Database, Minus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/prefeito/kpis-siconfi")({
  head: () => ({
    meta: [
      { title: "KPIs SICONFI — Prefeito — NovaeXis" },
      {
        name: "description",
        content:
          "Indicadores fiscais do RREO/SICONFI por bimestre, com gráficos de evolução e filtros por tipo de indicador.",
      },
    ],
  }),
  component: KpisSiconfiPage,
});

interface KpiRow {
  id: string;
  indicador: string;
  secretaria_slug: string;
  valor: number;
  unidade: string | null;
  referencia_data: string;
  status: string;
  fonte: string | null;
}

const SECRETARIA_LABEL: Record<string, string> = {
  financas: "Finanças",
  saude: "Saúde",
  educacao: "Educação",
  seguranca: "Segurança",
  infraestrutura: "Infraestrutura",
  assistencia: "Assistência Social",
};

function bimestreDe(refDate: string): { ano: number; bim: number; label: string } {
  const d = new Date(refDate + "T00:00:00");
  const mes = d.getMonth() + 1;
  const bim = Math.ceil(mes / 2);
  return { ano: d.getFullYear(), bim, label: `${bim}º bim/${d.getFullYear()}` };
}

function formatarValor(v: number, unidade: string | null): string {
  if (unidade === "R$") {
    if (Math.abs(v) >= 1_000_000)
      return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
    if (Math.abs(v) >= 1_000)
      return `R$ ${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
    return `R$ ${v.toLocaleString("pt-BR")}`;
  }
  if (unidade === "%") return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  return `${v.toLocaleString("pt-BR")}${unidade ? ` ${unidade}` : ""}`;
}

const CORES = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 200 80% 50%))",
  "hsl(var(--chart-3, 30 90% 55%))",
  "hsl(var(--chart-4, 280 70% 55%))",
  "hsl(var(--chart-5, 150 60% 45%))",
  "hsl(var(--destructive))",
];

function KpisSiconfiPage() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  const [rows, setRows] = useState<KpiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [secretaria, setSecretaria] = useState<string>("todas");
  const [indicador, setIndicador] = useState<string>("todos");
  const [janela, setJanela] = useState<string>("6"); // últimos N bimestres

  async function carregar() {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("kpis")
      .select("id, indicador, secretaria_slug, valor, unidade, referencia_data, status, fonte")
      .eq("tenant_id", tenantId)
      .like("fonte", "api:siconfi%")
      .order("referencia_data", { ascending: false })
      .limit(1000);
    if (error) {
      toast.error("Erro ao carregar KPIs do SICONFI");
      setRows([]);
    } else {
      setRows((data ?? []) as KpiRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // Lista de secretarias e indicadores presentes nos dados
  const secretariasDisponiveis = useMemo(
    () => Array.from(new Set(rows.map((r) => r.secretaria_slug))).sort(),
    [rows],
  );
  const indicadoresDisponiveis = useMemo(() => {
    const filtradosPorSec = secretaria === "todas"
      ? rows
      : rows.filter((r) => r.secretaria_slug === secretaria);
    return Array.from(new Set(filtradosPorSec.map((r) => r.indicador))).sort();
  }, [rows, secretaria]);

  // Aplica filtros + janela
  const rowsFiltrados = useMemo(() => {
    let r = rows;
    if (secretaria !== "todas") r = r.filter((x) => x.secretaria_slug === secretaria);
    if (indicador !== "todos") r = r.filter((x) => x.indicador === indicador);
    if (janela !== "todos") {
      const n = Number(janela);
      const bimestresUnicos = Array.from(new Set(r.map((x) => x.referencia_data)))
        .sort()
        .slice(-n);
      const set = new Set(bimestresUnicos);
      r = r.filter((x) => set.has(x.referencia_data));
    }
    return r;
  }, [rows, secretaria, indicador, janela]);

  // Resumo por indicador (último valor + variação vs penúltimo bimestre)
  const resumoIndicadores = useMemo(() => {
    const grupos = new Map<string, KpiRow[]>();
    for (const r of rowsFiltrados) {
      const arr = grupos.get(r.indicador) ?? [];
      arr.push(r);
      grupos.set(r.indicador, arr);
    }
    return Array.from(grupos.entries())
      .map(([ind, lista]) => {
        const ord = [...lista].sort((a, b) => a.referencia_data.localeCompare(b.referencia_data));
        const ultimo = ord[ord.length - 1];
        const anterior = ord[ord.length - 2];
        const variacao =
          anterior && anterior.valor !== 0
            ? ((ultimo.valor - anterior.valor) / Math.abs(anterior.valor)) * 100
            : null;
        return {
          indicador: ind,
          secretaria: ultimo.secretaria_slug,
          unidade: ultimo.unidade,
          ultimoValor: ultimo.valor,
          ultimoLabel: bimestreDe(ultimo.referencia_data).label,
          variacao,
          status: ultimo.status,
        };
      })
      .sort((a, b) => a.indicador.localeCompare(b.indicador));
  }, [rowsFiltrados]);

  // Dados para o gráfico: cada bimestre = ponto no eixo X, cada indicador = série
  const { dadosGrafico, seriesGrafico } = useMemo(() => {
    const bimestresOrdenados = Array.from(
      new Set(rowsFiltrados.map((r) => r.referencia_data)),
    ).sort();
    const indicadoresUnicos = Array.from(new Set(rowsFiltrados.map((r) => r.indicador)));

    const dados = bimestresOrdenados.map((ref) => {
      const ponto: Record<string, number | string> = {
        bimestre: bimestreDe(ref).label,
        _ref: ref,
      };
      for (const ind of indicadoresUnicos) {
        const item = rowsFiltrados.find((r) => r.referencia_data === ref && r.indicador === ind);
        if (item) ponto[ind] = item.valor;
      }
      return ponto;
    });
    return { dadosGrafico: dados, seriesGrafico: indicadoresUnicos };
  }, [rowsFiltrados]);

  // Reset cascata quando muda a secretaria
  useEffect(() => {
    setIndicador("todos");
  }, [secretaria]);

  if (!tenantId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Faça login com um perfil vinculado a uma prefeitura para visualizar os KPIs.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">KPIs SICONFI</h1>
          <p className="text-sm text-muted-foreground">
            Indicadores fiscais do RREO/SICONFI por bimestre, com evolução histórica.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link to="/prefeito/kpis-siconfi/auditoria">Auditoria</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link to="/prefeito/integracoes">Gerenciar integrações</Link>
          </Button>
        </div>
      </header>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Secretaria</label>
            <Select value={secretaria} onValueChange={setSecretaria}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as secretarias</SelectItem>
                {secretariasDisponiveis.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SECRETARIA_LABEL[s] ?? s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Indicador</label>
            <Select value={indicador} onValueChange={setIndicador}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os indicadores</SelectItem>
                {indicadoresDisponiveis.map((i) => (
                  <SelectItem key={i} value={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Janela</label>
            <Select value={janela} onValueChange={setJanela}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Últimos 3 bimestres</SelectItem>
                <SelectItem value="6">Últimos 6 bimestres</SelectItem>
                <SelectItem value="12">Últimos 12 bimestres</SelectItem>
                <SelectItem value="todos">Todo o histórico</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Cards de resumo */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : resumoIndicadores.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          <Database className="mx-auto mb-2 h-8 w-8 opacity-40" />
          Nenhum KPI do SICONFI encontrado para os filtros atuais. Rode uma sincronização em{" "}
          <Link to="/prefeito/integracoes" className="underline">
            Integrações
          </Link>
          .
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {resumoIndicadores.map((r) => {
            const variacaoIcon =
              r.variacao == null ? Minus : r.variacao > 0 ? ArrowUp : r.variacao < 0 ? ArrowDown : Minus;
            const VarIcon = variacaoIcon;
            const varColor =
              r.variacao == null
                ? "text-muted-foreground"
                : r.variacao > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : r.variacao < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-muted-foreground";
            return (
              <Card key={r.indicador}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-2 text-sm font-medium">
                      {r.indicador}
                    </CardTitle>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {SECRETARIA_LABEL[r.secretaria] ?? r.secretaria}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">
                    {formatarValor(r.ultimoValor, r.unidade)}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{r.ultimoLabel}</span>
                    <span className={`flex items-center gap-1 ${varColor}`}>
                      <VarIcon className="h-3 w-3" />
                      {r.variacao == null
                        ? "—"
                        : `${r.variacao > 0 ? "+" : ""}${r.variacao.toFixed(1)}%`}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Gráfico de evolução */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução por bimestre</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-72 w-full" />
          ) : dadosGrafico.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Sem dados para exibir.
            </div>
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dadosGrafico} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="bimestre" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(v) => {
                      const n = Number(v);
                      if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
                      if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
                      return String(n);
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) => {
                      const ref = rowsFiltrados.find((r) => r.indicador === name);
                      return [formatarValor(value, ref?.unidade ?? null), name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {seriesGrafico.map((s, idx) => (
                    <Line
                      key={s}
                      type="monotone"
                      dataKey={s}
                      stroke={CORES[idx % CORES.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela detalhada */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhamento</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : rowsFiltrados.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Sem registros.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bimestre</TableHead>
                    <TableHead>Secretaria</TableHead>
                    <TableHead>Indicador</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...rowsFiltrados]
                    .sort((a, b) => b.referencia_data.localeCompare(a.referencia_data))
                    .slice(0, 200)
                    .map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">
                          {bimestreDe(r.referencia_data).label}
                        </TableCell>
                        <TableCell className="text-xs">
                          {SECRETARIA_LABEL[r.secretaria_slug] ?? r.secretaria_slug}
                        </TableCell>
                        <TableCell className="text-xs">{r.indicador}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatarValor(r.valor, r.unidade)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              r.status === "ok"
                                ? "secondary"
                                : r.status === "atencao"
                                  ? "outline"
                                  : "destructive"
                            }
                            className="text-xs"
                          >
                            {r.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              {rowsFiltrados.length > 200 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Exibindo as 200 linhas mais recentes ({rowsFiltrados.length} no total).
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
