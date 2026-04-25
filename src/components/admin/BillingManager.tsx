import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  CreditCard,
  Search,
  Pencil,
  CheckCircle2,
  Circle,
  Sparkles,
  Info,
} from "lucide-react";

type Plano = "basico" | "completo" | "estado";

interface TenantBilling {
  id: string;
  nome: string;
  slug: string;
  estado: string;
  plano: Plano | null;
  ativo: boolean;
  populacao: number | null;
  stripe_subscription_id: string | null;
}

interface PlanoSpec {
  id: Plano;
  nome: string;
  precoMensal: number;
  descricao: string;
  destaque?: boolean;
  features: string[];
}

const PLANOS: PlanoSpec[] = [
  {
    id: "basico",
    nome: "Básico",
    precoMensal: 1490,
    descricao: "Para municípios começando a digitalizar a gestão.",
    features: [
      "Até 3 secretarias",
      "App do cidadão (ouvidoria, serviços)",
      "KPIs essenciais",
      "Relatórios mensais",
      "Suporte por email",
    ],
  },
  {
    id: "completo",
    nome: "Completo",
    precoMensal: 3990,
    destaque: true,
    descricao: "Plataforma completa para prefeituras médias e grandes.",
    features: [
      "Secretarias ilimitadas",
      "App do cidadão completo (saúde, educação)",
      "Captação de recursos com IA",
      "Briefings semanais automáticos",
      "Escuta social + score de aprovação",
      "Suporte prioritário",
    ],
  },
  {
    id: "estado",
    nome: "Estado",
    precoMensal: 24900,
    descricao: "Para governos estaduais — visão consolidada de todos municípios.",
    features: [
      "Painel do Governador",
      "Repasses estaduais e benchmark",
      "Agente IA estratégico",
      "Onboarding e treinamento dedicados",
      "SLA empresarial",
    ],
  },
];

