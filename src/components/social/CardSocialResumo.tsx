import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Radio, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  tenantId: string;
}

interface ScoreRow {
  score: number;
  total_mencoes: number;
  negativas: number;
  alerta_crise: boolean;
}

export function CardSocialResumo({ tenantId }: Props) {
  const [atual, setAtual] = useState<ScoreRow | null>(null);
  const [anterior, setAnterior] = useState<number | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function load() {
    const { data } = await supabase
      .from("scores_aprovacao")
      .select("score, total_mencoes, negativas, alerta_crise, data")
      .eq("tenant_id", tenantId)
      .order("data", { ascending: false })
      .limit(8);
    const list = (data ?? []) as Array<ScoreRow & { data: string }>;
    setAtual(list[0] ?? null);
    setAnterior(list[7] ? Number(list[7].score) : null);
  }

  const variacao = atual && anterior != null ? Number(atual.score) - anterior : null;
  const crise = atual?.alerta_crise;

  return (
    <Link to="/prefeito/social" className="block">
      <Card
        className={`p-5 transition-colors hover:bg-muted/30 ${
          crise ? "border-destructive/50 bg-destructive/10" : ""
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Radio className={`h-4 w-4 ${crise ? "text-destructive" : "text-primary"}`} />
            Social Intelligence
          </h3>
          {crise && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase text-destructive-foreground">
              <AlertTriangle className="h-3 w-3" /> Crise
            </span>
          )}
        </div>

        {atual ? (
          <>
            <p className="text-3xl font-bold tabular-nums">
              {Number(atual.score).toFixed(0)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">/100</span>
            </p>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span>{atual.total_mencoes} menções (24h)</span>
              {variacao != null && (
                <span
                  className={`inline-flex items-center gap-1 ${
                    variacao >= 0 ? "text-primary" : "text-destructive"
                  }`}
                >
                  {variacao >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {variacao > 0 ? "+" : ""}
                  {variacao.toFixed(1)} pts (7d)
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Sem dados ainda — configure as fontes.</p>
        )}
      </Card>
    </Link>
  );
}
