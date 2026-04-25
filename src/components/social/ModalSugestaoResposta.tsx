import { useState } from "react";
import { Loader2, Sparkles, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  mencaoId: string;
  conteudo: string;
  open: boolean;
  onClose: () => void;
}

export function ModalSugestaoResposta({ mencaoId, conteudo, open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [versoes, setVersoes] = useState<string[]>([]);

  async function gerar() {
    setLoading(true);
    setVersoes([]);
    try {
      const { data, error } = await supabase.functions.invoke("sugerir-resposta-social", {
        body: { mencao_id: mencaoId },
      });
      if (error) throw error;
      const list = (data as { versoes?: string[] })?.versoes ?? [];
      setVersoes(list);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar sugestões");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              Sugestões de resposta
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">Geradas por IA — revise antes de publicar.</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 rounded-md border bg-muted/40 p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Menção</p>
          <p className="mt-1 leading-snug">{conteudo}</p>
        </div>

        {versoes.length === 0 && !loading && (
          <Button onClick={gerar} className="w-full">
            <Sparkles className="mr-2 h-4 w-4" />
            Gerar 3 versões com IA
          </Button>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Gerando sugestões...
          </div>
        )}

        {versoes.length > 0 && (
          <ul className="space-y-2">
            {versoes.map((v, i) => (
              <li key={i} className="rounded-md border bg-card p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Versão {i + 1}
                </p>
                <p className="text-sm leading-snug">{v}</p>
                <button
                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  onClick={() => {
                    void navigator.clipboard.writeText(v);
                    toast.success("Copiado!");
                  }}
                >
                  <Copy className="h-3 w-3" /> Copiar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
