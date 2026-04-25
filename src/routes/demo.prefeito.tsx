import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, TrendingUp, Users, Brain } from "lucide-react";

export const Route = createFileRoute("/demo/prefeito")({
  head: () => ({
    meta: [
      { title: "Demo: Painel do Prefeito — NovaeXis" },
      {
        name: "description",
        content: "Visão executiva 360° com KPIs, demandas, alertas de captação e briefing IA.",
      },
    ],
  }),
  component: DemoPrefeitoPage,
});

interface Snapshot {
  tenant: { nome: string; uf: string; populacao: number | null };
  kpis: Array<{ id: string; indicador: string; valor: number; unidade: string | null; status: string }>;
  demandas: Array<{ id: string; titulo: string; status: string; prioridade: string; secretaria_slug: string }>;
  alertas: Array<{ id: string; titulo: string; valor_estimado: number | null; prazo: string | null }>;
  briefing: { conteudo_markdown: string; semana_referencia: string } | null;
}

function DemoPrefeitoPage() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL ?? ""}/functions/v1/demo-snapshot?tipo=prefeito`;
        const r = await fetch(url, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "" },
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error ?? "Falha ao carregar dados da demo");
        setData(j);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao carregar demo");
      }
    })();
  }, []);

  if (erro) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Card className="border-amber-500/40 bg-amber-50/40 p-6 text-sm dark:bg-amber-950/20">
          <p className="font-semibold">Não foi possível carregar a demo</p>
          <p className="mt-1 text-muted-foreground">{erro}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            Dica: rode o seed em <code>/admin → Visão geral → Executar seed</code>.
          </p>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Município demonstração
        </p>
        <h1 className="mt-1 text-2xl font-bold">{data.tenant.nome} — {data.tenant.uf}</h1>
        {data.tenant.populacao && (
          <p className="text-sm text-muted-foreground">
            População: {data.tenant.populacao.toLocaleString("pt-BR")} hab.
          </p>
        )}
      </div>

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="h-4 w-4 text-primary" /> Indicadores
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.kpis.slice(0, 8).map((k) => (
            <Card key={k.id} className="p-4">
              <p className="text-xs text-muted-foreground">{k.indicador}</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                {Number(k.valor).toLocaleString("pt-BR")}
                {k.unidade && <span className="ml-1 text-sm text-muted-foreground">{k.unidade}</span>}
              </p>
              <Badge
                variant="outline"
                className={
                  k.status === "ok"
                    ? "mt-2 border-emerald-500/40 text-emerald-600"
                    : k.status === "alerta"
                      ? "mt-2 border-amber-500/40 text-amber-600"
                      : "mt-2 border-red-500/40 text-red-600"
                }
              >
                {k.status}
              </Badge>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-primary" /> Últimas demandas
          </h2>
          <ul className="space-y-2">
            {data.demandas.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{d.titulo}</p>
                  <p className="text-xs text-muted-foreground">{d.secretaria_slug} · {d.prioridade}</p>
                </div>
                <Badge variant="outline">{d.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Captação de recursos
          </h2>
          <ul className="space-y-2">
            {data.alertas.map((a) => (
              <li key={a.id} className="rounded-md border p-2.5 text-sm">
                <p className="font-medium">{a.titulo}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.valor_estimado &&
                    `R$ ${Number(a.valor_estimado).toLocaleString("pt-BR")} · `}
                  Prazo: {a.prazo ?? "—"}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {data.briefing && (
        <Card className="mt-6 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Brain className="h-4 w-4 text-primary" /> Briefing semanal IA
          </h2>
          <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground">
            {data.briefing.conteudo_markdown.slice(0, 600)}…
          </pre>
        </Card>
      )}
    </div>
  );
}
