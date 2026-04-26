import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { KPICard } from "@/components/KPICard";
import { ChatIAGovernador } from "@/components/governador/ChatIAGovernador";
import { RepasesEstaduais, type RepasseItem } from "@/components/governador/RepasesEstaduais";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Heart, GraduationCap, Wallet, ShieldAlert, HardHat, HandHeart, Megaphone, Building2, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/governador")({
  head: () => ({
    meta: [
      { title: "Painel do Governador — NovaeXis" },
      { name: "description", content: "Visão estratégica do Estado do Pará via secretarias estaduais." },
    ],
  }),
  component: () => (
    <RoleGuard
      allowed={["governador", "superadmin"]}
      title="Estado do Pará"
      subtitle="Painel do Governador"
    >
      <GovernadorDashboard />
    </RoleGuard>
  ),
});

interface KPIRow {
  secretaria_slug: string;
  indicador: string;
  valor: number;
  unidade: string | null;
  variacao_pct: number | null;
  status: "ok" | "atencao" | "critico";
  referencia_data: string;
}

const SECRETARIAS_META: Record<string, { nome: string; icon: typeof Heart; indicadorPrincipal: string }> = {
  sespa:   { nome: "SESPA — Saúde",          icon: Heart,        indicadorPrincipal: "Cobertura atenção básica" },
  seduc:   { nome: "SEDUC — Educação",       icon: GraduationCap, indicadorPrincipal: "Taxa matrícula ensino médio" },
  sefa:    { nome: "SEFA — Fazenda",         icon: Wallet,       indicadorPrincipal: "Execução orçamentária global" },
  segup:   { nome: "SEGUP — Segurança",      icon: ShieldAlert,  indicadorPrincipal: "Taxa de homicídios por 100k hab" },
  seinfra: { nome: "SEINFRA — Infraestrutura", icon: HardHat,    indicadorPrincipal: "Execução média de obras" },
  semas:   { nome: "SEMAS — Assist. Social", icon: HandHeart,    indicadorPrincipal: "Famílias no CadÚnico" },
};

function formatValor(valor: number, unidade: string | null): string {
  if (unidade === "R$") {
    if (valor >= 1_000_000_000) return `${(valor / 1_000_000_000).toFixed(2)} bi`;
    if (valor >= 1_000_000) return `${(valor / 1_000_000).toFixed(0)} mi`;
    return valor.toLocaleString("pt-BR");
  }
  if (unidade === "famílias" || unidade === "pessoas" || unidade === "leitos" || unidade === "ocorrências") {
    return valor.toLocaleString("pt-BR");
  }
  if (Number.isInteger(valor)) return valor.toString();
  return valor.toFixed(1);
}

interface ComunicadoBreve {
  id: string;
  titulo: string;
  enviado_at: string;
  tenants_destinatarios: string[];
  lido_por: Record<string, string>;
}

function GovernadorDashboard() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<KPIRow[]>([]);
  const [repasses, setRepasses] = useState<RepasseItem[]>([]);
  const [comunicados, setComunicados] = useState<ComunicadoBreve[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

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

    const [{ data: kpisData }, { data: repassesData }, { data: comunicadosData }] = await Promise.all([
      supabase
        .from("kpis")
        .select("secretaria_slug, indicador, valor, unidade, variacao_pct, status, referencia_data")
        .eq("tenant_id", tenantId)
        .eq("fonte", "seed")
        .order("referencia_data", { ascending: false }),
      supabase
        .from("repasses_estaduais")
        .select("id, fonte, descricao, valor, prazo, status, requisito_pendente, progresso_pct")
        .eq("tenant_id", tenantId)
        .order("prazo", { ascending: true }),
      supabase
        .from("comunicados_governador")
        .select("id, titulo, enviado_at, tenants_destinatarios, lido_por")
        .eq("tenant_estadual_id", tenantId)
        .order("enviado_at", { ascending: false })
        .limit(2),
    ]);

    setKpis((kpisData ?? []) as KPIRow[]);
    setRepasses((repassesData ?? []) as RepasseItem[]);
    setComunicados((comunicadosData ?? []) as ComunicadoBreve[]);
    setLoading(false);
  }

  const kpisPrincipais = useMemo(() => {
    return Object.entries(SECRETARIAS_META).map(([slug, meta]) => {
      const kpi = kpis.find((k) => k.secretaria_slug === slug && k.indicador === meta.indicadorPrincipal);
      return { slug, meta, kpi };
    });
  }, [kpis]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visão Estratégica do Estado</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            6 secretarias estaduais — clique em um cartão para ver o detalhamento
          </p>
        </div>
        <nav className="flex flex-wrap gap-2">
          <Link to="/governador/comunicados">
            <button className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm font-medium transition hover:bg-muted">
              <Megaphone className="h-3.5 w-3.5" />
              Comunicados
            </button>
          </Link>
          <Link to="/governador/municipios">
            <button className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm font-medium transition hover:bg-muted">
              <Building2 className="h-3.5 w-3.5" />
              Situação dos municípios
            </button>
          </Link>
        </nav>
      </div>

      {/* Linha 1: KPIs das secretarias */}
      <section className="mb-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kpisPrincipais.map(({ slug, meta, kpi }) => {
            const Icon = meta.icon;
            return (
              <KPICard
                key={slug}
                titulo={meta.nome}
                valor={kpi ? formatValor(kpi.valor, kpi.unidade) : "—"}
                unidade={kpi?.unidade ?? undefined}
                variacaoPct={kpi?.variacao_pct ?? null}
                status={kpi?.status ?? "ok"}
                icon={<Icon className="h-5 w-5" />}
                onClick={() =>
                  navigate({
                    to: "/governador/secretaria/$slug",
                    params: { slug },
                  })
                }
              />
            );
          })}
        </div>
      </section>

      {/* Linha 2: Chat IA + Repasses */}
      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ChatIAGovernador />
        </div>
        <div className="lg:col-span-2">
          <RepasesEstaduais repasses={repasses} />
        </div>
      </section>

      {/* Linha 3: Comunicados recentes */}
      {comunicados.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Comunicados recentes</h2>
            <Link to="/governador/comunicados" className="text-xs text-primary hover:underline">
              Ver todos →
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {comunicados.map((c) => {
              const lidos = Object.keys(c.lido_por ?? {}).length;
              const total = c.tenants_destinatarios?.length ?? 0;
              return (
                <Card key={c.id} className="p-4">
                  <div className="flex items-start gap-2">
                    <Megaphone className="mt-0.5 h-4 w-4 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{c.titulo}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Enviado em{" "}
                        {new Date(c.enviado_at).toLocaleDateString("pt-BR")} ·{" "}
                        Lido por {lidos} de {total}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
