import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/governador")({
  head: () => ({ meta: [{ title: "Painel do Governador — NovaeXis" }] }),
  component: () => (
    <RoleGuard
      allowed={["governador", "superadmin"]}
      title="Painel do Governador do Pará"
      subtitle="Visão estadual integrada"
    >
      <GovernadorDashboard />
    </RoleGuard>
  ),
});

interface MunicipioRow {
  id: string;
  nome: string;
  populacao: number | null;
  idhm: number | null;
  bioma: string | null;
}

function GovernadorDashboard() {
  const [municipios, setMunicipios] = useState<MunicipioRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("tenants")
      .select("id, nome, populacao, idhm, bioma")
      .eq("tipo", "municipio")
      .eq("ativo", true)
      .order("populacao", { ascending: false });
    setMunicipios((data ?? []) as MunicipioRow[]);
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Estado do Pará</h1>
        <p className="text-sm text-muted-foreground">
          {municipios.length} município(s) aderente(s) à plataforma
        </p>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 text-base font-semibold">Municípios aderentes</h2>
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">Município</th>
                  <th className="px-3 py-2 text-right">População</th>
                  <th className="px-3 py-2 text-right">IDHM</th>
                  <th className="px-3 py-2">Bioma</th>
                </tr>
              </thead>
              <tbody>
                {municipios.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="px-3 py-2.5 font-medium">{m.nome}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {m.populacao?.toLocaleString("pt-BR") ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {m.idhm?.toFixed(3) ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 capitalize">{m.bioma ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-6 rounded-lg border bg-card p-4 text-xs text-muted-foreground">
        Bloco 7 trará o mapa interativo do Pará com 144 municípios coloridos por
        indicador, ranking, drill-down por município e gestão de repasses estaduais.
      </div>
    </div>
  );
}
