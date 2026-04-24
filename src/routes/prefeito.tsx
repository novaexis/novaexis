import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { KPICard } from "@/components/KPICard";
import { StatusBadge } from "@/components/StatusBadge";
import { Card } from "@/components/ui/card";
import {
  Heart,
  GraduationCap,
  Wallet,
  Wrench,
  Shield,
  Users,
  Loader2,
  AlertTriangle,
  Calendar,
} from "lucide-react";

export const Route = createFileRoute("/prefeito")({
  head: () => ({ meta: [{ title: "Painel do Prefeito — NovaeXis" }] }),
  component: () => (
    <RoleGuard
      allowed={["prefeito", "superadmin"]}
      title="Painel do Prefeito"
      subtitle="Visão executiva 360°"
    >
      <PrefeitoDashboard />
    </RoleGuard>
  ),
});

const SECRETARIAS = [
  { slug: "saude", nome: "Saúde", icon: Heart },
  { slug: "educacao", nome: "Educação", icon: GraduationCap },
  { slug: "financas", nome: "Finanças", icon: Wallet },
  { slug: "infraestrutura", nome: "Infraestrutura", icon: Wrench },
  { slug: "seguranca", nome: "Segurança", icon: Shield },
  { slug: "assistencia_social", nome: "Assistência", icon: Users },
];

interface KPI {
  secretaria_slug: string;
  indicador: string;
  valor: number;
  unidade: string | null;
  variacao_pct: number | null;
  status: "ok" | "atencao" | "critico";
}

interface Alerta {
  id: string;
  titulo: string;
  prazo: string | null;
  valor_estimado: number | null;
  status: string;
}

interface DemandaResumo {
  status: string;
  count: number;
}

function PrefeitoDashboard() {
  const { profile } = useAuth();
  const [tenantNome, setTenantNome] = useState<string>("");
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [demandas, setDemandas] = useState<DemandaResumo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.tenant_id) return;
    void load(profile.tenant_id);
  }, [profile?.tenant_id]);

  async function load(tenantId: string) {
    setLoading(true);
    const [tenantRes, kpisRes, alertasRes, demandasRes] = await Promise.all([
      supabase.from("tenants").select("nome, populacao, idhm").eq("id", tenantId).maybeSingle(),
      supabase
        .from("kpis")
        .select("secretaria_slug, indicador, valor, unidade, variacao_pct, status, referencia_data")
        .eq("tenant_id", tenantId)
        .order("referencia_data", { ascending: false })
        .limit(200),
      supabase
        .from("alertas_prazos")
        .select("id, titulo, prazo, valor_estimado, status")
        .eq("tenant_id", tenantId)
        .eq("status", "disponivel")
        .order("prazo", { ascending: true })
        .limit(5),
      supabase
        .from("demandas")
        .select("status")
        .eq("tenant_id", tenantId)
        .limit(1000),
    ]);

    if (tenantRes.data) setTenantNome(tenantRes.data.nome);

    // pegar 1 KPI mais recente por secretaria
    const latestBySec = new Map<string, KPI>();
    for (const k of (kpisRes.data ?? []) as KPI[]) {
      if (!latestBySec.has(k.secretaria_slug)) latestBySec.set(k.secretaria_slug, k);
    }
    setKpis(Array.from(latestBySec.values()));

    setAlertas((alertasRes.data ?? []) as Alerta[]);

    const counts = new Map<string, number>();
    for (const d of demandasRes.data ?? []) {
      counts.set(d.status, (counts.get(d.status) ?? 0) + 1);
    }
    setDemandas(Array.from(counts.entries()).map(([status, count]) => ({ status, count })));

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const kpiCriticos = kpis.filter((k) => k.status === "critico").length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      {/* Header de boas-vindas */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Município</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{tenantNome}</h1>
        </div>
        <div className="flex gap-3 text-sm">
          {kpiCriticos > 0 && (
            <div className="inline-flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-1.5 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">{kpiCriticos} indicador(es) crítico(s)</span>
            </div>
          )}
          {alertas.length > 0 && (
            <div className="inline-flex items-center gap-2 rounded-md bg-warning/10 px-3 py-1.5 text-warning-foreground">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">{alertas.length} prazo(s) ativo(s)</span>
            </div>
          )}
        </div>
      </div>

      {/* KPIs por secretaria */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Indicadores por Secretaria
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SECRETARIAS.map((sec) => {
            const k = kpis.find((kk) => kk.secretaria_slug === sec.slug);
            const Icon = sec.icon;
            return (
              <KPICard
                key={sec.slug}
                titulo={`${sec.nome} — ${k?.indicador ?? "Sem dados"}`}
                valor={k ? Number(k.valor).toLocaleString("pt-BR") : "—"}
                unidade={k?.unidade ?? undefined}
                variacaoPct={k?.variacao_pct ?? null}
                status={k?.status ?? "ok"}
                icon={<Icon className="h-5 w-5" />}
              />
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Demandas */}
        <Card className="p-5 lg:col-span-1">
          <h2 className="mb-4 text-base font-semibold">Demandas do cidadão</h2>
          {demandas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma demanda registrada.</p>
          ) : (
            <ul className="space-y-2.5">
              {demandas.map((d) => (
                <li
                  key={d.status}
                  className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2"
                >
                  <StatusBadge status={d.status} />
                  <span className="font-mono text-lg font-semibold tabular-nums">
                    {d.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Captação de recursos */}
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Captação de recursos — prazos</h2>
            <span className="text-xs text-muted-foreground">{alertas.length} ativos</span>
          </div>
          {alertas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum prazo ativo no momento.</p>
          ) : (
            <ul className="space-y-2">
              {alertas.map((a) => {
                const dias = a.prazo
                  ? Math.ceil((new Date(a.prazo).getTime() - Date.now()) / 86400000)
                  : null;
                const urgente = dias != null && dias <= 15;
                return (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.titulo}</p>
                      {a.valor_estimado != null && (
                        <p className="font-mono text-xs text-muted-foreground">
                          R$ {Number(a.valor_estimado).toLocaleString("pt-BR")}
                        </p>
                      )}
                    </div>
                    {dias != null && (
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                          urgente
                            ? "bg-destructive/15 text-destructive"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {dias > 0 ? `${dias} dias` : "Vencido"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-8 rounded-lg border bg-card p-5 text-sm text-muted-foreground">
        <strong className="text-foreground">Bloco 1 concluído.</strong> Próximos blocos
        adicionarão: app do cidadão (PWA), painéis dos secretários, IA estratégica, mapa
        municipal, Social Intelligence e benchmark.
      </div>
    </div>
  );
}
