import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2 } from "lucide-react";

export const Route = createFileRoute("/demo/governador")({
  head: () => ({
    meta: [
      { title: "Demo: Painel do Governador — NovaeXis" },
      {
        name: "description",
        content: "Visão estadual com municípios aderentes e indicadores agregados.",
      },
    ],
  }),
  component: DemoGovernadorPage,
});

interface Snap {
  municipios: Array<{ id: string; nome: string; uf: string; populacao: number | null }>;
  kpis: Array<{ tenant_id: string; indicador: string; valor: number; status: string }>;
}

function DemoGovernadorPage() {
  const [data, setData] = useState<Snap | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL ?? ""}/functions/v1/demo-snapshot?tipo=governador`;
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
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Card className="border-amber-500/40 bg-amber-50/40 p-6 text-sm dark:bg-amber-950/20">
          <p className="font-semibold text-amber-800">Painel do Governador indisponível</p>
          <p className="mt-1 text-muted-foreground">{erro}</p>
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
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Visão estadual</p>
        <h1 className="mt-1 text-2xl font-bold">Pará — {data.municipios.length} municípios aderentes</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.municipios.map((m) => {
          const kpisM = data.kpis.filter((k) => k.tenant_id === m.id);
          const alertas = kpisM.filter((k) => k.status !== "ok").length;
          return (
            <Card key={m.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold">{m.nome}</h2>
                  <p className="text-xs text-muted-foreground">
                    {m.populacao ? `${m.populacao.toLocaleString("pt-BR")} hab.` : "—"}
                  </p>
                </div>
                <Building2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <Badge variant="outline">{kpisM.length} KPIs</Badge>
                {alertas > 0 ? (
                  <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-700">
                    {alertas} alertas
                  </Badge>
                ) : (
                  <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700">
                    Saudável
                  </Badge>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
