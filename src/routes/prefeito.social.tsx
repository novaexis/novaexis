import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Smile,
  Frown,
  Meh,
  TrendingUp,
  TrendingDown,
  Twitter,
  Facebook,
  Instagram,
  MapPin,
  Newspaper,
  Hash,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

export const Route = createFileRoute("/prefeito/social")({
  head: () => ({
    meta: [{ title: "Social Intelligence — Prefeito — NovaeXis" }],
  }),
  component: SocialPage,
});

type Plataforma =
  | "facebook"
  | "instagram"
  | "twitter"
  | "google_maps"
  | "noticias";
type Sentimento = "positivo" | "negativo" | "neutro";

interface Mencao {
  id: string;
  plataforma: Plataforma;
  conteudo: string;
  autor: string | null;
  sentimento: Sentimento | null;
  score_sentimento: number | null;
  temas: string[] | null;
  alcance: number | null;
  coletado_at: string;
}

interface Score {
  data: string;
  score: number;
  positivas: number;
  negativas: number;
  neutras: number;
  total_mencoes: number;
  temas_trending: Array<{ tema: string; mencoes: number; sentimento: number }>;
}

const FILTROS_SENT: Array<{ v: "todos" | Sentimento; label: string }> = [
  { v: "todos", label: "Todos" },
  { v: "positivo", label: "Positivo" },
  { v: "negativo", label: "Negativo" },
  { v: "neutro", label: "Neutro" },
];

const FILTROS_PLAT: Array<{ v: "todos" | Plataforma; label: string }> = [
  { v: "todos", label: "Todas" },
  { v: "twitter", label: "Twitter" },
  { v: "facebook", label: "Facebook" },
  { v: "instagram", label: "Instagram" },
  { v: "google_maps", label: "Google Maps" },
  { v: "noticias", label: "Notícias" },
];

