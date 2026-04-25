import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Megaphone } from "lucide-react";

interface Comunicado {
  id: string;
  titulo: string;
  corpo: string;
  enviado_at: string;
  lido_por: Record<string, string>;
}

export function ComunicadosEstadoSection() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;
  const [items, setItems] = useState<Comunicado[]>([]);
  const [vendo, setVendo] = useState<Comunicado | null>(null);

  async function load() {
    const { data } = await supabase
      .from("comunicados_governador")
      .select("id, titulo, corpo, enviado_at, lido_por")
      .order("enviado_at", { ascending: false });
    setItems((data ?? []) as Comunicado[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function abrirEMarcarLido(c: Comunicado) {
    setVendo(c);
    if (!tenantId || c.lido_por?.[tenantId]) return;
    const novo = { ...(c.lido_por ?? {}), [tenantId]: new Date().toISOString() };
    await supabase.from("comunicados_governador").update({ lido_por: novo }).eq("id", c.id);
    setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, lido_por: novo } : x)));
  }

  if (items.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Comunicados do Estado
        </h2>
        <Badge variant="secondary" className="text-xs">{items.length}</Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((c) => {
          const lido = tenantId ? Boolean(c.lido_por?.[tenantId]) : false;
          return (
            <Card key={c.id} className="p-4">
              <div className="flex items-start gap-2">
                <Megaphone className="mt-0.5 h-4 w-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase text-primary">
                      Governo do Estado
                    </p>
                    {!lido && (
                      <Badge className="h-5 bg-primary text-primary-foreground text-[10px]">
                        Novo
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm font-medium">{c.titulo}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Recebido em {new Date(c.enviado_at).toLocaleDateString("pt-BR")}
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-1 h-auto p-0 text-xs"
                    onClick={() => abrirEMarcarLido(c)}
                  >
                    Ler comunicado completo →
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={vendo !== null} onOpenChange={(v) => !v && setVendo(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{vendo?.titulo}</DialogTitle>
          </DialogHeader>
          {vendo && (
            <>
              <p className="text-xs uppercase text-primary">Governo do Estado do Pará</p>
              <p className="text-xs text-muted-foreground">
                Recebido em {new Date(vendo.enviado_at).toLocaleString("pt-BR")}
              </p>
              <div className="mt-2 whitespace-pre-wrap text-sm">{vendo.corpo}</div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
