import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  tenantId: string;
}

interface ScoreRow {
  data: string;
  score: number;
  alerta_crise: boolean;
  total_mencoes: number;
  negativas: number;
}

export function AlertaCrise({ tenantId }: Props) {
  const [score, setScore] = useState<ScoreRow | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    void load();
    const channel = supabase
      .channel(`scores-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scores_aprovacao", filter: `tenant_id=eq.${tenantId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function load() {
    const { data } = await supabase
      .from("scores_aprovacao")
      .select("data, score, alerta_crise, total_mencoes, negativas")
      .eq("tenant_id", tenantId)
      .order("data", { ascending: false })
      .limit(1)
      .maybeSingle();
    setScore(data as ScoreRow | null);
  }

  if (!score?.alerta_crise) return null;

  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive shadow-sm"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Alerta de crise de reputação</p>
        <p className="mt-0.5 text-sm">
          Score atual em <strong>{Number(score.score).toFixed(0)}/100</strong> — {score.negativas} de{" "}
          {score.total_mencoes} menções negativas nas últimas 24h. Atenção redobrada na comunicação.
        </p>
      </div>
    </div>
  );
}
