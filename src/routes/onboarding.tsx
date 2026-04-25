import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  Rocket,
  User,
} from "lucide-react";
import { SECRETARIAS_MUNICIPAIS } from "@/lib/secretarias-municipais";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding — NovaeXis" },
      { name: "description", content: "Configure seu município no NovaeXis em 5 passos." },
    ],
  }),
  component: OnboardingPage,
});

interface IbgeMunicipio {
  id: number;
  nome: string;
  microrregiao: { mesorregiao: { UF: { sigla: string; nome: string } } };
}

const PLANOS = [
  {
    id: "basico" as const,
    nome: "Básico",
    preco: "R$ 1.490",
    sub: "/mês",
    bullets: ["Até 3 secretarias", "1.000 demandas/mês", "Suporte por email"],
  },
  {
    id: "completo" as const,
    nome: "Completo",
    preco: "R$ 3.990",
    sub: "/mês",
    bullets: ["Secretarias ilimitadas", "Demandas ilimitadas", "IA + Social", "Suporte prioritário"],
    destaque: true,
  },
  {
    id: "estado" as const,
    nome: "Estado",
    preco: "Sob consulta",
    sub: "",
    bullets: ["Painel do Governador", "Multi-município", "SLA dedicado"],
  },
];

const STEPS = [
  { id: 1, titulo: "Município", icone: MapPin },
  { id: 2, titulo: "Prefeito", icone: User },
  { id: 3, titulo: "Secretarias", icone: Building2 },
  { id: 4, titulo: "Plano", icone: CreditCard },
  { id: 5, titulo: "Pronto!", icone: Rocket },
];

function OnboardingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [municipioBusca, setMunicipioBusca] = useState("");
  const [municipios, setMunicipios] = useState<IbgeMunicipio[]>([]);
  const [municipioSel, setMunicipioSel] = useState<IbgeMunicipio | null>(null);
  const [populacao, setPopulacao] = useState("");
  const [open, setOpen] = useState(false);
  const [loadingIbge, setLoadingIbge] = useState(false);

  // Step 2
  const [prefeitoNome, setPrefeitoNome] = useState("");
  const [prefeitoTelefone, setPrefeitoTelefone] = useState("");

  // Step 3
  const [secretariasSel, setSecretariasSel] = useState<string[]>([
    "saude",
    "educacao",
    "infraestrutura",
  ]);

  // Step 4
  const [plano, setPlano] = useState<"basico" | "completo" | "estado">("completo");

  // Step 5
  const [tenantCriadoId, setTenantCriadoId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: "/login", search: { redirect: "/onboarding" } as never });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (municipioBusca.length < 2) {
      setMunicipios([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoadingIbge(true);
      try {
        const res = await fetch(
          "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome",
        );
        const all: IbgeMunicipio[] = await res.json();
        const f = all
          .filter((m) => m.nome.toLowerCase().includes(municipioBusca.toLowerCase()))
          .slice(0, 30);
        setMunicipios(f);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingIbge(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [municipioBusca]);

  const progresso = useMemo(() => ((step - 1) / (STEPS.length - 1)) * 100, [step]);

  function podeAvancar(): boolean {
    if (step === 1) return !!municipioSel;
    if (step === 2) return prefeitoNome.trim().length >= 3;
    if (step === 3) return secretariasSel.length > 0;
    if (step === 4) return !!plano;
    return true;
  }

  function toggleSecretaria(slug: string) {
    setSecretariasSel((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  async function finalizar() {
    if (!municipioSel) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("onboarding-tenant", {
        body: {
          municipio: {
            nome: municipioSel.nome,
            uf: municipioSel.microrregiao.mesorregiao.UF.sigla,
            ibge_code: String(municipioSel.id),
            populacao: populacao ? Number(populacao) : null,
          },
          prefeito: {
            nome: prefeitoNome,
            telefone: prefeitoTelefone || null,
          },
          secretarias: secretariasSel,
          plano,
          trial_dias: 14,
        },
      });
      if (error) throw error;
      setTenantCriadoId(data?.tenant_id ?? null);
      toast.success("Município configurado! Trial de 14 dias ativado.");
      setStep(5);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no onboarding");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b border-border/50 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Logo />
          <Badge variant="outline" className="gap-1">
            Passo {step} de {STEPS.length}
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Progress value={progresso} className="mb-2 h-1.5" />
        <ol className="mb-8 flex justify-between text-xs">
          {STEPS.map((s) => {
            const Icon = s.icone;
            const ativo = s.id === step;
            const completo = s.id < step;
            return (
              <li
                key={s.id}
                className={cn(
                  "flex flex-col items-center gap-1",
                  ativo && "text-primary",
                  completo && "text-emerald-500",
                  !ativo && !completo && "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border",
                    ativo && "border-primary bg-primary/10",
                    completo && "border-emerald-500 bg-emerald-500/10",
                  )}
                >
                  {completo ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                </span>
                <span className="hidden sm:inline">{s.titulo}</span>
              </li>
            );
          })}
        </ol>

        <Card className="p-6 sm:p-8">
          {step === 1 && (
            <>
              <h2 className="text-xl font-semibold">Qual é o seu município?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Buscamos na base do IBGE.
              </p>
              <div className="mt-5 space-y-4">
                <div>
                  <Label>Município</Label>
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="mt-1.5 w-full justify-between font-normal"
                      >
                        {municipioSel
                          ? `${municipioSel.nome} — ${municipioSel.microrregiao.mesorregiao.UF.sigla}`
                          : "Digite ao menos 2 letras…"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Ex.: Belém"
                          value={municipioBusca}
                          onValueChange={setMunicipioBusca}
                        />
                        <CommandList>
                          {loadingIbge && (
                            <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                              Buscando…
                            </div>
                          )}
                          {!loadingIbge && municipioBusca.length < 2 && (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              Comece a digitar…
                            </div>
                          )}
                          {!loadingIbge && municipioBusca.length >= 2 && (
                            <CommandEmpty>Nenhum município encontrado.</CommandEmpty>
                          )}
                          <CommandGroup>
                            {municipios.map((m) => (
                              <CommandItem
                                key={m.id}
                                value={String(m.id)}
                                onSelect={() => {
                                  setMunicipioSel(m);
                                  setOpen(false);
                                }}
                              >
                                {m.nome} —{" "}
                                <span className="ml-1 text-muted-foreground">
                                  {m.microrregiao.mesorregiao.UF.sigla}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="pop">População estimada (opcional)</Label>
                  <Input
                    id="pop"
                    type="number"
                    className="mt-1.5"
                    placeholder="Ex.: 25000"
                    value={populacao}
                    onChange={(e) => setPopulacao(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-xl font-semibold">Quem é o prefeito(a)?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Você será o administrador inicial deste município.
              </p>
              <div className="mt-5 space-y-4">
                <div>
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input
                    id="nome"
                    className="mt-1.5"
                    value={prefeitoNome}
                    onChange={(e) => setPrefeitoNome(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="tel">Telefone (opcional)</Label>
                  <Input
                    id="tel"
                    className="mt-1.5"
                    placeholder="(91) 99999-9999"
                    value={prefeitoTelefone}
                    onChange={(e) => setPrefeitoTelefone(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-xl font-semibold">Quais secretarias ativar?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Você pode ativar mais depois. Sugerimos as essenciais.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {Object.values(SECRETARIAS_MUNICIPAIS).map((s) => {
                  const Icon = s.icon;
                  const sel = secretariasSel.includes(s.slug);
                  return (
                    <button
                      key={s.slug}
                      type="button"
                      onClick={() => toggleSecretaria(s.slug)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 text-left transition",
                        sel
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <Icon className={cn("h-5 w-5", s.cor)} />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{s.nome}</p>
                      </div>
                      <Checkbox checked={sel} onCheckedChange={() => toggleSecretaria(s.slug)} />
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-xl font-semibold">Escolha um plano</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                14 dias grátis. Cobrança só ao final do trial.{" "}
                <span className="text-amber-600">
                  (Pagamento online em breve — por enquanto entraremos em contato.)
                </span>
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {PLANOS.map((p) => {
                  const sel = plano === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlano(p.id)}
                      className={cn(
                        "rounded-lg border p-4 text-left transition",
                        sel
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:border-primary/40",
                        p.destaque && !sel && "border-primary/50",
                      )}
                    >
                      {p.destaque && (
                        <Badge className="mb-2" variant="default">
                          Recomendado
                        </Badge>
                      )}
                      <p className="text-sm font-semibold">{p.nome}</p>
                      <p className="mt-1">
                        <span className="text-2xl font-bold">{p.preco}</span>
                        <span className="text-xs text-muted-foreground">{p.sub}</span>
                      </p>
                      <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                        {p.bullets.map((b) => (
                          <li key={b} className="flex gap-1.5">
                            <Check className="h-3 w-3 shrink-0 text-emerald-500 mt-0.5" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 5 && (
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              </div>
              <h2 className="mt-4 text-xl font-semibold">Tudo pronto!</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Seu município <strong>{municipioSel?.nome}</strong> está ativo. Você tem{" "}
                <strong>14 dias de trial</strong>.
              </p>
              <div className="mt-6 grid gap-2 text-left text-sm">
                <ChecklistItem feito>Município criado</ChecklistItem>
                <ChecklistItem feito>{secretariasSel.length} secretarias ativadas</ChecklistItem>
                <ChecklistItem>Convide os secretários (em /prefeito)</ChecklistItem>
                <ChecklistItem>Importe seus dados iniciais</ChecklistItem>
                <ChecklistItem>Configure monitoramento social</ChecklistItem>
              </div>
              <Button
                size="lg"
                className="mt-6 w-full"
                onClick={() => navigate({ to: "/prefeito" })}
              >
                Ir para o painel do Prefeito
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              {tenantCriadoId && (
                <p className="mt-2 text-xs text-muted-foreground">ID: {tenantCriadoId}</p>
              )}
            </div>
          )}

          {step < 5 && (
            <div className="mt-8 flex justify-between gap-2">
              <Button
                variant="ghost"
                disabled={step === 1 || submitting}
                onClick={() => setStep((s) => Math.max(1, s - 1))}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              {step < 4 ? (
                <Button
                  disabled={!podeAvancar()}
                  onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}
                >
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button disabled={!podeAvancar() || submitting} onClick={finalizar}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Ativar trial de 14 dias
                </Button>
              )}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}

function ChecklistItem({
  children,
  feito = false,
}: {
  children: React.ReactNode;
  feito?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full border",
          feito
            ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
            : "border-muted-foreground/30 text-muted-foreground",
        )}
      >
        {feito ? <Check className="h-3 w-3" /> : <span className="text-xs">·</span>}
      </span>
      <span className={cn(feito ? "text-foreground" : "text-muted-foreground")}>{children}</span>
    </div>
  );
}
