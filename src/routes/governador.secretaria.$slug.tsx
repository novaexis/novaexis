import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { KPICard } from "@/components/KPICard";
import { ChatIAGovernador } from "@/components/governador/ChatIAGovernador";
import { RepasesEstaduais, type RepasseItem } from "@/components/governador/RepasesEstaduais";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { ArrowLeft, Loader2, Download } from "lucide-react";

export const Route = createFileRoute("/governador/secretaria/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.toUpperCase()} — Painel do Governador` },
      { name: "description", content: `Indicadores estratégicos da secretaria estadual ${params.slug}.` },
    ],
  }),
  component: SecretariaEstadualPage,
});

const SECRETARIAS_NOMES: Record<string, string> = {
  sespa:   "SESPA — Secretaria Estadual de Saúde",
  seduc:   "SEDUC — Secretaria Estadual de Educação",
  sefa:    "SEFA — Secretaria de Estado da Fazenda",
  segup:   "SEGUP — Secretaria de Segurança Pública",
  seinfra: "SEINFRA — Secretaria de Infraestrutura",
  semas:   "SEMAS — Secretaria de Assistência Social",
};

// Filtro de fontes de repasses por secretaria
const FONTES_POR_SECRETARIA: Record<string, RegExp> = {
  sespa: /Saúde|SUS|Ministério da Saúde/i,
  seduc: /FNDE|MEC|FUNDEB/i,
  sefa: /FPE|Fazenda|ICMS/i,
  segup: /Segurança|SENASP/i,
  seinfra: /Cidades|MDR|PAC|Infraestrutura/i,
  semas: /MDS|SUAS|IGD|Assistência/i,
};

interface KPIRow {
  indicador: string;
  valor: number;
  unidade: string | null;
  variacao_pct: number | null;
  status: "ok" | "atencao" | "critico";
  referencia_data: string;
  fonte: string;
  meta?: number | null;
}

function SecretariaEstadualPage() {
  const { slug } = Route.useParams();
  const nome = SECRETARIAS_NOMES[slug] ?? slug.toUpperCase();

  return (
    <RoleGuard allowed={["governador", "superadmin"]} title={nome} subtitle="Visão setorial estadual">
      <SecretariaContent slug={slug} nome={nome} />
    </RoleGuard>
  );
}

function SecretariaContent({ slug, nome }: { slug: string; nome: string }) {
  const [kpis, setKpis] = useState<KPIRow[]>([]);
  const [repasses, setRepasses] = useState<RepasseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [indicadorSelecionado, setIndicadorSelecionado] = useState<string>("");

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function load() {
    setLoading(true);
    const { data: tenants } = await supabase
      .from("tenants")
      .select("id")
      .eq("tipo", "estado")
      .limit(1);
    const tenantId = tenants?.[0]?.id;
    if (!tenantId) {
      setLoading(false);
      return;
    }

    const [{ data: kpisData }, { data: repassesData }] = await Promise.all([
      supabase
        .from("kpis")
        .select("indicador, valor, unidade, variacao_pct, status, referencia_data, fonte, meta")
        .eq("tenant_id", tenantId)
        .eq("secretaria_slug", slug)
        .order("referencia_data", { ascending: false }),
      supabase
        .from("repasses_estaduais")
        .select("id, fonte, descricao, valor, prazo, status, requisito_pendente, progresso_pct")
        .eq("tenant_id", tenantId),
    ]);

    const rows = (kpisData ?? []) as KPIRow[];
    setKpis(rows);
    const filtroFonte = FONTES_POR_SECRETARIA[slug];
    const repFiltrados = (repassesData ?? []).filter((r) =>
      filtroFonte ? filtroFonte.test(r.fonte) : true,
    );
    setRepasses(repFiltrados as RepasseItem[]);

    const primeiro = rows.find((r) => r.fonte === "seed-historico") ?? rows[0];
    if (primeiro) setIndicadorSelecionado(primeiro.indicador);
    setLoading(false);
  }

  const atuais = useMemo(() => {
    const seed = kpis.filter((k) => k.fonte === "seed");
    if (seed.length > 0) return seed;
    // fallback: pega o mais recente por indicador
    const map = new Map<string, KPIRow>();
    for (const k of kpis) if (!map.has(k.indicador)) map.set(k.indicador, k);
    return Array.from(map.values());
  }, [kpis]);

  const indicadoresHistoricos = useMemo(
    () => Array.from(new Set(kpis.map((k) => k.indicador))),
    [kpis],
  );

  const serieHistorica = useMemo(() => {
    return kpis
      .filter((k) => k.indicador === indicadorSelecionado)
      .map((k) => ({
        data: new Date(k.referencia_data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        valor: Number(Number(k.valor).toFixed(2)),
        meta: k.meta ?? null,
      }))
      .reverse();
  }, [kpis, indicadorSelecionado]);

  const metaIndicador = useMemo(() => {
    const k = kpis.find((x) => x.indicador === indicadorSelecionado && x.meta != null);
    return k?.meta ?? null;
  }, [kpis, indicadorSelecionado]);

  function exportarCSV() {
    const linhas = [["Data", "Valor", "Meta"]];
    for (const r of serieHistorica) linhas.push([r.data, String(r.valor), r.meta != null ? String(r.meta) : ""]);
    const csv = linhas.map((l) => l.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slug}-${indicadorSelecionado.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Link to="/governador">
        <Button variant="ghost" size="sm" className="mb-3 -ml-2">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Voltar ao painel
        </Button>
      </Link>

      <h1 className="mb-1 text-2xl font-bold tracking-tight">{nome}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {atuais.length} indicadores monitorados · {repasses.length} repasse(s) setorial(is)
      </p>

      <Tabs defaultValue="visao" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="visao">Visão Geral</TabsTrigger>
          <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
          <TabsTrigger value="repasses">Repasses</TabsTrigger>
          <TabsTrigger value="ia">Assessoria IA</TabsTrigger>
        </TabsList>

        <TabsContent value="visao">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {atuais.map((k) => (
              <KPICard
                key={k.indicador}
                titulo={k.indicador}
                valor={
                  k.unidade === "R$" && k.valor >= 1_000_000
                    ? `${(k.valor / 1_000_000).toFixed(0)} mi`
                    : Number.isInteger(k.valor)
                      ? k.valor.toLocaleString("pt-BR")
                      : Number(k.valor).toFixed(1)
                }
                unidade={k.unidade ?? undefined}
                variacaoPct={k.variacao_pct}
                status={k.status}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="indicadores">
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Histórico</h2>
              <div className="flex flex-wrap gap-2">
                <Select value={indicadorSelecionado} onValueChange={setIndicadorSelecionado}>
                  <SelectTrigger className="w-[280px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {indicadoresHistoricos.map((ind) => (
                      <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={exportarCSV}>
                  <Download className="mr-1.5 h-4 w-4" />
                  CSV
                </Button>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serieHistorica}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                  <XAxis dataKey="data" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  {metaIndicador != null && (
                    <ReferenceLine y={metaIndicador} stroke="hsl(var(--success))" strokeDasharray="4 4" label="Meta" />
                  )}
                  <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="repasses">
          {repasses.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-muted-foreground">Nenhum repasse setorial encontrado para esta secretaria.</p>
            </Card>
          ) : (
            <RepasesEstaduais repasses={repasses} />
          )}
        </TabsContent>

        <TabsContent value="ia">
          <ChatIAGovernador secretariaSlug={slug} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
