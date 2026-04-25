import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Save,
  Plus,
  Trash2,
  Settings,
  Flag,
  Gauge,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

type PlatformSetting = {
  id: string;
  chave: string;
  valor: Record<string, unknown>;
  descricao: string | null;
};
type FeatureFlag = {
  id: string;
  chave: string;
  nome: string;
  descricao: string | null;
  habilitada: boolean;
  planos_permitidos: string[] | null;
};
type PlanLimit = {
  id: string;
  plano: "basico" | "completo" | "estado";
  chave: string;
  valor: number;
  descricao: string | null;
};

const PLANOS: PlanLimit["plano"][] = ["basico", "completo", "estado"];

export function ConfigGlobaisManager() {
  const [tab, setTab] = useState<"settings" | "flags" | "limits">("settings");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={tab === "settings" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("settings")}
          className="gap-2"
        >
          <Settings className="h-4 w-4" /> Plataforma
        </Button>
        <Button
          variant={tab === "flags" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("flags")}
          className="gap-2"
        >
          <Flag className="h-4 w-4" /> Feature flags
        </Button>
        <Button
          variant={tab === "limits" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("limits")}
          className="gap-2"
        >
          <Gauge className="h-4 w-4" /> Limites por plano
        </Button>
      </div>

      {tab === "settings" && <SettingsPanel />}
      {tab === "flags" && <FlagsPanel />}
      {tab === "limits" && <LimitsPanel />}
    </div>
  );
}

