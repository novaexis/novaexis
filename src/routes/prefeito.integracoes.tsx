import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { CardIntegrador, ModalErroIntegrador, type IntegradorItem } from "@/components/integracoes/CardIntegrador";
import { SECRETARIAS_MUNICIPAIS } from "@/lib/secretarias-municipais";
import { Loader2, Plug, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/prefeito/integracoes")({
  head: () => ({ meta: [{ title: "Integrações — Prefeito — NovaeXis" }] }),
  component: IntegracoesPage,
});

function IntegracoesPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const tenantId = profile?.tenant_id;
  const [items, setItems] = useState<IntegradorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroModal, setErroModal] = useState<IntegradorItem | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    void (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("integradores")
        .select("id, tenant_id, secretaria_slug, nome, descricao, tipo, status, ultimo_sync, ultimo_erro, total_registros_importados")
        .eq("tenant_id", tenantId)
        .order("secretaria_slug");
      if (error) toast.error("Erro ao carregar integrações");
      setItems((data ?? []) as IntegradorItem[]);
      setLoading(false);
    })();
  }, [tenantId]);

  const resumo = useMemo(() => ({
    total: items.length,
    ativos: items.filter((i) => i.status === "ativo").length,
    erro: items.filter((i) => i.status === "erro").length,
    aguardando: items.filter((i) => i.status === "aguardando_configuracao").length,
  }), [items]);

  const grupos = useMemo(() => {
    const map = new Map<string, IntegradorItem[]>();
    for (const i of items) {
      const arr = map.get(i.secretaria_slug) ?? [];
      arr.push(i);
      map.set(i.secretaria_slug, arr);
    }
    return Array.from(map.entries());
  }, [items]);

  function handleImportar(i: IntegradorItem) {
    navigate({ to: "/prefeito/secretaria/$slug/importar", params: { slug: i.secretaria_slug } });
  }

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-8">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Plug className="h-6 w-6 text-primary" /> Integrações de sistemas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Conectores que alimentam os indicadores das secretarias do município
          </p>
        </div>
        <Button disabled title="Apenas superadmin pode adicionar conectores">
          <Plus className="mr-1 h-4 w-4" /> Novo conector
        </Button>
      </header>

      {/* Resumo */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <ResumoCard label="Conectores" valor={resumo.total} />
        <ResumoCard label="Ativos" valor={resumo.ativos} tone="success" />
        <ResumoCard label="Com erro" valor={resumo.erro} tone={resumo.erro > 0 ? "danger" : "neutral"} />
        <ResumoCard label="Aguardando" valor={resumo.aguardando} tone={resumo.aguardando > 0 ? "info" : "neutral"} />
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          Nenhum conector configurado para este município.
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map(([slug, lista]) => {
            const meta = SECRETARIAS_MUNICIPAIS[slug];
            return (
              <section key={slug}>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {meta?.nome ?? slug}
                </h2>
                <div className="space-y-2">
                  {lista.map((i) => (
                    <CardIntegrador
                      key={i.id}
                      integrador={i}
                      onVerErro={setErroModal}
                      onImportar={handleImportar}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <ModalErroIntegrador integrador={erroModal} onClose={() => setErroModal(null)} />
    </main>
  );
}

function ResumoCard({
  label,
  valor,
  tone = "neutral",
}: {
  label: string;
  valor: number;
  tone?: "neutral" | "success" | "danger" | "info";
}) {
  const cls = {
    neutral: "text-foreground",
    success: "text-emerald-600 dark:text-emerald-400",
    danger: "text-destructive",
    info: "text-blue-600 dark:text-blue-400",
  }[tone];
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${cls}`}>{valor}</p>
    </div>
  );
}
