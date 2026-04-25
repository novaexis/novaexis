import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { WizardShell } from "@/components/cidadao/WizardShell";
import { CidadaoBottomNav } from "@/components/cidadao/CidadaoBottomNav";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { gerarProtocolo } from "@/lib/protocolo";
import { Frown, Lightbulb, ThumbsUp, EyeOff } from "lucide-react";

export const Route = createFileRoute("/cidadao/servicos/ouvidoria")({
  head: () => ({ meta: [{ title: "Ouvidoria — NovaeXis" }] }),
  component: () => (
    <RoleGuard allowed={["cidadao", "superadmin"]} title="Ouvidoria" subtitle="Wizard">
      <WizardOuvidoriaPage />
      <CidadaoBottomNav />
    </RoleGuard>
  ),
});

type TipoOuv = "reclamacao" | "sugestao" | "elogio";
type DemandaTipo = "servico" | "reclamacao" | "sugestao" | "seguranca" | "elogio";

interface Secretaria { slug: string; nome: string }

const TIPOS: Record<TipoOuv, { label: string; icon: typeof Frown; color: string }> = {
  reclamacao: { label: "Reclamação", icon: Frown, color: "text-destructive" },
  sugestao: { label: "Sugestão", icon: Lightbulb, color: "text-amber-500" },
  elogio: { label: "Elogio", icon: ThumbsUp, color: "text-success" },
};

function WizardOuvidoriaPage() {
  const { user, profile } = useAuth();
  const nav = useNavigate();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [tipo, setTipo] = useState<TipoOuv | null>(null);
  const [secretarias, setSecretarias] = useState<Secretaria[]>([]);
  const [secretariaSlug, setSecretariaSlug] = useState<string>("");
  const [titulo, setTitulo] = useState("");
  const [relato, setRelato] = useState("");
  const [sigilo, setSigilo] = useState(false);
  const [tenantSlug, setTenantSlug] = useState("");

  useEffect(() => {
    if (!profile?.tenant_id) return;
    void supabase
      .from("secretarias")
      .select("slug, nome")
      .eq("tenant_id", profile.tenant_id)
      .eq("ativo", true)
      .then(({ data }) => setSecretarias((data ?? []) as Secretaria[]));
    void supabase
      .from("tenants")
      .select("slug")
      .eq("id", profile.tenant_id)
      .maybeSingle()
      .then(({ data }) => setTenantSlug((data as { slug?: string } | null)?.slug ?? "MUN"));
  }, [profile?.tenant_id]);

  async function handleSubmit() {
    if (!user || !profile?.tenant_id || !tipo || !secretariaSlug) return;
    setSubmitting(true);
    try {
      const protocolo = gerarProtocolo(tenantSlug);
      const prazoSLA = new Date();
      prazoSLA.setDate(prazoSLA.getDate() + 5);
      const tituloFinal = `[${TIPOS[tipo].label}${sigilo ? " • Sigiloso" : ""}] ${titulo.trim()}`;

      const { data: demanda, error } = await supabase
        .from("demandas")
        .insert({
          tenant_id: profile.tenant_id,
          cidadao_id: user.id,
          secretaria_slug: secretariaSlug,
          protocolo,
          tipo: tipo as never,
          titulo: tituloFinal,
          descricao: relato.trim(),
          status: "aberta" as const,
          prioridade: tipo === "reclamacao" ? "alta" : "media",
          prazo_sla: prazoSLA.toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Manifestação registrada!", { description: `Protocolo: ${protocolo}` });
      void nav({ to: "/cidadao/demanda/$id", params: { id: demanda.id } });
    } catch (err) {
      toast.error("Erro", { description: String((err as Error).message) });
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    if (step === 1 && tipo) setStep(2);
    else if (step === 2 && secretariaSlug) setStep(3);
    else if (step === 3 && titulo.trim() && relato.trim().length >= 30) setStep(4);
    else if (step === 4) void handleSubmit();
  }
  function back() {
    if (step === 1) void nav({ to: "/cidadao/servicos" });
    else setStep((s) => s - 1);
  }

  const titles = ["Tipo de manifestação", "Secretaria envolvida", "Conte o que aconteceu", "Confirmação"];

  return (
    <WizardShell
      step={step}
      totalSteps={4}
      title={titles[step - 1]}
      onBack={back}
      onNext={next}
      nextLabel={step === 4 ? "Enviar manifestação" : "Continuar"}
      nextDisabled={
        (step === 1 && !tipo) ||
        (step === 2 && !secretariaSlug) ||
        (step === 3 && (!titulo.trim() || relato.trim().length < 30))
      }
      submitting={submitting}
    >
      {step === 1 && (
        <div className="space-y-2.5">
          {(Object.keys(TIPOS) as TipoOuv[]).map((k) => {
            const Icon = TIPOS[k].icon;
            const active = tipo === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setTipo(k)}
                className={`flex w-full items-center gap-4 rounded-lg border p-4 text-left transition ${
                  active ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:bg-muted/50"
                }`}
              >
                <Icon className={`h-7 w-7 ${TIPOS[k].color}`} />
                <span className="text-base font-semibold">{TIPOS[k].label}</span>
              </button>
            );
          })}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-2">
          {secretarias.map((s) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => setSecretariaSlug(s.slug)}
              className={`flex w-full items-center rounded-lg border p-3 text-left text-sm font-medium transition ${
                secretariaSlug === s.slug ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
            >
              {s.nome}
            </button>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="tit">Título *</Label>
            <Input
              id="tit"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value.slice(0, 80))}
              placeholder="Resumo em poucas palavras"
              className="mt-1"
              maxLength={80}
            />
            <p className="mt-1 text-xs text-muted-foreground">{titulo.length}/80</p>
          </div>
          <div>
            <Label htmlFor="rel">Relato *</Label>
            <Textarea
              id="rel"
              value={relato}
              onChange={(e) => setRelato(e.target.value)}
              placeholder="Descreva sua manifestação com detalhes..."
              className="mt-1 min-h-32"
            />
            <p className="mt-1 text-xs text-muted-foreground">{relato.trim().length} / mínimo 30 caracteres</p>
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border bg-muted/30 p-3">
            <Checkbox checked={sigilo} onCheckedChange={(v) => setSigilo(v === true)} className="mt-0.5" />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <EyeOff className="h-4 w-4" />
                Manter minha identidade em sigilo
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                A secretaria verá apenas o conteúdo, sem seu nome.
              </p>
            </div>
          </label>
        </div>
      )}

      {step === 4 && tipo && (
        <div className="space-y-2 text-sm">
          <Row label="Tipo" value={TIPOS[tipo].label} />
          <Row label="Secretaria" value={secretarias.find((s) => s.slug === secretariaSlug)?.nome ?? secretariaSlug} />
          <Row label="Título" value={titulo} />
          <Row label="Sigilo" value={sigilo ? "Sim" : "Não"} />
          <div className="border-b pb-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Relato</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{relato}</p>
          </div>
          <Card className="border-primary/20 bg-primary/5 p-3 text-xs">
            ✓ Prazo de resposta: até 5 dias úteis. Você será notificado a cada atualização.
          </Card>
        </div>
      )}
    </WizardShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b pb-2">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
