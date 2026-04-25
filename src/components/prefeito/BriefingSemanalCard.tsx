import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Sparkles, Loader2, AlertCircle, Lightbulb, Trophy } from "lucide-react";

interface BriefingItem {
  titulo: string;
  descricao: string;
  severidade?: string;
  prioridade?: string;
}

interface Briefing {
  id: string;
  semana_referencia: string;
  destaques: BriefingItem[];
  alertas: BriefingItem[];
  recomendacoes: BriefingItem[];
  created_at: string;
}

interface Props {
  tenantId: string;
}

export function BriefingSemanalCard({ tenantId }: Props) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("briefings_semanais")
      .select("id, semana_referencia, destaques, alertas, recomendacoes, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setBriefing(data as unknown as Briefing | null);
    setLoading(false);
  }

  async function gerarAgora() {
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-briefing-semanal");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Briefing gerado pela IA");
      await load();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erro ao gerar briefing");
    } finally {
      setGerando(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Briefing semanal IA</h2>
            {briefing && (
              <p className="text-xs text-muted-foreground">
                Gerado em{" "}
                {new Date(briefing.created_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        </div>
        <Button onClick={gerarAgora} disabled={gerando} size="sm" className="gap-2">
          {gerando ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {briefing ? "Regenerar" : "Gerar agora"}
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : !briefing ? (
        <p className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
          Nenhum briefing gerado ainda. Clique em "Gerar agora" para a IA produzir um resumo executivo da semana.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Bloco
            icon={<Trophy className="h-4 w-4 text-primary" />}
            label="Destaques"
            items={briefing.destaques ?? []}
          />
          <Bloco
            icon={<AlertCircle className="h-4 w-4 text-destructive" />}
            label="Alertas"
            items={briefing.alertas ?? []}
          />
          <Bloco
            icon={<Lightbulb className="h-4 w-4 text-amber-500" />}
            label="Recomendações"
            items={briefing.recomendacoes ?? []}
          />
        </div>
      )}
    </Card>
  );
}

function Bloco({
  icon,
  label,
  items,
}: {
  icon: React.ReactNode;
  label: string;
  items: BriefingItem[];
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 3).map((it, i) => (
            <li key={i} className="rounded-md border bg-muted/30 p-2.5">
              <p className="text-sm font-medium leading-tight">{it.titulo}</p>
              <p className="mt-1 text-xs text-muted-foreground">{it.descricao}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
