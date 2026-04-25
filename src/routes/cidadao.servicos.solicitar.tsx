import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { WizardShell } from "@/components/cidadao/WizardShell";
import { CidadaoBottomNav } from "@/components/cidadao/CidadaoBottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { gerarProtocolo } from "@/lib/protocolo";
import {
  Loader2, MapPin, Camera, Wrench, Trash2, Shield, Heart, HandHeart, FileText, Crosshair,
} from "lucide-react";

export const Route = createFileRoute("/cidadao/servicos/solicitar")({
  head: () => ({ meta: [{ title: "Solicitar Serviço — NovaeXis" }] }),
  component: () => (
    <RoleGuard allowed={["cidadao", "superadmin"]} title="Solicitar Serviço" subtitle="Wizard">
      <WizardServicoPage />
      <CidadaoBottomNav />
    </RoleGuard>
  ),
});

interface TipoServico {
  id: string;
  categoria: string;
  nome: string;
  secretaria_slug: string;
  prazo_sla_dias: number;
  requer_localizacao: boolean;
  requer_foto: boolean;
}

const CAT_ICONS: Record<string, { icon: typeof Wrench; color: string }> = {
  Infraestrutura: { icon: Wrench, color: "text-amber-500" },
  "Limpeza Urbana": { icon: Trash2, color: "text-emerald-500" },
  Segurança: { icon: Shield, color: "text-rose-500" },
  Saúde: { icon: Heart, color: "text-pink-500" },
  "Assistência Social": { icon: HandHeart, color: "text-indigo-500" },
  Documentação: { icon: FileText, color: "text-slate-500" },
  Ouvidoria: { icon: FileText, color: "text-primary" },
};

const MAX_PHOTO = 10 * 1024 * 1024;

