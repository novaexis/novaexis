import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { KPICard } from "@/components/KPICard";
import { ChatIAGovernador } from "@/components/governador/ChatIAGovernador";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { ArrowLeft, Loader2 } from "lucide-react";

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

interface KPIRow {
  indicador: string;
  valor: number;
  unidade: string | null;
  variacao_pct: number | null;
  status: "ok" | "atencao" | "critico";
  referencia_data: string;
  fonte: string;
}

function SecretariaEstadualPage() {
  const { slug } = Route.useParams();
  const nome = SECRETARIAS_NOMES[slug] ?? slug.toUpperCase();

  return (
    <RoleGuard
      allowed={["governador", "superadmin"]}
      title={nome}
      subtitle="Visão setorial estadual"
    >
      <SecretariaContent slug={slug} nome={nome} />
    </RoleGuard>
  );
}

function SecretariaContent({ slug, nome }: { slug: string; nome: string }) {
  const [kpis, setKpis] = useState<KPIRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [indicadorSelecionado, setIndicadorSelecionado] = useState<string>("");

  useEffect(() => {
    void load();
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
    const { data } = await supabase
      .from("kpis")
      .select("indicador, valor, unidade, variacao_pct, status, referencia_data, fonte")
      .eq("tenant_id", tenantId)
      .eq("secretaria_slug", slug)
      .order("referencia_data", { ascending: false });
    const rows = (data ?? []) as KPIRow[];
    setKpis(rows);
    const primeiro = rows.find((r) => r.fonte === "seed-historico");
    if (primeiro) setIndicadorSelecionado(primeiro.indicador);
    setLoading(false);
  }

  const atuais = useMemo(() => kpis.filter((k) => k.fonte === "seed"), [kpis]);
  const indicadoresHistoricos = useMemo(
    () => Array.from(new Set(kpis.filter((k) => k.fonte === "seed-historico").map((k) => k.indicador))),
    [kpis],
  );
  const serieHistorica = useMemo(() => {
    return kpis
      .filter((k) => k.fonte === "seed-historico" && k.indicador === indicadorSelecionado)
      .map((k) => ({
        data: new Date(k.referencia_data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        valor: Number(k.valor.toFixed(2)),
      }))
      .reverse();
  }, [kpis, indicadorSelecionado]);

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
        {atuais.length} indicadores monitorados
      </p>

      {/* Cards de KPIs detalhados */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Indicadores atuais
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {atuais.map((k) => (
            <KPICard
              key={k.indicador}
              titulo={k.indicador}
              valor={k.unidade === "R$" && k.valor >= 1_000_000
                ? `${(k.valor / 1_000_000).toFixed(0)} mi`
                : Number.isInteger(k.valor)
                  ? k.valor.toLocaleString("pt-BR")
                  : k.valor.toFixed(1)}
              unidade={k.unidade ?? undefined}
              variacaoPct={k.variacao_pct}
              status={k.status}
            />
          ))}
        </div>
      </section>

      {/* Gráfico histórico */}
      {indicadoresHistoricos.length > 0 && (
        <section className="mb-6">
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Histórico (últimas 12 semanas)</h2>
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
            </div>
            <div className="h-64 w-full">
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
                  <Line
                    type="monotone"
                    dataKey="valor"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </section>
      )}

      {/* Chat IA contextualizado */}
      <section>
        <ChatIAGovernador secretariaSlug={slug} />
      </section>
    </div>
  );
}
