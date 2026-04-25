import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Send, Sparkles, ThumbsDown, ThumbsUp, User } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface Mensagem {
  role: "user" | "assistant";
  content: string;
  conversaId?: string;
  avaliacao?: number | null;
}

interface ChatIAProps {
  /** Endpoint Supabase Edge Function: 'agente-prefeito' | 'agente-secretario' | 'agente-governador' */
  endpoint: string;
  titulo: string;
  subtitulo?: string;
  sugestoes: string[];
  /** Para agente-secretario, passa secretaria_slug no body */
  secretariaSlug?: string;
  /** Tipo da conversa para reload do histórico */
  tipoConversa?: "prefeito" | "secretario" | "governador";
  /** Carregar histórico inicial do banco */
  carregarHistorico?: boolean;
  className?: string;
  alturaMin?: string;
}

export function ChatIA({
  endpoint,
  titulo,
  subtitulo,
  sugestoes,
  secretariaSlug,
  tipoConversa,
  carregarHistorico = true,
  className,
  alturaMin = "h-[60vh]",
}: ChatIAProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [pergunta, setPergunta] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [carregandoHistorico, setCarregandoHistorico] = useState(carregarHistorico);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!carregarHistorico) {
      setCarregandoHistorico(false);
      return;
    }
    void loadHistorico();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens, carregando]);

  async function loadHistorico() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCarregandoHistorico(false);
        return;
      }
      let q = supabase
        .from("conversas_ia")
        .select("id, pergunta, resposta, avaliacao")
        .eq("usuario_id", user.id)
        .order("created_at", { ascending: true })
        .limit(20);
      if (tipoConversa) q = q.eq("tipo", tipoConversa);
      if (secretariaSlug) q = q.eq("secretaria_slug", secretariaSlug);
      const { data, error } = await q;
      if (error) throw error;
      const msgs: Mensagem[] = [];
      for (const row of data || []) {
        msgs.push({ role: "user", content: row.pergunta });
        msgs.push({
          role: "assistant",
          content: row.resposta,
          conversaId: row.id,
          avaliacao: row.avaliacao,
        });
      }
      setMensagens(msgs);
    } catch (err) {
      console.error("Erro carregando histórico:", err);
    } finally {
      setCarregandoHistorico(false);
    }
  }

  async function enviarPergunta(perguntaTexto?: string) {
    const novaPergunta = (perguntaTexto ?? pergunta).trim();
    if (!novaPergunta || carregando) return;
    setPergunta("");
    setCarregando(true);

    const historicoParaIA = mensagens
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }));

    setMensagens((prev) => [...prev, { role: "user", content: novaPergunta }]);

    try {
      const body: Record<string, unknown> = {
        pergunta: novaPergunta,
        historico_conversa: historicoParaIA,
      };
      if (secretariaSlug) body.secretaria_slug = secretariaSlug;

      const { data, error } = await supabase.functions.invoke(endpoint, {
        body,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Buscar a conversa recém-criada para ter o id (para avaliação)
      const { data: { user } } = await supabase.auth.getUser();
      let conversaId: string | undefined;
      if (user) {
        const { data: ultima } = await supabase
          .from("conversas_ia")
          .select("id")
          .eq("usuario_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        conversaId = ultima?.id;
      }

      setMensagens((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.resposta,
          conversaId,
          avaliacao: null,
        },
      ]);
    } catch (err: any) {
      console.error("Erro IA:", err);
      const msg = err?.message?.includes("429")
        ? "Muitas requisições. Aguarde um instante."
        : err?.message?.includes("402")
          ? "Créditos de IA esgotados. Adicione créditos no workspace."
          : "Erro ao consultar a IA. Tente novamente.";
      toast.error(msg);
      setMensagens((prev) => prev.slice(0, -1));
    } finally {
      setCarregando(false);
    }
  }

  async function avaliar(conversaId: string | undefined, nota: number) {
    if (!conversaId) return;
    try {
      const { error } = await supabase
        .from("conversas_ia")
        .update({ avaliacao: nota })
        .eq("id", conversaId);
      if (error) throw error;
      setMensagens((prev) =>
        prev.map((m) =>
          m.conversaId === conversaId ? { ...m, avaliacao: nota } : m,
        ),
      );
      toast.success("Obrigado pela avaliação!");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível registrar a avaliação");
    }
  }

  const mostrarSugestoes =
    !carregandoHistorico && mensagens.length === 0 && !carregando;

  return (
    <Card className={cn("flex flex-col overflow-hidden", alturaMin, className)}>
      {/* Header */}
      <div className="border-b bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{titulo}</h2>
        </div>
        {subtitulo && (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitulo}</p>
        )}
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto p-4">
        {carregandoHistorico ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : mostrarSugestoes ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Sparkles className="mb-3 h-10 w-10 text-primary/60" />
            <p className="mb-1 text-sm font-medium">Comece com uma pergunta</p>
            <p className="mb-4 max-w-md text-xs text-muted-foreground">
              Sugestões com base no contexto atual do seu município:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {sugestoes.map((s) => (
                <button
                  key={s}
                  onClick={() => void enviarPergunta(s)}
                  className="rounded-full border bg-card px-3 py-1.5 text-xs text-foreground/80 transition hover:border-primary hover:bg-primary/5 hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {mensagens.map((m, idx) => (
              <MensagemItem
                key={idx}
                mensagem={m}
                onAvaliar={(nota) => void avaliar(m.conversaId, nota)}
              />
            ))}
            {carregando && (
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t bg-muted/20 p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            placeholder="Pergunte sobre sua gestão..."
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
            disabled={carregando}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void enviarPergunta();
              }
            }}
          />
          <Button
            onClick={() => void enviarPergunta()}
            disabled={!pergunta.trim() || carregando}
            size="icon"
            className="shrink-0"
            aria-label="Enviar"
          >
            {carregando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Shift+Enter para nova linha · Enter para enviar
        </p>
      </div>
    </Card>
  );
}

function MensagemItem({
  mensagem,
  onAvaliar,
}: {
  mensagem: Mensagem;
  onAvaliar: (nota: number) => void;
}) {
  const isUser = mensagem.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-foreground/10" : "bg-primary/10 text-primary",
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
      </div>
      <div className={cn("flex-1 space-y-1", isUser && "text-right")}>
        <div
          className={cn(
            "inline-block max-w-[92%] rounded-lg px-3 py-2 text-sm",
            isUser
              ? "bg-primary text-primary-foreground"
              : "border bg-card text-foreground",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{mensagem.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1.5 prose-ul:my-1.5 prose-headings:mb-1.5 prose-headings:mt-2">
              <ReactMarkdown>{mensagem.content}</ReactMarkdown>
            </div>
          )}
        </div>
        {!isUser && mensagem.conversaId && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <button
              onClick={() => onAvaliar(5)}
              className={cn(
                "rounded p-1 transition hover:bg-muted hover:text-foreground",
                mensagem.avaliacao === 5 && "text-primary",
              )}
              aria-label="Útil"
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onAvaliar(1)}
              className={cn(
                "rounded p-1 transition hover:bg-muted hover:text-foreground",
                mensagem.avaliacao === 1 && "text-destructive",
              )}
              aria-label="Não útil"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
