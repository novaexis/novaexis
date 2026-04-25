import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { WizardShell } from "@/components/cidadao/WizardShell";
import { CidadaoBottomNav } from "@/components/cidadao/CidadaoBottomNav";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Upload, FileCheck2, School } from "lucide-react";

export const Route = createFileRoute("/cidadao/educacao/matricular")({
  head: () => ({ meta: [{ title: "Solicitar Matrícula — NovaeXis" }] }),
  component: () => (
    <RoleGuard allowed={["cidadao", "superadmin"]} title="Matrícula" subtitle="Wizard">
      <WizardMatriculaPage />
      <CidadaoBottomNav />
    </RoleGuard>
  ),
});

interface Escola { id: string; nome: string; bairro: string | null }
interface Turma { id: string; escola_id: string; serie: string; turno: string; vagas_total: number; vagas_ocupadas: number }

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function WizardMatriculaPage() {
  const { user, profile } = useAuth();
  const nav = useNavigate();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [nomeAluno, setNomeAluno] = useState("");
  const [dataNasc, setDataNasc] = useState("");

  // Step 2
  const [busca, setBusca] = useState("");
  const [escolas, setEscolas] = useState<Escola[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [escolaId, setEscolaId] = useState<string | null>(null);
  const [turmaId, setTurmaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Step 3
  const [docCertidao, setDocCertidao] = useState<File | null>(null);
  const [docResidencia, setDocResidencia] = useState<File | null>(null);
  const [docHistorico, setDocHistorico] = useState<File | null>(null);

  useEffect(() => {
    if (!profile?.tenant_id || step !== 2 || escolas.length > 0) return;
    setLoading(true);
    void Promise.all([
      supabase.from("escolas").select("id, nome, bairro").eq("tenant_id", profile.tenant_id).eq("ativo", true),
      supabase.from("turmas").select("id, escola_id, serie, turno, vagas_total, vagas_ocupadas").eq("tenant_id", profile.tenant_id),
    ]).then(([e, t]) => {
      setEscolas((e.data ?? []) as Escola[]);
      setTurmas((t.data ?? []) as Turma[]);
      setLoading(false);
    });
  }, [step, profile?.tenant_id, escolas.length]);

  const escolasFiltradas = useMemo(
    () => escolas.filter((e) =>
      !busca ||
      e.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (e.bairro ?? "").toLowerCase().includes(busca.toLowerCase())
    ),
    [escolas, busca],
  );
  const turmasEscola = useMemo(
    () => turmas.filter((t) => t.escola_id === escolaId && t.vagas_total > t.vagas_ocupadas),
    [turmas, escolaId],
  );
  const escolaSel = useMemo(() => escolas.find((e) => e.id === escolaId), [escolas, escolaId]);
  const turmaSel = useMemo(() => turmas.find((t) => t.id === turmaId), [turmas, turmaId]);

  function handleFile(setter: (f: File | null) => void, label: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] ?? null;
      if (f && f.size > MAX_FILE_SIZE) {
        toast.error(`${label} excede 5 MB`);
        return;
      }
      setter(f);
    };
  }

  async function handleSubmit() {
    if (!user || !profile?.tenant_id || !escolaSel || !turmaSel || !docCertidao || !docResidencia) return;
    setSubmitting(true);
    try {
      // Recheck vagas
      const { data: turmaCheck } = await supabase
        .from("turmas")
        .select("vagas_total, vagas_ocupadas")
        .eq("id", turmaSel.id)
        .single();
      if (turmaCheck && turmaCheck.vagas_ocupadas >= turmaCheck.vagas_total) {
        toast.error("Vagas esgotadas", { description: "Esta turma lotou enquanto você preenchia. Escolha outra." });
        setSubmitting(false);
        setStep(2);
        setTurmaId(null);
        return;
      }

      const { data: matricula, error: e1 } = await supabase
        .from("matriculas")
        .insert({
          tenant_id: profile.tenant_id,
          responsavel_id: user.id,
          nome_aluno: nomeAluno.trim(),
          data_nascimento: dataNasc || null,
          escola: escolaSel.nome,
          serie: turmaSel.serie,
          turno: turmaSel.turno,
          status: "solicitada" as const,
        })
        .select("id")
        .single();
      if (e1) throw e1;

      const uploads: Promise<unknown>[] = [];
      const base = `${user.id}/${matricula.id}`;
      uploads.push(supabase.storage.from("matriculas").upload(`${base}/certidao_${docCertidao.name}`, docCertidao));
      uploads.push(supabase.storage.from("matriculas").upload(`${base}/residencia_${docResidencia.name}`, docResidencia));
      if (docHistorico) {
        uploads.push(supabase.storage.from("matriculas").upload(`${base}/historico_${docHistorico.name}`, docHistorico));
      }
      await Promise.all(uploads);

      toast.success("Solicitação enviada!", { description: `Aluno: ${nomeAluno}` });
      void nav({ to: "/cidadao/educacao" });
    } catch (err) {
      toast.error("Erro ao enviar", { description: String((err as Error).message) });
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    if (step === 1 && nomeAluno.trim() && dataNasc) setStep(2);
    else if (step === 2 && turmaId) setStep(3);
    else if (step === 3 && docCertidao && docResidencia) setStep(4);
    else if (step === 4) void handleSubmit();
  }
  function back() {
    if (step === 1) void nav({ to: "/cidadao/educacao" });
    else setStep((s) => s - 1);
  }

  const titles = ["Dados do aluno", "Escola e turma", "Documentos", "Confirmação"];
  const nextDisabled =
    (step === 1 && (!nomeAluno.trim() || !dataNasc)) ||
    (step === 2 && !turmaId) ||
    (step === 3 && (!docCertidao || !docResidencia));

  return (
    <WizardShell
      step={step}
      totalSteps={4}
      title={titles[step - 1]}
      onBack={back}
      onNext={next}
      nextLabel={step === 4 ? "Enviar solicitação" : "Continuar"}
      nextDisabled={nextDisabled}
      submitting={submitting}
    >
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome completo do aluno *</Label>
            <Input id="nome" value={nomeAluno} onChange={(e) => setNomeAluno(e.target.value)} placeholder="Maria Silva Santos" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="dn">Data de nascimento *</Label>
            <Input id="dn" type="date" value={dataNasc} onChange={(e) => setDataNasc(e.target.value)} className="mt-1" />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Input placeholder="Buscar por nome ou bairro" value={busca} onChange={(e) => setBusca(e.target.value)} />
          {loading ? (
            <div className="flex h-20 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-3">
              {escolasFiltradas.map((e) => {
                const turmasE = turmas.filter((t) => t.escola_id === e.id && t.vagas_total > t.vagas_ocupadas);
                const isSel = escolaId === e.id;
                return (
                  <div key={e.id}>
                    <button
                      type="button"
                      onClick={() => { setEscolaId(e.id); setTurmaId(null); }}
                      className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left ${
                        isSel ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      }`}
                    >
                      <School className="mt-0.5 h-5 w-5 text-indigo-500" />
                      <div>
                        <p className="text-sm font-semibold">{e.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.bairro ?? "—"} • {turmasE.length} turma{turmasE.length !== 1 ? "s" : ""} com vaga
                        </p>
                      </div>
                    </button>
                    {isSel && (
                      <div className="mt-2 grid grid-cols-1 gap-1.5 pl-3 sm:grid-cols-2">
                        {turmasEscola.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Sem turmas com vaga.</p>
                        ) : (
                          turmasEscola.map((t) => {
                            const restante = t.vagas_total - t.vagas_ocupadas;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setTurmaId(t.id)}
                                className={`flex items-center justify-between rounded border px-3 py-2 text-xs ${
                                  turmaId === t.id ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted/50"
                                }`}
                              >
                                <span>{t.serie} • {t.turno}</span>
                                {restante <= 5 ? (
                                  <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-destructive">Últimas {restante}</span>
                                ) : (
                                  <span className="text-muted-foreground">{restante} vagas</span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">PDF, JPG ou PNG até 5MB cada.</p>
          <FileSlot label="Certidão de nascimento *" file={docCertidao} onChange={handleFile(setDocCertidao, "Certidão")} />
          <FileSlot label="Comprovante de residência *" file={docResidencia} onChange={handleFile(setDocResidencia, "Comprovante")} />
          <FileSlot label="Histórico escolar (opcional)" file={docHistorico} onChange={handleFile(setDocHistorico, "Histórico")} />
        </div>
      )}

      {step === 4 && escolaSel && turmaSel && (
        <div className="space-y-2 text-sm">
          <Row label="Aluno" value={nomeAluno} />
          <Row label="Nascimento" value={new Date(dataNasc).toLocaleDateString("pt-BR")} />
          <Row label="Escola" value={escolaSel.nome} />
          <Row label="Série / Turno" value={`${turmaSel.serie} • ${turmaSel.turno}`} />
          <Row label="Documentos" value={`${[docCertidao, docResidencia, docHistorico].filter(Boolean).length} arquivos`} />
          <Card className="mt-2 border-primary/20 bg-primary/5 p-3 text-xs">
            ✓ Você receberá uma notificação quando a Secretaria de Educação avaliar sua solicitação.
          </Card>
        </div>
      )}
    </WizardShell>
  );
}

function FileSlot({ label, file, onChange }: { label: string; file: File | null; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-3 transition hover:bg-muted/50">
      {file ? <FileCheck2 className="h-5 w-5 text-success" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{file ? file.name : "Toque para enviar"}</p>
      </div>
      <input type="file" accept=".pdf,image/*" className="hidden" onChange={onChange} />
    </label>
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
