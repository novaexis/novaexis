import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ModalNovoComunicado } from "@/components/governador/ModalNovoComunicado";
import { Loader2, Plus, Megaphone, Eye } from "lucide-react";

export const Route = createFileRoute("/governador/comunicados")({
  head: () => ({
    meta: [{ title: "Comunicados — Governador — NovaeXis" }],
  }),
  component: () => (
    <RoleGuard allowed={["governador", "superadmin"]} title="Comunicados aos Municípios" subtitle="Governador">
      <ComunicadosPage />
    </RoleGuard>
  ),
});

interface Comunicado {
  id: string;
  titulo: string;
  corpo: string;
  enviado_at: string;
  tenants_destinatarios: string[];
  destinatarios: string;
  lido_por: Record<string, string>;
}

function ComunicadosPage() {
  const [items, setItems] = useState<Comunicado[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNovo, setOpenNovo] = useState(false);
  const [vendo, setVendo] = useState<Comunicado | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("comunicados_governador")
      .select("id, titulo, corpo, enviado_at, tenants_destinatarios, destinatarios, lido_por")
      .order("enviado_at", { ascending: false });
    setItems((data ?? []) as Comunicado[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Comunicados aos Municípios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mensagens oficiais do Governo do Estado para os prefeitos aderentes
          </p>
        </div>
        <Button onClick={() => setOpenNovo(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo comunicado
        </Button>
      </div>

      {loading ? (
        <div className="flex h-60 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center">
          <Megaphone className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Nenhum comunicado enviado ainda. Clique em "Novo comunicado" para começar.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Enviados
          </h2>
          {items.map((c) => {
            const totalDest = c.tenants_destinatarios?.length ?? 0;
            const totalLidos = Object.keys(c.lido_por ?? {}).length;
            const data = new Date(c.enviado_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
            return (
              <Card key={c.id} className="p-4 transition hover:shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold">{c.titulo}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.corpo}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Enviado em {data}</span>
                      <span>
                        Para:{" "}
                        {c.destinatarios === "todos"
                          ? "todos os municípios"
                          : `${totalDest} município(s)`}
                      </span>
                      <span className="font-medium text-foreground">
                        Lido por {totalLidos} de {totalDest}
                      </span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setVendo(c)}>
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    Ver
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ModalNovoComunicado open={openNovo} onOpenChange={setOpenNovo} onCreated={load} />

      <Dialog open={vendo !== null} onOpenChange={(v) => !v && setVendo(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{vendo?.titulo}</DialogTitle>
          </DialogHeader>
          {vendo && (
            <>
              <p className="text-xs text-muted-foreground">
                Enviado em {new Date(vendo.enviado_at).toLocaleString("pt-BR")} ·{" "}
                {Object.keys(vendo.lido_por ?? {}).length} de{" "}
                {vendo.tenants_destinatarios?.length ?? 0} leituras
              </p>
              <div className="mt-2 whitespace-pre-wrap text-sm">{vendo.corpo}</div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
