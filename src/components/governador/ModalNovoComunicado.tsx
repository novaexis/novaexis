import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

interface MunicipioOpt {
  id: string;
  nome: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
  municipioPreSelecionado?: string;
}

export function ModalNovoComunicado({ open, onOpenChange, onCreated, municipioPreSelecionado }: Props) {
  const { profile } = useAuth();
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [municipios, setMunicipios] = useState<MunicipioOpt[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [todos, setTodos] = useState(true);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!open) return;
    void supabase
      .from("tenants")
      .select("id, nome")
      .eq("tipo", "municipio")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => {
        setMunicipios((data ?? []) as MunicipioOpt[]);
        if (municipioPreSelecionado) {
          setTodos(false);
          setSelecionados(new Set([municipioPreSelecionado]));
        } else {
          setTodos(true);
          setSelecionados(new Set());
        }
      });
  }, [open, municipioPreSelecionado]);

  const destinatariosFinais = todos ? municipios.map((m) => m.id) : Array.from(selecionados);

  async function enviar() {
    if (!titulo.trim() || !corpo.trim()) {
      toast.error("Título e corpo são obrigatórios");
      return;
    }
    if (destinatariosFinais.length === 0) {
      toast.error("Selecione pelo menos um município");
      return;
    }
    if (!profile?.tenant_id || !profile.id) {
      toast.error("Sessão inválida");
      return;
    }
    setEnviando(true);

    const { data: comunicado, error: errC } = await supabase
      .from("comunicados_governador")
      .insert({
        tenant_estadual_id: profile.tenant_id,
        titulo: titulo.trim(),
        corpo: corpo.trim(),
        destinatarios: todos ? "todos" : "especificos",
        tenants_destinatarios: destinatariosFinais,
        enviado_por: profile.id,
      })
      .select()
      .single();

    if (errC || !comunicado) {
      toast.error("Erro ao enviar comunicado");
      setEnviando(false);
      return;
    }

    // Criar alerta em cada município destinatário
    const prazo30d = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
    await supabase.from("alertas_prazos").insert(
      destinatariosFinais.map((tid) => ({
        tenant_id: tid,
        titulo: `📢 Governo do Estado: ${titulo.trim()}`,
        descricao: corpo.trim().substring(0, 500),
        tipo: "recurso_estadual" as const,
        fonte: "Governo do Estado do Pará",
        prazo: prazo30d,
        status: "disponivel" as const,
        criado_automaticamente: true,
      })),
    );

    toast.success(`Comunicado enviado para ${destinatariosFinais.length} município(s)`);
    setTitulo("");
    setCorpo("");
    setSelecionados(new Set());
    setTodos(true);
    setEnviando(false);
    onOpenChange(false);
    onCreated?.();
  }

  function toggleMun(id: string) {
    setSelecionados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo comunicado aos municípios</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value.slice(0, 100))}
              placeholder="Ex: Prazo para envio de RREO — jan/2025"
              maxLength={100}
            />
            <p className="mt-1 text-xs text-muted-foreground">{titulo.length}/100</p>
          </div>

          <div>
            <Label htmlFor="corpo">Corpo do comunicado *</Label>
            <Textarea
              id="corpo"
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              rows={6}
              placeholder="Mensagem detalhada para os prefeitos..."
            />
          </div>

          <div>
            <Label>Destinatários</Label>
            <div className="mt-2 flex items-center gap-2">
              <Checkbox
                id="todos"
                checked={todos}
                onCheckedChange={(v) => {
                  setTodos(v === true);
                  if (v === true) setSelecionados(new Set());
                }}
              />
              <Label htmlFor="todos" className="cursor-pointer text-sm font-normal">
                Todos os municípios aderentes ({municipios.length})
              </Label>
            </div>

            {!todos && (
              <div className="mt-3 max-h-40 space-y-1.5 overflow-y-auto rounded-md border bg-muted/20 p-3">
                {municipios.map((m) => (
                  <div key={m.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`m-${m.id}`}
                      checked={selecionados.has(m.id)}
                      onCheckedChange={() => toggleMun(m.id)}
                    />
                    <Label htmlFor={`m-${m.id}`} className="cursor-pointer text-sm font-normal">
                      {m.nome}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="rounded-md bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            Será enviado para <strong>{destinatariosFinais.length}</strong> município(s).
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={enviando}>
            {enviando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Enviar comunicado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