/* ============ Plataforma ============ */
function SettingsPanel() {
  const [items, setItems] = useState<PlatformSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("platform_settings")
      .select("*")
      .order("chave");
    if (error) toast.error(error.message);
    setItems((data ?? []) as PlatformSetting[]);
    setLoading(false);
  }

  async function saveItem(s: PlatformSetting) {
    setSaving(s.id);
    const { error } = await supabase
      .from("platform_settings")
      .update({ valor: s.valor, descricao: s.descricao })
      .eq("id", s.id);
    if (error) toast.error(error.message);
    else toast.success(`"${s.chave}" salvo`);
    setSaving(null);
  }

  function patch(id: string, patcher: (s: PlatformSetting) => PlatformSetting) {
    setItems((arr) => arr.map((it) => (it.id === id ? patcher(it) : it)));
  }

  if (loading)
    return (
      <Card className="flex items-center justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Card>
    );

  return (
    <div className="space-y-3">
      {items.map((s) => {
        const isManutencao = s.chave === "manutencao";
        const isBanner = s.chave === "banner_global";
        const isSignup = s.chave === "signup_aberto";
        const v = s.valor as Record<string, unknown>;

        return (
          <Card key={s.id} className="p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {s.chave}
                  </code>
                  {isManutencao && Boolean(v.ativo) && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" /> ATIVO
                    </Badge>
                  )}
                </div>
                {s.descricao && (
                  <p className="mt-1 text-xs text-muted-foreground">{s.descricao}</p>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => void saveItem(s)}
                disabled={saving === s.id}
                className="gap-2"
              >
                {saving === s.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar
              </Button>
            </div>

            {isManutencao && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={Boolean(v.ativo)}
                    onCheckedChange={(b) =>
                      patch(s.id, (it) => ({
                        ...it,
                        valor: { ...it.valor, ativo: b },
                      }))
                    }
                  />
                  <Label className="!m-0">Ativar modo manutenção</Label>
                </div>
                <Textarea
                  rows={2}
                  placeholder="Mensagem exibida durante a manutenção…"
                  value={(v.mensagem as string) ?? ""}
                  onChange={(e) =>
                    patch(s.id, (it) => ({
                      ...it,
                      valor: { ...it.valor, mensagem: e.target.value },
                    }))
                  }
                />
              </div>
            )}

            {isBanner && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={Boolean(v.ativo)}
                    onCheckedChange={(b) =>
                      patch(s.id, (it) => ({
                        ...it,
                        valor: { ...it.valor, ativo: b },
                      }))
                    }
                  />
                  <Label className="!m-0">Exibir banner global</Label>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                  <Textarea
                    rows={2}
                    placeholder="Mensagem do banner…"
                    value={(v.mensagem as string) ?? ""}
                    onChange={(e) =>
                      patch(s.id, (it) => ({
                        ...it,
                        valor: { ...it.valor, mensagem: e.target.value },
                      }))
                    }
                  />
                  <Select
                    value={(v.tipo as string) ?? "info"}
                    onValueChange={(t) =>
                      patch(s.id, (it) => ({
                        ...it,
                        valor: { ...it.valor, tipo: t },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Informativo</SelectItem>
                      <SelectItem value="warning">Aviso</SelectItem>
                      <SelectItem value="success">Sucesso</SelectItem>
                      <SelectItem value="error">Erro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {isSignup && (
              <div className="flex items-center gap-3">
                <Switch
                  checked={Boolean(v.ativo)}
                  onCheckedChange={(b) =>
                    patch(s.id, (it) => ({
                      ...it,
                      valor: { ...it.valor, ativo: b },
                    }))
                  }
                />
                <Label className="!m-0">
                  Permitir cadastro público de cidadãos
                </Label>
              </div>
            )}

            {!isManutencao && !isBanner && !isSignup && (
              <Textarea
                rows={4}
                className="font-mono text-xs"
                value={JSON.stringify(s.valor, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    patch(s.id, (it) => ({ ...it, valor: parsed }));
                  } catch {
                    /* user ainda digitando */
                  }
                }}
              />
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ============ Feature Flags ============ */
function FlagsPanel() {
  const [items, setItems] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [novo, setNovo] = useState({ chave: "", nome: "" });

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("feature_flags")
      .select("*")
      .order("chave");
    if (error) toast.error(error.message);
    setItems((data ?? []) as FeatureFlag[]);
    setLoading(false);
  }

  async function update(id: string, patch: Partial<FeatureFlag>) {
    setItems((arr) => arr.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    const { error } = await supabase.from("feature_flags").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      void load();
    }
  }

  async function togglePlano(f: FeatureFlag, plano: string) {
    const cur = f.planos_permitidos ?? [];
    const next = cur.includes(plano)
      ? cur.filter((p) => p !== plano)
      : [...cur, plano];
    await update(f.id, { planos_permitidos: next });
  }

  async function criar() {
    if (!novo.chave.trim() || !novo.nome.trim()) {
      toast.error("Chave e nome obrigatórios");
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("feature_flags").insert({
      chave: novo.chave.trim(),
      nome: novo.nome.trim(),
      habilitada: false,
    });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNovo({ chave: "", nome: "" });
    toast.success("Flag criada");
    await load();
  }

  async function remover(id: string) {
    if (!confirm("Remover esta flag?")) return;
    const { error } = await supabase.from("feature_flags").delete().eq("id", id);
    if (error) toast.error(error.message);
    else await load();
  }

  if (loading)
    return (
      <Card className="flex items-center justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Card>
    );

  return (
    <Card className="p-4">
      <div className="mb-4 flex flex-wrap items-end gap-2 border-b pb-4">
        <div className="flex-1 min-w-[150px]">
          <Label className="text-xs">Chave</Label>
          <Input
            placeholder="nova_funcionalidade"
            value={novo.chave}
            onChange={(e) =>
              setNovo((s) => ({
                ...s,
                chave: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
              }))
            }
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">Nome</Label>
          <Input
            placeholder="Nova funcionalidade"
            value={novo.nome}
            onChange={(e) => setNovo((s) => ({ ...s, nome: e.target.value }))}
          />
        </div>
        <Button onClick={() => void criar()} disabled={creating} className="gap-2">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Criar flag
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Flag</TableHead>
            <TableHead>Habilitada</TableHead>
            <TableHead>Planos</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((f) => (
            <TableRow key={f.id}>
              <TableCell>
                <div className="font-medium">{f.nome}</div>
                <code className="text-xs text-muted-foreground">{f.chave}</code>
                {f.descricao && (
                  <p className="text-xs text-muted-foreground">{f.descricao}</p>
                )}
              </TableCell>
              <TableCell>
                <Switch
                  checked={f.habilitada}
                  onCheckedChange={(b) => void update(f.id, { habilitada: b })}
                />
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {PLANOS.map((p) => {
                    const on = f.planos_permitidos?.includes(p);
                    return (
                      <Badge
                        key={p}
                        variant={on ? "default" : "outline"}
                        className="cursor-pointer capitalize"
                        onClick={() => void togglePlano(f, p)}
                      >
                        {p}
                      </Badge>
                    );
                  })}
                </div>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void remover(f.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

/* ============ Limites por plano ============ */
function LimitsPanel() {
  const [items, setItems] = useState<PlanLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [novo, setNovo] = useState<{
    plano: PlanLimit["plano"];
    chave: string;
    valor: number;
  }>({ plano: "basico", chave: "", valor: 0 });

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("plan_limits")
      .select("*")
      .order("plano")
      .order("chave");
    if (error) toast.error(error.message);
    setItems((data ?? []) as PlanLimit[]);
    setLoading(false);
  }

  async function updateValor(id: string, valor: number) {
    setItems((arr) => arr.map((l) => (l.id === id ? { ...l, valor } : l)));
    const { error } = await supabase.from("plan_limits").update({ valor }).eq("id", id);
    if (error) {
      toast.error(error.message);
      void load();
    }
  }

  async function criar() {
    if (!novo.chave.trim()) {
      toast.error("Chave obrigatória");
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("plan_limits").insert({
      plano: novo.plano,
      chave: novo.chave.trim(),
      valor: novo.valor,
    });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNovo({ plano: "basico", chave: "", valor: 0 });
    await load();
  }

  async function remover(id: string) {
    if (!confirm("Remover este limite?")) return;
    const { error } = await supabase.from("plan_limits").delete().eq("id", id);
    if (error) toast.error(error.message);
    else await load();
  }

  const grouped = useMemo(() => {
    const m = new Map<string, PlanLimit[]>();
    for (const l of items) {
      const arr = m.get(l.plano) ?? [];
      arr.push(l);
      m.set(l.plano, arr);
    }
    return m;
  }, [items]);

  if (loading)
    return (
      <Card className="flex items-center justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Card>
    );

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <Label className="text-sm font-semibold">Adicionar limite</Label>
        <div className="mt-3 grid gap-2 sm:grid-cols-[140px_1fr_140px_auto]">
          <Select
            value={novo.plano}
            onValueChange={(v) =>
              setNovo((s) => ({ ...s, plano: v as PlanLimit["plano"] }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLANOS.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="chave (ex.: api_calls_dia)"
            value={novo.chave}
            onChange={(e) => setNovo((s) => ({ ...s, chave: e.target.value }))}
          />
          <Input
            type="number"
            value={novo.valor}
            onChange={(e) =>
              setNovo((s) => ({ ...s, valor: Number(e.target.value) }))
            }
          />
          <Button onClick={() => void criar()} disabled={creating} className="gap-2">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLANOS.map((p) => (
          <Card key={p} className="p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">
              <Badge>{p}</Badge>
            </h3>
            <div className="space-y-2">
              {(grouped.get(p) ?? []).map((l) => (
                <div key={l.id} className="flex items-center gap-2">
                  <div className="flex-1">
                    <code className="text-xs">{l.chave}</code>
                    {l.descricao && (
                      <p className="text-xs text-muted-foreground">{l.descricao}</p>
                    )}
                  </div>
                  <Input
                    type="number"
                    value={l.valor}
                    onChange={(e) => void updateValor(l.id, Number(e.target.value))}
                    className="h-8 w-28 text-right font-mono"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => void remover(l.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
              {(grouped.get(p) ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Sem limites cadastrados.</p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