function SocialPage() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;
  const [loading, setLoading] = useState(true);
  const [mencoes, setMencoes] = useState<Mencao[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [fSent, setFSent] = useState<"todos" | Sentimento>("todos");
  const [fPlat, setFPlat] = useState<"todos" | Plataforma>("todos");

  useEffect(() => {
    if (!tenantId) return;
    void load(tenantId);
  }, [tenantId]);

  async function load(tid: string) {
    setLoading(true);
    try {
      const [m, s] = await Promise.all([
        supabase
          .from("mencoes_sociais")
          .select(
            "id, plataforma, conteudo, autor, sentimento, score_sentimento, temas, alcance, coletado_at",
          )
          .eq("tenant_id", tid)
          .order("coletado_at", { ascending: false })
          .limit(200),
        supabase
          .from("scores_aprovacao")
          .select("data, score, positivas, negativas, neutras, total_mencoes, temas_trending")
          .eq("tenant_id", tid)
          .order("data", { ascending: true })
          .limit(60),
      ]);

      if (m.error) throw m.error;
      if (s.error) throw s.error;

      setMencoes((m.data ?? []) as unknown as Mencao[]);
      setScores((s.data ?? []) as unknown as Score[]);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar dados sociais");
    } finally {
      setLoading(false);
    }
  }

  const scoreAtual = scores.at(-1)?.score ?? null;
  const scoreAnterior = scores.at(-8)?.score ?? null;
  const variacao =
    scoreAtual != null && scoreAnterior != null
      ? scoreAtual - scoreAnterior
      : null;

  const totals = useMemo(() => {
    const pos = mencoes.filter((m) => m.sentimento === "positivo").length;
    const neg = mencoes.filter((m) => m.sentimento === "negativo").length;
    const neu = mencoes.filter((m) => m.sentimento === "neutro").length;
    return { pos, neg, neu, total: mencoes.length };
  }, [mencoes]);

  const temasTrending = useMemo(() => {
    const last = scores.at(-1)?.temas_trending ?? [];
    return last.slice(0, 6);
  }, [scores]);

  const mencoesFiltradas = useMemo(() => {
    return mencoes.filter(
      (m) =>
        (fSent === "todos" || m.sentimento === fSent) &&
        (fPlat === "todos" || m.plataforma === fPlat),
    );
  }, [mencoes, fSent, fPlat]);

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Social Intelligence
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O que estão falando da sua gestão nas redes e notícias
        </p>
      </header>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <>
          {/* KPIs principais */}
          <section className="mb-6 grid gap-4 md:grid-cols-4">
            <CardScore score={scoreAtual} variacao={variacao} />
            <CardSent
              icon={<Smile className="h-5 w-5 text-primary" />}
              label="Positivas"
              valor={totals.pos}
              total={totals.total}
              cls="text-primary"
            />
            <CardSent
              icon={<Frown className="h-5 w-5 text-destructive" />}
              label="Negativas"
              valor={totals.neg}
              total={totals.total}
              cls="text-destructive"
            />
            <CardSent
              icon={<Meh className="h-5 w-5 text-muted-foreground" />}
              label="Neutras"
              valor={totals.neu}
              total={totals.total}
              cls="text-foreground"
            />
          </section>

          {/* Evolução do score */}
          <section className="mb-6 rounded-lg border bg-card p-4 md:p-6">
            <h2 className="mb-4 text-base font-semibold">
              Evolução do score de aprovação (30 dias)
            </h2>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={scores.map((s) => ({
                    data: new Date(s.data).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    }),
                    score: Number(s.score),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="data" className="fill-muted-foreground text-xs" />
                  <YAxis domain={[0, 100]} className="fill-muted-foreground text-xs" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                    }}
                  />
                  <ReferenceLine
                    y={50}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="3 3"
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Temas trending */}
          {temasTrending.length > 0 && (
            <section className="mb-6 rounded-lg border bg-card p-4 md:p-6">
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
                <Hash className="h-4 w-4 text-primary" />
                Temas em alta
              </h2>
              <div className="flex flex-wrap gap-2">
                {temasTrending.map((t) => {
                  const sentColor =
                    t.sentimento > 0.2
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : t.sentimento < -0.2
                        ? "border-destructive/40 bg-destructive/10 text-destructive"
                        : "border-border bg-muted text-foreground";
                  return (
                    <span
                      key={t.tema}
                      className={
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm " +
                        sentColor
                      }
                    >
                      <span className="font-medium">{t.tema}</span>
                      <span className="text-xs opacity-70">
                        {t.mencoes} menções
                      </span>
                    </span>
                  );
                })}
              </div>
            </section>
          )}

          {/* Filtros + lista */}
          <section className="rounded-lg border bg-card p-4 md:p-6">
            <h2 className="mb-4 text-base font-semibold">
              Menções recentes ({mencoesFiltradas.length})
            </h2>

            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Sentimento
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {FILTROS_SENT.map((f) => (
                    <button
                      key={f.v}
                      onClick={() => setFSent(f.v)}
                      className={
                        "rounded-full border px-3 py-1 text-xs transition-colors " +
                        (fSent === f.v
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:bg-muted")
                      }
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Plataforma
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {FILTROS_PLAT.map((f) => (
                    <button
                      key={f.v}
                      onClick={() => setFPlat(f.v)}
                      className={
                        "rounded-full border px-3 py-1 text-xs transition-colors " +
                        (fPlat === f.v
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:bg-muted")
                      }
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {mencoesFiltradas.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma menção encontrada com esses filtros.
              </p>
            ) : (
              <ul className="divide-y">
                {mencoesFiltradas.slice(0, 30).map((m) => (
                  <MencaoItem key={m.id} m={m} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function CardScore({
  score,
  variacao,
}: {
  score: number | null;
  variacao: number | null;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
        Score de aprovação
      </p>
      <p className="text-3xl font-bold tabular-nums">
        {score != null ? `${score.toFixed(1)}%` : "—"}
      </p>
      {variacao != null && (
        <p
          className={
            "mt-1 flex items-center gap-1 text-xs " +
            (variacao >= 0 ? "text-primary" : "text-destructive")
          }
        >
          {variacao >= 0 ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {variacao > 0 ? "+" : ""}
          {variacao.toFixed(1)} pts (7d)
        </p>
      )}
    </div>
  );
}

function CardSent({
  icon,
  label,
  valor,
  total,
  cls,
}: {
  icon: React.ReactNode;
  label: string;
  valor: number;
  total: number;
  cls: string;
}) {
  const pct = total > 0 ? (valor / total) * 100 : 0;
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {icon}
      </div>
      <p className={"text-2xl font-bold tabular-nums " + cls}>{valor}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {pct.toFixed(0)}% do total
      </p>
    </div>
  );
}

function MencaoItem({ m }: { m: Mencao }) {
  const Plat = plataformaIcon(m.plataforma);
  const sentBadge =
    m.sentimento === "positivo"
      ? "border-primary/40 bg-primary/10 text-primary"
      : m.sentimento === "negativo"
        ? "border-destructive/40 bg-destructive/10 text-destructive"
        : "border-border bg-muted text-foreground";

  return (
    <li className="flex gap-3 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
        <Plat className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2 text-xs">
          <span className="font-medium">{m.autor ?? "Anônimo"}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {new Date(m.coletado_at).toLocaleDateString("pt-BR")}
          </span>
          {m.sentimento && (
            <span
              className={
                "ml-auto rounded-full border px-2 py-0.5 text-[10px] uppercase " +
                sentBadge
              }
            >
              {m.sentimento}
            </span>
          )}
        </div>
        <p className="text-sm leading-snug">{m.conteudo}</p>
        {(m.temas?.length || m.alcance) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {m.temas?.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded bg-muted px-1.5 py-0.5 text-[11px]"
              >
                #{t}
              </span>
            ))}
            {m.alcance != null && (
              <span className="ml-auto tabular-nums">
                {m.alcance.toLocaleString("pt-BR")} alcance
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function plataformaIcon(p: Plataforma) {
  switch (p) {
    case "twitter":
      return Twitter;
    case "facebook":
      return Facebook;
    case "instagram":
      return Instagram;
    case "google_maps":
      return MapPin;
    case "noticias":
      return Newspaper;
  }
}
