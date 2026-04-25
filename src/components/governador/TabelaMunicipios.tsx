import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, AlertTriangle, CheckCircle2, AlertCircle, Send } from "lucide-react";
import { ModalNovoComunicado } from "./ModalNovoComunicado";

interface KpiAderente {
  tenant_id: string;
  municipio: string;
  populacao: number | null;
  idhm: number | null;
  secretaria_slug: string | null;
  indicador: string | null;
  valor: number | null;
  unidade: string | null;
  status: "ok" | "atencao" | "critico" | null;
  variacao_pct: number | null;
}

interface MunicipioAgg {
  tenant_id: string;
  municipio: string;
  populacao: number | null;
  idhm: number | null;
  criticos: number;
  atencao: number;
  totalKpis: number;
  kpis: KpiAderente[];
}

export function TabelaMunicipios() {
  const [rows, setRows] = useState<KpiAderente[]>([]);
  const [demandasPorMun, setDemandasPorMun] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [drawerMun, setDrawerMun] = useState<MunicipioAgg | null>(null);
  const [openComunicado, setOpenComunicado] = useState(false);
  const [municipioComunicado, setMunicipioComunicado] = useState<string | undefined>();

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: kpisData }, { data: demData }] = await Promise.all([
      supabase
        .from("kpis_municipios_aderentes")
        .select("tenant_id, municipio, populacao, idhm, secretaria_slug, indicador, valor, unidade, status, variacao_pct"),
      supabase.from("demandas").select("tenant_id").eq("status", "aberta"),
    ]);
    setRows((kpisData ?? []) as KpiAderente[]);
    const counts: Record<string, number> = {};
    for (const d of demData ?? []) counts[d.tenant_id] = (counts[d.tenant_id] ?? 0) + 1;
    setDemandasPorMun(counts);
    setLoading(false);
  }

  const agrupados = useMemo<MunicipioAgg[]>(() => {
    const map = new Map<string, MunicipioAgg>();
    for (const r of rows) {
      if (!map.has(r.tenant_id)) {
        map.set(r.tenant_id, {
          tenant_id: r.tenant_id,
          municipio: r.municipio,
          populacao: r.populacao,
          idhm: r.idhm,
          criticos: 0,
          atencao: 0,
          totalKpis: 0,
          kpis: [],
        });
      }
      const m = map.get(r.tenant_id)!;
      if (r.indicador) {
        m.kpis.push(r);
        m.totalKpis++;
        if (r.status === "critico") m.criticos++;
        else if (r.status === "atencao") m.atencao++;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.criticos - a.criticos);
  }, [rows]);

  const filtrados = useMemo(
    () =>
      agrupados.filter((m) =>
        busca ? m.municipio.toLowerCase().includes(busca.toLowerCase()) : true,
      ),
    [agrupados, busca],
  );

  function situacao(criticos: number) {
    if (criticos >= 2)
      return { label: "Crítico", icon: AlertTriangle, cls: "text-destructive" };
    if (criticos === 1)
      return { label: "Atenção", icon: AlertCircle, cls: "text-warning-foreground" };
    return { label: "OK", icon: CheckCircle2, cls: "text-success" };
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">
              Municípios Aderentes · {agrupados.length}
            </h2>
            <p className="text-xs text-muted-foreground">
              Situação operacional dos municípios no sistema
            </p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-56 pl-7"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4">Município</th>
                  <th className="py-2 pr-4">População</th>
                  <th className="py-2 pr-4">KPIs Críticos</th>
                  <th className="py-2 pr-4">Demandas Abertas</th>
                  <th className="py-2 pr-4">Situação</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((m) => {
                  const s = situacao(m.criticos);
                  const Icon = s.icon;
                  return (
                    <tr
                      key={m.tenant_id}
                      onClick={() => setDrawerMun(m)}
                      className="cursor-pointer border-b transition hover:bg-muted/50"
                    >
                      <td className="py-3 pr-4 font-medium">{m.municipio}</td>
                      <td className="py-3 pr-4 tabular-nums text-muted-foreground">
                        {m.populacao ? m.populacao.toLocaleString("pt-BR") : "—"}
                      </td>
                      <td className="py-3 pr-4">
                        {m.criticos > 0 ? (
                          <Badge variant="destructive">{m.criticos} crítico(s)</Badge>
                        ) : (
                          <span className="text-muted-foreground">0 críticos</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-muted-foreground">
                        {demandasPorMun[m.tenant_id] ?? 0}
                      </td>
                      <td className={`py-3 pr-4 ${s.cls}`}>
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                          <Icon className="h-3.5 w-3.5" />
                          {s.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Sheet open={drawerMun !== null} onOpenChange={(v) => !v && setDrawerMun(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{drawerMun?.municipio}</SheetTitle>
          </SheetHeader>
          {drawerMun && (
            <div className="mt-4 space-y-4">
              <div className="flex gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">População</p>
                  <p className="font-semibold tabular-nums">
                    {drawerMun.populacao?.toLocaleString("pt-BR") ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">IDHM</p>
                  <p className="font-semibold tabular-nums">
                    {drawerMun.idhm?.toFixed(3) ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Demandas abertas</p>
                  <p className="font-semibold tabular-nums">
                    {demandasPorMun[drawerMun.tenant_id] ?? 0}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold">Indicadores por secretaria</h3>
                <div className="space-y-2">
                  {drawerMun.kpis.map((k, i) => (
                    <div
                      key={`${k.indicador}-${i}`}
                      className={`rounded-md border p-3 ${
                        k.status === "critico"
                          ? "border-destructive/30 bg-destructive/5"
                          : k.status === "atencao"
                            ? "border-warning/30 bg-warning/5"
                            : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs uppercase text-muted-foreground">
                          {k.secretaria_slug}
                        </p>
                        {k.variacao_pct !== null && (
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {k.variacao_pct > 0 ? "+" : ""}
                            {k.variacao_pct.toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium">{k.indicador}</p>
                      <p className="mt-0.5 text-base font-semibold tabular-nums">
                        {k.valor !== null ? Number(k.valor).toFixed(1) : "—"} {k.unidade ?? ""}
                      </p>
                    </div>
                  ))}
                  {drawerMun.kpis.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sem KPIs cadastrados.</p>
                  )}
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => {
                  setMunicipioComunicado(drawerMun.tenant_id);
                  setOpenComunicado(true);
                }}
              >
                <Send className="mr-2 h-4 w-4" />
                Enviar comunicado a este município
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ModalNovoComunicado
        open={openComunicado}
        onOpenChange={setOpenComunicado}
        municipioPreSelecionado={municipioComunicado}
      />
    </div>
  );
}
