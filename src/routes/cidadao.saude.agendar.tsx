import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { WizardShell } from "@/components/cidadao/WizardShell";
import { CidadaoBottomNav } from "@/components/cidadao/CidadaoBottomNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, Stethoscope, FlaskConical, Syringe, MapPin, Loader2 } from "lucide-react";

export const Route = createFileRoute("/cidadao/saude/agendar")({
  head: () => ({
    meta: [{ title: "Agendar Saúde — NovaeXis" }],
  }),
  component: () => (
    <RoleGuard allowed={["cidadao", "superadmin"]} title="Agendar Saúde" subtitle="Wizard">
      <WizardSaudePage />
      <CidadaoBottomNav />
    </RoleGuard>
  ),
});

type Tipo = "consulta" | "exame" | "vacina";
interface Unidade { id: string; nome: string; tipo: string; bairro: string | null; endereco: string | null }
interface Slot { id: string; data_hora: string; especialidade: string | null }

const TIPO_ICONS: Record<Tipo, { icon: typeof Stethoscope; label: string; color: string }> = {
  consulta: { icon: Stethoscope, label: "Consulta", color: "text-rose-500" },
  exame: { icon: FlaskConical, label: "Exame", color: "text-amber-500" },
  vacina: { icon: Syringe, label: "Vacina", color: "text-emerald-500" },
};

