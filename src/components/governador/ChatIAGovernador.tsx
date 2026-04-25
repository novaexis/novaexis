import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Sparkles, User } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatIAGovernador({ secretariaSlug }: { secretariaSlug?: string }) {
  const [pergunta, setPergunta] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function enviar() {
    const q = pergunta.trim();
    if (!q || loading) return;
    setPergunta("");
    const novaUser: Message = { role: "user", content: q };
    setMessages((m) => [...m, novaUser]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("agente-governador", {
        body: {
          pergunta: q,
          secretaria_slug: secretariaSlug ?? null,
          historico: messages.slice(-6),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessages((m) => [...m, { role: "assistant", content: data.resposta as string }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao consultar IA";
      toast.error(msg);
      setMessages((m) => [...m, { role: "assistant", content: `❌ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex h-[560px] flex-col p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold">Assessoria Estratégica</h2>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
            Faça uma pergunta sobre o cenário do estado. Exemplo: <em>"Quais
            secretarias precisam de atenção urgente este mês?"</em>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              {m.role === "user" ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4 text-primary" />}
            </div>
            <div
              className={`max-w-[85%] rounded-lg p-3 text-sm ${
                m.role === "user"
                  ? "bg-primary/10 text-foreground"
                  : "bg-muted/40 text-foreground"
              }`}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:mt-3 prose-headings:mb-1.5 prose-headings:text-sm prose-headings:font-semibold prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analisando indicadores…
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <Textarea
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          placeholder="Pergunte ao assessor estratégico…"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void enviar();
            }
          }}
          className="resize-none"
          disabled={loading}
        />
        <Button onClick={() => void enviar()} disabled={loading || !pergunta.trim()} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