function WizardServicoPage() {
  const { user, profile } = useAuth();
  const nav = useNavigate();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [tipos, setTipos] = useState<TipoServico[]>([]);
  const [loading, setLoading] = useState(true);

  const [categoria, setCategoria] = useState<string | null>(null);
  const [tipoId, setTipoId] = useState<string | null>(null);
  const [descricao, setDescricao] = useState("");
  const [endereco, setEndereco] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string>("");

  useEffect(() => {
    if (!profile?.tenant_id) return;
    void supabase
      .from("tipos_servico")
      .select("id, categoria, nome, secretaria_slug, prazo_sla_dias, requer_localizacao, requer_foto")
      .eq("ativo", true)
      .neq("categoria", "Ouvidoria")
      .then(({ data }) => {
        setTipos((data ?? []) as TipoServico[]);
        setLoading(false);
      });
    void supabase
      .from("tenants")
      .select("slug")
      .eq("id", profile.tenant_id)
      .maybeSingle()
      .then(({ data }) => setTenantSlug((data as { slug?: string } | null)?.slug ?? "MUN"));
  }, [profile?.tenant_id]);

  const categorias = useMemo(() => Array.from(new Set(tipos.map((t) => t.categoria))), [tipos]);
  const tiposCat = useMemo(() => tipos.filter((t) => t.categoria === categoria), [tipos, categoria]);
  const tipoSel = useMemo(() => tipos.find((t) => t.id === tipoId), [tipos, tipoId]);

  function pegarLocalizacao() {
    if (!navigator.geolocation) {
      toast.error("Geolocalização não disponível");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success("Localização capturada");
      },
      () => toast.error("Não foi possível obter localização. Use o campo de endereço."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function handleSubmit() {
    if (!user || !profile?.tenant_id || !tipoSel) return;
    setSubmitting(true);
    try {
      const protocolo = gerarProtocolo(tenantSlug);
      const prazoSLA = new Date();
      prazoSLA.setDate(prazoSLA.getDate() + tipoSel.prazo_sla_dias);

      const { data: demanda, error: e1 } = await supabase
        .from("demandas")
        .insert({
          tenant_id: profile.tenant_id,
          cidadao_id: user.id,
          secretaria_slug: tipoSel.secretaria_slug,
          protocolo,
          tipo: "servico" as never,
          titulo: tipoSel.nome,
          descricao: descricao.trim(),
          status: "aberta" as const,
          prioridade: "media" as const,
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
          endereco: endereco || null,
          prazo_sla: prazoSLA.toISOString(),
        })
        .select("id")
        .single();
      if (e1) throw e1;

      if (foto) {
        const path = `${user.id}/${demanda.id}/foto_${foto.name}`;
        await supabase.storage.from("demandas").upload(path, foto);
      }

      toast.success("Solicitação registrada!", { description: `Protocolo: ${protocolo}` });
      void nav({ to: "/cidadao/demanda/$id", params: { id: demanda.id } });
    } catch (err) {
      toast.error("Erro ao enviar", { description: String((err as Error).message) });
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    if (step === 1 && categoria) setStep(2);
    else if (step === 2 && tipoId) setStep(3);
    else if (step === 3 && descricao.trim().length >= 20) {
      if (tipoSel?.requer_foto && !foto) {
        toast.error("Foto é obrigatória para este tipo de serviço");
        return;
      }
      if (tipoSel?.requer_localizacao && !coords && !endereco) {
        toast.error("Localização ou endereço é obrigatório");
        return;
      }
      setStep(4);
    } else if (step === 4) void handleSubmit();
  }
  function back() {
    if (step === 1) void nav({ to: "/cidadao/servicos" });
    else setStep((s) => s - 1);
  }

  const titles = ["Categoria", "Tipo de serviço", "Detalhes", "Confirmação"];

  return (
    <WizardShell
      step={step}
      totalSteps={4}
      title={titles[step - 1]}
      onBack={back}
      onNext={next}
      nextLabel={step === 4 ? "Enviar solicitação" : "Continuar"}
      nextDisabled={
        (step === 1 && !categoria) ||
        (step === 2 && !tipoId) ||
        (step === 3 && descricao.trim().length < 20)
      }
      submitting={submitting}
    >
      {step === 1 && (
        loading ? (
          <div className="flex h-20 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {categorias.map((c) => {
              const Icon = (CAT_ICONS[c] ?? CAT_ICONS.Documentação).icon;
              const color = (CAT_ICONS[c] ?? CAT_ICONS.Documentação).color;
              const active = categoria === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setCategoria(c); setTipoId(null); }}
                  className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition ${
                    active ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:bg-muted/50"
                  }`}
                >
                  <Icon className={`h-7 w-7 ${color}`} />
                  <span className="text-xs font-semibold leading-tight">{c}</span>
                </button>
              );
            })}
          </div>
        )
      )}

      {step === 2 && (
        <div className="space-y-2">
          {tiposCat.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTipoId(t.id)}
              className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition ${
                tipoId === t.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">{t.nome}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Prazo estimado: {t.prazo_sla_dias} dias úteis</p>
              </div>
              <div className="flex shrink-0 gap-1">
                {t.requer_localizacao && <MapPin className="h-4 w-4 text-rose-500" />}
                {t.requer_foto && <Camera className="h-4 w-4 text-amber-500" />}
              </div>
            </button>
          ))}
        </div>
      )}

      {step === 3 && tipoSel && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="desc">Descreva o problema *</Label>
            <Textarea
              id="desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva com detalhes o que está acontecendo..."
              className="mt-1 min-h-28"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {descricao.trim().length} / mínimo 20 caracteres
            </p>
          </div>

          {tipoSel.requer_localizacao && (
            <div className="space-y-2">
              <Label>Localização *</Label>
              <Button type="button" variant="outline" onClick={pegarLocalizacao} className="w-full gap-2">
                <Crosshair className="h-4 w-4" />
                {coords ? `GPS: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "Usar minha localização"}
              </Button>
              <Input
                placeholder="Ou digite o endereço (rua, número, bairro)"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
              />
            </div>
          )}

          {tipoSel.requer_foto && (
            <div>
              <Label>Foto do problema *</Label>
              <label className="mt-1 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-3 hover:bg-muted/50">
                <Camera className="h-5 w-5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{foto ? foto.name : "Tirar ou enviar foto"}</p>
                  <p className="text-xs text-muted-foreground">JPG ou PNG até 10 MB</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f && f.size > MAX_PHOTO) {
                      toast.error("Foto excede 10 MB");
                      return;
                    }
                    setFoto(f);
                  }}
                />
              </label>
            </div>
          )}
        </div>
      )}

      {step === 4 && tipoSel && (
        <div className="space-y-2 text-sm">
          <Row label="Categoria" value={tipoSel.categoria} />
          <Row label="Tipo" value={tipoSel.nome} />
          <Row label="Prazo estimado" value={`${tipoSel.prazo_sla_dias} dias úteis`} />
          {coords && <Row label="GPS" value={`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`} />}
          {endereco && <Row label="Endereço" value={endereco} />}
          {foto && <Row label="Foto" value={foto.name} />}
          <div className="border-b pb-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Descrição</p>
            <p className="mt-1 text-sm">{descricao}</p>
          </div>
          <Card className="mt-2 border-primary/20 bg-primary/5 p-3 text-xs">
            ✓ Você receberá um protocolo após confirmar e poderá acompanhar o andamento.
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
