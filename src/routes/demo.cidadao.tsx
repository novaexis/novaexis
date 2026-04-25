import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Heart, GraduationCap, MessageSquareWarning } from "lucide-react";

export const Route = createFileRoute("/demo/cidadao")({
  head: () => ({
    meta: [
      { title: "Demo: App do Cidadão — NovaeXis" },
      {
        name: "description",
        content: "Veja como o cidadão acessa serviços públicos, agenda consultas e abre demandas.",
      },
    ],
  }),
  component: DemoCidadaoPage,
});

interface Snap {
  tenant: { nome: string };
  secretarias: Array<{ slug: string; nome: string }>;
}

function DemoCidadaoPage() {
  const [data, setData] = useState<Snap | null>(null);

  useEffect(() => {
    void (async () => {
      const url = `${import.meta.env.VITE_SUPABASE_URL ?? ""}/functions/v1/demo-snapshot?tipo=cidadao`;
      const r = await fetch(url, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "" },
      });
      if (r.ok) setData(await r.json());
    })();
  }, []);

  if (!data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-6 text-white">
        <p className="text-xs opacity-80">Bem-vindo(a)</p>
        <p className="mt-1 text-lg font-semibold">Maria Silva</p>
        <p className="text-sm opacity-90">Cidadã de {data.tenant.nome}</p>
      </div>

      <h2 className="mb-3 text-sm font-semibold">Serviços</h2>
      <div className="grid grid-cols-2 gap-3">
        <ServiceTile icon={Heart} cor="rose" titulo="Agendar saúde" desc="UBS e especialidades" />
        <ServiceTile icon={GraduationCap} cor="blue" titulo="Matrícula" desc="Solicitar vaga escolar" />
        <ServiceTile icon={MessageSquareWarning} cor="amber" titulo="Ouvidoria" desc="Reclamar ou sugerir" />
      </div>

      <h2 className="mb-3 mt-6 text-sm font-semibold">Minhas demandas</h2>
      <Card className="p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Buraco na rua Boa Vista</p>
            <p className="text-xs text-muted-foreground">Protocolo #2026-0142 · Infraestrutura</p>
          </div>
          <Badge className="bg-amber-500/20 text-amber-700">Em análise</Badge>
        </div>
      </Card>
      <Card className="mt-2 p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Consulta cardiologista</p>
            <p className="text-xs text-muted-foreground">UBS Central · 12/05</p>
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-700">Agendado</Badge>
        </div>
      </Card>
    </div>
  );
}

function ServiceTile({
  icon: Icon,
  cor,
  titulo,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  cor: string;
  titulo: string;
  desc: string;
}) {
  return (
    <Card className="p-4">
      <div
        className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-${cor}-500/10`}
      >
        <Icon className={`h-5 w-5 text-${cor}-500`} />
      </div>
      <p className="text-sm font-semibold">{titulo}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
    </Card>
  );
}
