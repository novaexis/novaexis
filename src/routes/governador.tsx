import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { KPICard } from "@/components/KPICard";
import { ChatIAGovernador } from "@/components/governador/ChatIAGovernador";
import { RepasesEstaduais, type RepasseItem } from "@/components/governador/RepasesEstaduais";
import { Card } from "@/components/ui/card";
import { Loader2, Heart, GraduationCap, Wallet, ShieldAlert, HardHat, HandHeart, Megaphone, Building2 } from "lucide-react";

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

function GovernadorDashboard() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<KPIRow[]>([]);
  const [repasses, setRepasses] = useState<RepasseItem[]>([]);
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

    const [{ data: kpisData }, { data: repassesData }] = await Promise.all([
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
    ]);

    setKpis((kpisData ?? []) as KPIRow[]);
    setRepasses((repassesData ?? []) as RepasseItem[]);
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Visão Estratégica do Estado</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          6 secretarias estaduais — clique em um cartão para ver o detalhamento
        </p>
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
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ChatIAGovernador />
        </div>
        <div className="lg:col-span-2">
          <RepasesEstaduais repasses={repasses} />
        </div>
      </section>
    </div>
  );
}