const PLANO_COLOR: Record<Plano, string> = {
  basico: "bg-muted text-muted-foreground",
  completo: "bg-primary/15 text-primary",
  estado: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
};

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function BillingManager() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TenantBilling[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroPlano, setFiltroPlano] = useState<"todos" | Plano>("todos");
  const [editing, setEditing] = useState<TenantBilling | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tenants")
      .select("id, nome, slug, estado, plano, ativo, populacao, stripe_subscription_id")
      .order("nome");
    if (error) toast.error("Erro ao carregar tenants");
    setRows((data ?? []) as TenantBilling[]);
    setLoading(false);
  }

  const filtrados = rows.filter((r) => {
    if (filtroPlano !== "todos" && r.plano !== filtroPlano) return false;
    if (!busca) return true;
    const q = busca.toLowerCase();
    return r.nome.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q);
  });

  const mrr = useMemo(() => {
    return rows
      .filter((r) => r.ativo && r.plano)
      .reduce((acc, r) => {
        const spec = PLANOS.find((p) => p.id === r.plano);
        return acc + (spec?.precoMensal ?? 0);
      }, 0);
  }, [rows]);

  const distrib = useMemo(() => {
    const out: Record<Plano | "sem", number> = {
      basico: 0,
      completo: 0,
      estado: 0,
      sem: 0,
    };
    for (const r of rows) {
      if (!r.ativo) continue;
      if (r.plano) out[r.plano]++;
      else out.sem++;
    }
    return out;
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* Aviso de Stripe não configurado */}
      <Card className="flex items-start gap-3 border-primary/30 bg-primary/5 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="flex-1 text-sm">
          <p className="font-medium text-foreground">
            Estrutura pronta — Stripe ainda não ativado
          </p>
          <p className="mt-1 text-muted-foreground">
            A gestão de planos abaixo já funciona (alterações são salvas no banco). Quando
            quiser cobrar de verdade, ative Lovable Payments / Stripe e a integração
            sincroniza automaticamente as assinaturas via{" "}
            <code className="rounded bg-background px-1 py-0.5 text-xs">
              stripe_subscription_id
            </code>
            .
          </p>
        </div>
      </Card>

      {/* KPIs de receita */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <CreditCard className="h-5 w-5 text-primary" />
          <p className="mt-3 text-xs uppercase text-muted-foreground">MRR estimado</p>
          <p className="font-mono text-2xl font-semibold tabular-nums">
            {formatBRL(mrr)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            ARR ≈ {formatBRL(mrr * 12)}
          </p>
        </Card>
        <Card className="p-4">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
          <p className="mt-3 text-xs uppercase text-muted-foreground">Básico</p>
          <p className="font-mono text-2xl font-semibold tabular-nums">
            {distrib.basico}
          </p>
        </Card>
        <Card className="p-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <p className="mt-3 text-xs uppercase text-muted-foreground">Completo</p>
          <p className="font-mono text-2xl font-semibold tabular-nums">
            {distrib.completo}
          </p>
        </Card>
        <Card className="p-4">
          <Sparkles className="h-5 w-5 text-purple-500" />
          <p className="mt-3 text-xs uppercase text-muted-foreground">Estado</p>
          <p className="font-mono text-2xl font-semibold tabular-nums">
            {distrib.estado}
          </p>
        </Card>
      </div>

      {/* Cards de planos */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Catálogo de planos
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PLANOS.map((p) => (
            <Card
              key={p.id}
              className={`relative p-5 ${
                p.destaque ? "border-primary ring-1 ring-primary/30" : ""
              }`}
            >
              {p.destaque && (
                <span className="absolute -top-2 left-5 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                  Mais popular
                </span>
              )}
              <h3 className="text-lg font-semibold">{p.nome}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{p.descricao}</p>
              <div className="my-4">
                <span className="font-mono text-3xl font-bold tabular-nums">
                  {formatBRL(p.precoMensal)}
                </span>
                <span className="text-sm text-muted-foreground"> /mês</span>
              </div>
              <ul className="space-y-1.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar município…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={filtroPlano}
          onValueChange={(v) => setFiltroPlano(v as typeof filtroPlano)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os planos</SelectItem>
            <SelectItem value="basico">Básico</SelectItem>
            <SelectItem value="completo">Completo</SelectItem>
            <SelectItem value="estado">Estado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela de assinaturas */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-10 text-center">
          <CreditCard className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma assinatura.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Município</th>
                <th className="px-3 py-2 text-left">Plano</th>
                <th className="px-3 py-2 text-right">Valor/mês</th>
                <th className="px-3 py-2 text-left">Stripe</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((t) => {
                const spec = PLANOS.find((p) => p.id === t.plano);
                return (
                  <tr key={t.id} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="px-3 py-2.5">
                      <p className="font-medium">{t.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.estado} · {t.populacao?.toLocaleString("pt-BR") ?? "—"} hab.
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      {t.plano ? (
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PLANO_COLOR[t.plano]}`}
                        >
                          {spec?.nome}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem plano</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {spec ? formatBRL(spec.precoMensal) : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {t.stripe_subscription_id ? (
                        <span className="inline-flex items-center gap-1 text-xs text-primary">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Conectado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Circle className="h-3.5 w-3.5" /> Não conectado
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={t.ativo ? "default" : "secondary"}>
                        {t.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditing(t)}
                          aria-label="Alterar plano"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PlanoDialog
        tenant={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await load();
        }}
      />
    </div>
  );
}

interface DialogProps {
  tenant: TenantBilling | null;
  onClose: () => void;
  onSaved: () => void;
}

function PlanoDialog({ tenant, onClose, onSaved }: DialogProps) {
  const [plano, setPlano] = useState<Plano>("basico");
  const [stripeId, setStripeId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tenant) {
      setPlano((tenant.plano ?? "basico") as Plano);
      setStripeId(tenant.stripe_subscription_id ?? "");
    }
  }, [tenant]);

  async function salvar() {
    if (!tenant) return;
    setSaving(true);
    const { error } = await supabase
      .from("tenants")
      .update({
        plano,
        stripe_subscription_id: stripeId.trim() || null,
      })
      .eq("id", tenant.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Assinatura atualizada");
    onSaved();
  }

  return (
    <Dialog open={!!tenant} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar assinatura — {tenant?.nome}</DialogTitle>
          <DialogDescription>
            Defina o plano contratado e (opcionalmente) o ID da assinatura Stripe.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Plano</Label>
            <Select value={plano} onValueChange={(v) => setPlano(v as Plano)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLANOS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome} — {formatBRL(p.precoMensal)}/mês
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="stripe">Stripe Subscription ID (opcional)</Label>
            <Input
              id="stripe"
              placeholder="sub_xxx…"
              value={stripeId}
              onChange={(e) => setStripeId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Preencha quando o Stripe estiver ativo. Será usado para sincronizar
              status, faturas e cancelamentos.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
