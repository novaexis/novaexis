import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Power,
  PowerOff,
  Search,
  Building2,
} from "lucide-react";

type Plano = "basico" | "completo" | "estado";
type Tipo = "municipio" | "estado";

interface Tenant {
  id: string;
  nome: string;
  slug: string;
  estado: string;
  tipo: Tipo;
  plano: Plano | null;
  populacao: number | null;
  ibge_codigo: string | null;
  bioma: string | null;
  idhm: number | null;
  ativo: boolean;
  created_at: string;
}

const PLANO_LABEL: Record<Plano, string> = {
  basico: "Básico",
  completo: "Completo",
  estado: "Estado",
};

const PLANO_COLOR: Record<Plano, string> = {
  basico: "bg-muted text-muted-foreground",
  completo: "bg-primary/15 text-primary",
  estado: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
};

export function MunicipiosManager() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Tenant[]>([]);
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tenants")
      .select(
        "id, nome, slug, estado, tipo, plano, populacao, ibge_codigo, bioma, idhm, ativo, created_at",
      )
      .order("nome", { ascending: true });
    if (error) toast.error("Erro ao carregar municípios");
    setRows((data ?? []) as Tenant[]);
    setLoading(false);
  }

  async function toggleAtivo(t: Tenant) {
    const { error } = await supabase
      .from("tenants")
      .update({ ativo: !t.ativo })
      .eq("id", t.id);
    if (error) {
      toast.error("Erro ao atualizar");
      return;
    }
    toast.success(t.ativo ? "Tenant desativado" : "Tenant ativado");
    setRows((prev) => prev.map((r) => (r.id === t.id ? { ...r, ativo: !t.ativo } : r)));
  }

  function abrirNovo() {
    setEditing(null);
    setOpen(true);
  }

  function abrirEdit(t: Tenant) {
    setEditing(t);
    setOpen(true);
  }

  const filtrados = rows.filter((r) => {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return (
      r.nome.toLowerCase().includes(q) ||
      r.slug.toLowerCase().includes(q) ||
      (r.ibge_codigo ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, slug ou IBGE…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={abrirNovo} className="gap-2">
          <Plus className="h-4 w-4" /> Novo município
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-10 text-center">
          <Building2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum município encontrado.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Município</th>
                <th className="px-3 py-2 text-left">UF</th>
                <th className="px-3 py-2 text-left">Plano</th>
                <th className="px-3 py-2 text-right">População</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((t) => (
                <tr key={t.id} className="border-b last:border-b-0 hover:bg-muted/20">
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{t.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.slug}
                      {t.ibge_codigo ? ` · IBGE ${t.ibge_codigo}` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-2.5">{t.estado}</td>
                  <td className="px-3 py-2.5">
                    {t.plano ? (
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PLANO_COLOR[t.plano]}`}
                      >
                        {PLANO_LABEL[t.plano]}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {t.populacao ? t.populacao.toLocaleString("pt-BR") : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={t.ativo ? "default" : "secondary"}>
                      {t.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => abrirEdit(t)}
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleAtivo(t)}
                        aria-label={t.ativo ? "Desativar" : "Ativar"}
                        className={t.ativo ? "text-destructive" : "text-primary"}
                      >
                        {t.ativo ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TenantDialog
        open={open}
        onOpenChange={setOpen}
        tenant={editing}
        onSaved={async () => {
          setOpen(false);
          await load();
        }}
      />
    </div>
  );
}

interface DialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenant: Tenant | null;
  onSaved: () => void;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function TenantDialog({ open, onOpenChange, tenant, onSaved }: DialogProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    slug: "",
    estado: "PA",
    tipo: "municipio" as Tipo,
    plano: "basico" as Plano,
    populacao: "",
    ibge_codigo: "",
    bioma: "",
    idhm: "",
  });

  useEffect(() => {
    if (tenant) {
      setForm({
        nome: tenant.nome,
        slug: tenant.slug,
        estado: tenant.estado,
        tipo: tenant.tipo,
        plano: (tenant.plano ?? "basico") as Plano,
        populacao: tenant.populacao?.toString() ?? "",
        ibge_codigo: tenant.ibge_codigo ?? "",
        bioma: tenant.bioma ?? "",
        idhm: tenant.idhm?.toString() ?? "",
      });
    } else {
      setForm({
        nome: "",
        slug: "",
        estado: "PA",
        tipo: "municipio",
        plano: "basico",
        populacao: "",
        ibge_codigo: "",
        bioma: "",
        idhm: "",
      });
    }
  }, [tenant, open]);

  async function salvar() {
    if (!form.nome.trim() || !form.slug.trim() || !form.estado.trim()) {
      toast.error("Nome, slug e UF são obrigatórios");
      return;
    }
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      slug: form.slug.trim(),
      estado: form.estado.trim().toUpperCase().slice(0, 2),
      tipo: form.tipo,
      plano: form.plano,
      populacao: form.populacao ? Number(form.populacao) : null,
      ibge_codigo: form.ibge_codigo.trim() || null,
      bioma: form.bioma.trim() || null,
      idhm: form.idhm ? Number(form.idhm) : null,
    };
    const op = tenant
      ? supabase.from("tenants").update(payload).eq("id", tenant.id)
      : supabase.from("tenants").insert({ ...payload, ativo: true });
    const { error } = await op;
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(tenant ? "Município atualizado" : "Município criado");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tenant ? "Editar município" : "Novo município"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={form.nome}
              onChange={(e) => {
                const nome = e.target.value;
                setForm((f) => ({
                  ...f,
                  nome,
                  slug: tenant ? f.slug : slugify(nome),
                }));
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="uf">UF</Label>
              <Input
                id="uf"
                maxLength={2}
                value={form.estado}
                onChange={(e) =>
                  setForm((f) => ({ ...f, estado: e.target.value.toUpperCase() }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Tipo</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as Tipo }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="municipio">Município</SelectItem>
                  <SelectItem value="estado">Estado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Plano</Label>
              <Select
                value={form.plano}
                onValueChange={(v) => setForm((f) => ({ ...f, plano: v as Plano }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basico">Básico</SelectItem>
                  <SelectItem value="completo">Completo</SelectItem>
                  <SelectItem value="estado">Estado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pop">População</Label>
              <Input
                id="pop"
                type="number"
                value={form.populacao}
                onChange={(e) => setForm((f) => ({ ...f, populacao: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ibge">Código IBGE</Label>
              <Input
                id="ibge"
                value={form.ibge_codigo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ibge_codigo: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="bioma">Bioma</Label>
              <Input
                id="bioma"
                value={form.bioma}
                onChange={(e) => setForm((f) => ({ ...f, bioma: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="idhm">IDHM</Label>
              <Input
                id="idhm"
                type="number"
                step="0.001"
                value={form.idhm}
                onChange={(e) => setForm((f) => ({ ...f, idhm: e.target.value }))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
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