function WizardSaudePage() {
  const { user, profile } = useAuth();
  const nav = useNavigate();

  const [step, setStep] = useState(1);
  const [tipo, setTipo] = useState<Tipo | null>(null);
  const [especialidade, setEspecialidade] = useState("");
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [unidadeId, setUnidadeId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [loadingUni, setLoadingUni] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile?.tenant_id || step !== 2 || unidades.length > 0) return;
    setLoadingUni(true);
    void supabase
      .from("unidades_saude")
      .select("id, nome, tipo, bairro, endereco")
      .eq("tenant_id", profile.tenant_id)
      .eq("ativo", true)
      .then(({ data }) => {
        setUnidades((data ?? []) as Unidade[]);
        setLoadingUni(false);
      });
  }, [step, profile?.tenant_id, unidades.length]);

  useEffect(() => {
    if (!unidadeId || !tipo) return;
    setLoadingSlots(true);
    void supabase
      .from("agenda_saude")
      .select("id, data_hora, especialidade")
      .eq("unidade_id", unidadeId)
      .eq("tipo", tipo)
      .eq("disponivel", true)
      .gte("data_hora", new Date().toISOString())
      .order("data_hora")
      .limit(40)
      .then(({ data }) => {
        setSlots((data ?? []) as Slot[]);
        setLoadingSlots(false);
      });
  }, [unidadeId, tipo]);

  const unidadeSel = useMemo(() => unidades.find((u) => u.id === unidadeId), [unidades, unidadeId]);
  const slotSel = useMemo(() => slots.find((s) => s.id === slotId), [slots, slotId]);

  async function handleConfirm() {
    if (!user || !profile?.tenant_id || !slotSel || !unidadeSel || !tipo) return;
    setSubmitting(true);
    try {
      const { data: ag, error: e1 } = await supabase
        .from("agendamentos_saude")
        .insert({
          cidadao_id: user.id,
          tenant_id: profile.tenant_id,
          unidade_saude: unidadeSel.nome,
          tipo,
          especialidade: especialidade || slotSel.especialidade,
          data_hora: slotSel.data_hora,
          status: "agendado" as const,
        })
        .select("id")
        .single();
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("agenda_saude")
        .update({ disponivel: false, agendamento_id: ag.id })
        .eq("id", slotSel.id);
      if (e2) throw e2;
      toast.success("Agendamento confirmado!", {
        description: `${TIPO_ICONS[tipo].label} em ${new Date(slotSel.data_hora).toLocaleString("pt-BR")}`,
      });
      void nav({ to: "/cidadao/saude" });
    } catch (err) {
      toast.error("Não foi possível agendar", { description: String((err as Error).message) });
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    if (step === 1 && tipo) setStep(2);
    else if (step === 2 && slotId) setStep(3);
    else if (step === 3) void handleConfirm();
  }
  function back() {
    if (step === 1) void nav({ to: "/cidadao/saude" });
    else setStep((s) => s - 1);
  }

  const titles = ["O que você precisa?", "Escolha unidade e horário", "Confirmação"];
  const nextDisabled =
    (step === 1 && !tipo) ||
    (step === 2 && !slotId);

  return (
    <WizardShell
      step={step}
      totalSteps={3}
      title={titles[step - 1]}
      subtitle={
        step === 1
          ? "Selecione o tipo de atendimento"
          : step === 2
            ? "Apenas horários disponíveis aparecem na lista"
            : "Confira os dados antes de confirmar"
      }
      onBack={back}
      onNext={next}
      nextLabel={step === 3 ? "Confirmar agendamento" : "Continuar"}
      nextDisabled={nextDisabled}
      submitting={submitting}
    >
      {step === 1 && (
        <div className="space-y-3">
          <div className="grid gap-2.5">
            {(Object.keys(TIPO_ICONS) as Tipo[]).map((k) => {
              const Icon = TIPO_ICONS[k].icon;
              const active = tipo === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTipo(k)}
                  className={`flex items-center gap-4 rounded-lg border p-4 text-left transition ${
                    active ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:bg-muted/50"
                  }`}
                >
                  <Icon className={`h-7 w-7 ${TIPO_ICONS[k].color}`} />
                  <span className="text-base font-semibold">{TIPO_ICONS[k].label}</span>
                  {active && <CheckCircle2 className="ml-auto h-5 w-5 text-primary" />}
                </button>
              );
            })}
          </div>
          {tipo === "consulta" && (
            <div className="pt-2">
              <Label htmlFor="esp">Especialidade (opcional)</Label>
              <Input
                id="esp"
                value={especialidade}
                onChange={(e) => setEspecialidade(e.target.value)}
                placeholder="Clínico geral, pediatria, ginecologia..."
                className="mt-1"
              />
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Unidade
            </p>
            {loadingUni ? (
              <div className="flex h-16 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : unidades.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma unidade cadastrada.</p>
            ) : (
              <div className="space-y-2">
                {unidades.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => { setUnidadeId(u.id); setSlotId(null); }}
                    className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${
                      unidadeId === u.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{u.nome}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                        {u.tipo}{u.bairro ? ` • ${u.bairro}` : ""}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {unidadeId && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Horários disponíveis
              </p>
              {loadingSlots ? (
                <div className="flex h-16 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : slots.length === 0 ? (
                <p className="rounded border bg-muted/30 p-3 text-sm text-muted-foreground">
                  Sem horários disponíveis para este tipo nesta unidade.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {slots.map((s) => {
                    const d = new Date(s.data_hora);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSlotId(s.id)}
                        className={`rounded-lg border p-2.5 text-xs transition ${
                          slotId === s.id ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted/50"
                        }`}
                      >
                        <p>{d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</p>
                        <p className="mt-0.5 text-muted-foreground">{d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {step === 3 && tipo && slotSel && unidadeSel && (
        <div className="space-y-3 text-sm">
          <Row label="Tipo" value={TIPO_ICONS[tipo].label + (especialidade ? ` — ${especialidade}` : "")} />
          <Row label="Unidade" value={unidadeSel.nome} />
          {unidadeSel.bairro && <Row label="Bairro" value={unidadeSel.bairro} />}
          <Row
            label="Data e hora"
            value={new Date(slotSel.data_hora).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}
          />
          <Card className="mt-2 border-primary/20 bg-primary/5 p-3 text-xs">
            ✓ Ao confirmar, o horário será reservado em seu nome. Você pode cancelar até 24h antes.
          </Card>
        </div>
      )}
    </WizardShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b pb-2 last:border-b-0">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
