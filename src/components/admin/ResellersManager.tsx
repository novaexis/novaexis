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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Plus,
  Pencil,
  RefreshCw,
  Building2,
  Globe,
  Percent,
} from "lucide-react";
import { toast } from "sonner";

type Reseller = {
  id: string;
  nome: string;
  slug: string;
  email_contato: string | null;
  telefone: string | null;
  ativo: boolean;
  comissao_pct: number | null;
  cor_primaria: string | null;
  logo_url: string | null;
  dominio_customizado: string | null;
  rodape_texto: string | null;
  observacoes: string | null;
  created_at: string;
};

type FormState = Omit<Reseller, "id" | "created_at"> & { id?: string };

const EMPTY: FormState = {
  nome: "",
  slug: "",
  email_contato: "",
  telefone: "",
  ativo: true,
  comissao_pct: 0,
  cor_primaria: "",
  logo_url: "",
  dominio_customizado: "",
  rodape_texto: "",
  observacoes: "",
};

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function ResellersManager() {
  const [rows, setRows] = useState<Reseller[]>([]);
  const [tenantsCount, setTenantsCount] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("resellers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRows((data ?? []) as Reseller[]);

      // Conta tenants por reseller
      const { data: tenants } = await supabase
        .from("tenants")
        .select("id, reseller_id");
      const m = new Map<string, number>();
      for (const t of tenants ?? []) {
        if (t.reseller_id) m.set(t.reseller_id, (m.get(t.reseller_id) ?? 0) + 1);
      }
      setTenantsCount(m);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar resellers");
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditing(EMPTY);
    setOpen(true);
  }

  function openEdit(r: Reseller) {
    setEditing({ ...r });
    setOpen(true);
  }

  async function save() {
    if (!editing.nome.trim() || !editing.slug.trim()) {
      toast.error("Nome e slug são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nome: editing.nome.trim(),
        slug: editing.slug.trim(),
        email_contato: editing.email_contato || null,
        telefone: editing.telefone || null,
        ativo: editing.ativo,
        comissao_pct: editing.comissao_pct ?? 0,
        cor_primaria: editing.cor_primaria || null,
        logo_url: editing.logo_url || null,
        dominio_customizado: editing.dominio_customizado || null,
        rodape_texto: editing.rodape_texto || null,
        observacoes: editing.observacoes || null,
      };
      if (editing.id) {
        const { error } = await supabase
          .from("resellers")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Reseller atualizado");
      } else {
        const { error } = await supabase.from("resellers").insert(payload);
        if (error) throw error;
        toast.success("Reseller criado");
      }
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAtivo(r: Reseller) {
    const { error } = await supabase
      .from("resellers")
      .update({ ativo: !r.ativo })
      .eq("id", r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await load();
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.nome.toLowerCase().includes(term) ||
        r.slug.toLowerCase().includes(term) ||
        r.email_contato?.toLowerCase().includes(term) ||
        r.dominio_customizado?.toLowerCase().includes(term),
    );
  }, [rows, search]);

  const totalMunicipios = Array.from(tenantsCount.values()).reduce(
    (a, b) => a + b,
    0,
  );

  return (
    <Card className="p-4">
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={Building2} label="Resellers" value={rows.length} />
        <SummaryCard
          icon={Building2}
          label="Municípios via reseller"
          value={totalMunicipios}
        />
        <SummaryCard
          icon={Building2}
          label="Ativos"
          value={rows.filter((r) => r.ativo).length}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por nome, slug, email ou domínio…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button variant="outline" size="sm" onClick={() => void load()} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
        <Button size="sm" onClick={openNew} className="ml-auto gap-2">
          <Plus className="h-4 w-4" /> Novo reseller
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Nenhum reseller cadastrado.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Domínio</TableHead>
                <TableHead className="text-right">Municípios</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {r.cor_primaria && (
                        <span
                          className="h-3 w-3 rounded-full border"
                          style={{ background: r.cor_primaria }}
                        />
                      )}
                      <div>
                        <div className="font-medium">{r.nome}</div>
                        {r.email_contato && (
                          <div className="text-xs text-muted-foreground">
                            {r.email_contato}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.slug}</TableCell>
                  <TableCell className="text-xs">
                    {r.dominio_customizado ? (
                      <span className="inline-flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {r.dominio_customizado}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {tenantsCount.get(r.id) ?? 0}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {r.comissao_pct ?? 0}%
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={r.ativo}
                        onCheckedChange={() => void toggleAtivo(r)}
                      />
                      <Badge variant={r.ativo ? "default" : "secondary"}>
                        {r.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(r)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing.id ? "Editar reseller" : "Novo reseller"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Nome comercial</Label>
              <Input
                value={editing.nome}
                onChange={(e) =>
                  setEditing((s) => ({
                    ...s,
                    nome: e.target.value,
                    slug: s.slug || slugify(e.target.value),
                  }))
                }
                placeholder="Ex.: Acme Gov Tech"
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input
                value={editing.slug}
                onChange={(e) =>
                  setEditing((s) => ({ ...s, slug: slugify(e.target.value) }))
                }
                placeholder="acme-gov"
              />
            </div>
            <div>
              <Label>Comissão (%)</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={editing.comissao_pct ?? 0}
                onChange={(e) =>
                  setEditing((s) => ({
                    ...s,
                    comissao_pct: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div>
              <Label>Email de contato</Label>
              <Input
                type="email"
                value={editing.email_contato ?? ""}
                onChange={(e) =>
                  setEditing((s) => ({ ...s, email_contato: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={editing.telefone ?? ""}
                onChange={(e) =>
                  setEditing((s) => ({ ...s, telefone: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Cor primária</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={editing.cor_primaria || "#3b82f6"}
                  onChange={(e) =>
                    setEditing((s) => ({ ...s, cor_primaria: e.target.value }))
                  }
                  className="h-10 w-16 p-1"
                />
                <Input
                  value={editing.cor_primaria ?? ""}
                  onChange={(e) =>
                    setEditing((s) => ({ ...s, cor_primaria: e.target.value }))
                  }
                  placeholder="#3b82f6"
                />
              </div>
            </div>
            <div>
              <Label>Logo URL</Label>
              <Input
                value={editing.logo_url ?? ""}
                onChange={(e) =>
                  setEditing((s) => ({ ...s, logo_url: e.target.value }))
                }
                placeholder="https://…"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Domínio customizado</Label>
              <Input
                value={editing.dominio_customizado ?? ""}
                onChange={(e) =>
                  setEditing((s) => ({
                    ...s,
                    dominio_customizado: e.target.value,
                  }))
                }
                placeholder="painel.acmegov.com.br"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Texto do rodapé</Label>
              <Input
                value={editing.rodape_texto ?? ""}
                onChange={(e) =>
                  setEditing((s) => ({ ...s, rodape_texto: e.target.value }))
                }
                placeholder="© 2026 Acme Gov Tech"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={editing.observacoes ?? ""}
                onChange={(e) =>
                  setEditing((s) => ({ ...s, observacoes: e.target.value }))
                }
                rows={3}
              />
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch
                checked={editing.ativo}
                onCheckedChange={(v) =>
                  setEditing((s) => ({ ...s, ativo: v }))
                }
              />
              <Label className="!m-0">Reseller ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

// helper para evitar warning de import não usado
export const _icons = { Percent };
