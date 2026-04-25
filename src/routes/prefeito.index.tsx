import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { KPICard } from "@/components/KPICard";
import { HistoricoKPIs } from "@/components/prefeito/HistoricoKPIs";
import { BriefingSemanalCard } from "@/components/prefeito/BriefingSemanalCard";
import { Card } from "@/components/ui/card";
import {
  Heart,
  GraduationCap,
  Wallet,
  HardHat,
  Shield,
  HandHeart,
  Loader2,
  AlertTriangle,
  Calendar,
  Bell,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/prefeito/")({
  head: () => ({ meta: [{ title: "Dashboard — Prefeito — NovaeXis" }] }),
  component: PrefeitoDashboard,
});

const SECRETARIAS = [
  { slug: "saude", nome: "Saúde", icon: Heart },
  { slug: "educacao", nome: "Educação", icon: GraduationCap },
  { slug: "financas", nome: "Finanças", icon: Wallet },
  { slug: "infraestrutura", nome: "Infraestrutura", icon: HardHat },
  { slug: "seguranca", nome: "Segurança", icon: Shield },
  { slug: "assistencia_social", nome: "Assistência", icon: HandHeart },
];

interface KPI {
  secretaria_slug: string;
  indicador: string;
  valor: number;
  unidade: string | null;
  variacao_pct: number | null;
  status: "ok" | "atencao" | "critico";
  referencia_data: string;
}

interface Alerta {
  id: string;
  titulo: string;
  prazo: string | null;
  valor_estimado: number | null;
  status: string;
}

function saudacao(nome: string | null | undefined): string {
  const h = new Date().getHours();
  const periodo = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const primeiro = nome?.split(" ")[0] ?? "Prefeito(a)";
  return `${periodo}, ${primeiro}!`;
}

function dataExtenso(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function PrefeitoDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tenantNome, setTenantNome] = useState("");
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);

  const tenantId = profile?.tenant_id;

  useEffect(() => {
    if (!tenantId) return;
    void load(tenantId);

    // Realtime: KPIs do tenant
    const channel = supabase
      .channel(`kpis-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kpis", filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          const novo = payload.new as KPI | null;
          if (novo?.status === "critico") {
            toast.error(`Alerta crítico: ${novo.indicador}`, {
              description: `Valor atual: ${novo.valor}${novo.unidade ?? ""}`,
            });
          }
          void load(tenantId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tenantId]);

  async function load(tid: string) {
    setLoading(true);
    const [tenantRes, kpisRes, alertasRes] = await Promise.all([
      supabase.from("tenants").select("nome").eq("id", tid).maybeSingle(),
      supabase
        .from("kpis")
        .select("secretaria_slug, indicador, valor, unidade, variacao_pct, status, referencia_data")
        .eq("tenant_id", tid)
        .order("referencia_data", { ascending: false })
        .limit(500),
      supabase
        .from("alertas_prazos")
        .select("id, titulo, prazo, valor_estimado, status")
        .eq("tenant_id", tid)
        .in("status", ["disponivel", "pendente", "em_risco", "em_andamento"])
        .order("prazo", { ascending: true })
        .limit(8),
    ]);

    if (tenantRes.data) setTenantNome(tenantRes.data.nome);

    const latestBySec = new Map<string, KPI>();
    for (const k of (kpisRes.data ?? []) as KPI[]) {
      if (!latestBySec.has(k.secretaria_slug)) latestBySec.set(k.secretaria_slug, k);
    }
    setKpis(Array.from(latestBySec.values()));
    setAlertas((alertasRes.data ?? []) as Alerta[]);
    setLoading(false);
  }

  const kpiCriticos = useMemo(() => kpis.filter((k) => k.status === "critico").length, [kpis]);
  const prazosUrgentes = useMemo(
    () =>
      alertas.filter((a) => {
        if (!a.prazo) return false;
        const dias = Math.ceil((new Date(a.prazo).getTime() - Date.now()) / 86400000);
        return dias >= 0 && dias <= 15;
      }).length,
    [alertas],
  );

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pl-16 sm:px-6 md:pl-6 lg:py-8">
      {/* Header de boas-vindas */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {saudacao(profile?.nome)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Prefeitura de {tenantNome} · Estado do Pará · {dataExtenso()}
          </p>
        </div>
        <button
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border bg-card hover:bg-muted"
          aria-label="Notificações"
        >
          <Bell className="h-4 w-4" />
          {(kpiCriticos > 0 || prazosUrgentes > 0) && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {kpiCriticos + prazosUrgentes}
            </span>
          )}
        </button>
      </header>

      {/* Banner de alertas */}
      {(kpiCriticos > 0 || prazosUrgentes > 0) && (
        <div className="mb-6 flex flex-wrap gap-2">
          {kpiCriticos > 0 && (
            <div className="inline-flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-1.5 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">
                {kpiCriticos} indicador(es) crítico(s)
              </span>
            </div>
          )}
          {prazosUrgentes > 0 && (
            <div className="inline-flex items-center gap-2 rounded-md bg-warning/15 px-3 py-1.5 text-sm">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">
                {prazosUrgentes} recurso(s) com prazo em ≤ 15 dias
              </span>
            </div>
          )}
        </div>
      )}

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
                onClick={() => navigate({ to: "/prefeito/captacao" })}
              />
            );
          })}
        </div>
      </section>

      {/* Histórico */}
      {tenantId && (
        <section className="mb-8">
          <HistoricoKPIs tenantId={tenantId} secretarias={SECRETARIAS} />
        </section>
      )}

      {/* Briefing semanal IA */}
      {tenantId && (
        <section className="mb-8">
          <BriefingSemanalCard tenantId={tenantId} />
        </section>
      )}

      {/* Captação resumo */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Captação de recursos</h2>
          <button
            onClick={() => navigate({ to: "/prefeito/captacao" })}
            className="text-xs font-medium text-primary hover:underline"
          >
            Ver tudo →
          </button>
        </div>
        {alertas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum prazo ativo no momento.</p>
        ) : (
          <ul className="space-y-2">
            {alertas.slice(0, 4).map((a) => {
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
                      {dias > 0 ? `${dias} dias` : dias === 0 ? "Hoje" : "Vencido"}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
