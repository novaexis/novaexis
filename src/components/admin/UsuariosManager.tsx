import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  Search,
  Users,
  Shield,
  KeyRound,
  Trash2,
  UserPlus,
} from "lucide-react";

type AppRole =
  | "superadmin"
  | "governador"
  | "prefeito"
  | "secretario"
  | "cidadao"
  | "reseller";

const ROLE_LABEL: Record<AppRole, string> = {
  superadmin: "Superadmin",
  governador: "Governador",
  prefeito: "Prefeito",
  secretario: "Secretário",
  cidadao: "Cidadão",
  reseller: "Revenda",
};

const ROLE_COLOR: Record<AppRole, string> = {
  superadmin: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  governador: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  prefeito: "bg-primary/15 text-primary",
  secretario: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  cidadao: "bg-muted text-muted-foreground",
  reseller: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

interface Profile {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  tenant_id: string | null;
  created_at: string;
}
interface RoleRow {
  user_id: string;
  role: AppRole;
  tenant_id: string | null;
  secretaria_slug: string | null;
}
interface Tenant {
  id: string;
  nome: string;
}

export function UsuariosManager() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroTenant, setFiltroTenant] = useState<string>("__all");
  const [openNovo, setOpenNovo] = useState(false);
  const [openRole, setOpenRole] = useState<{ user: Profile } | null>(null);
  const [openSenha, setOpenSenha] = useState<{ user: Profile } | null>(null);

  useEffect(() => {
    void loadTenants();
  }, []);
  useEffect(() => {
    void load();
  }, [filtroTenant]);

  async function loadTenants() {
    const { data } = await supabase
      .from("tenants")
      .select("id, nome")
      .order("nome");
    setTenants((data ?? []) as Tenant[]);
  }

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: {
        action: "list",
        tenant_id: filtroTenant === "__all" ? null : filtroTenant,
        search: null,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setProfiles((data?.profiles ?? []) as Profile[]);
    setRoles((data?.roles ?? []) as RoleRow[]);
  }

  const tenantNome = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tenants) m.set(t.id, t.nome);
    return m;
  }, [tenants]);

  const rolesByUser = useMemo(() => {
    const m = new Map<string, RoleRow[]>();
    for (const r of roles) {
      const arr = m.get(r.user_id) ?? [];
      arr.push(r);
      m.set(r.user_id, arr);
    }
    return m;
  }, [roles]);

  const filtrados = profiles.filter((p) => {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return (
      (p.nome ?? "").toLowerCase().includes(q) ||
      (p.email ?? "").toLowerCase().includes(q)
    );
  });

  async function removerRole(user_id: string, role: AppRole, tenant_id: string | null) {
    if (!confirm(`Remover role "${ROLE_LABEL[role]}"?`)) return;
    const { error } = await supabase.functions.invoke("admin-users", {
      body: { action: "remove_role", user_id, role, tenant_id },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Role removida");
    await load();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filtroTenant} onValueChange={setFiltroTenant}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filtrar por município" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os municípios</SelectItem>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setOpenNovo(true)} className="gap-2">
          <UserPlus className="h-4 w-4" /> Novo usuário
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-10 text-center">
          <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Usuário</th>
                <th className="px-3 py-2 text-left">Município</th>
                <th className="px-3 py-2 text-left">Roles</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => {
                const userRoles = rolesByUser.get(p.id) ?? [];
                return (
                  <tr key={p.id} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="px-3 py-2.5">
                      <p className="font-medium">{p.nome ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{p.email}</p>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {p.tenant_id ? tenantNome.get(p.tenant_id) ?? "—" : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {userRoles.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Sem roles</span>
                        ) : (
                          userRoles.map((r) => (
                            <button
                              key={`${r.role}-${r.tenant_id ?? "g"}`}
                              type="button"
                              onClick={() => removerRole(p.id, r.role, r.tenant_id)}
                              title="Clique para remover"
                              className={`group inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition hover:opacity-80 ${ROLE_COLOR[r.role]}`}
                            >
                              {ROLE_LABEL[r.role]}
                              {r.secretaria_slug ? `·${r.secretaria_slug}` : ""}
                              <Trash2 className="ml-0.5 h-3 w-3 opacity-0 transition group-hover:opacity-100" />
                            </button>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setOpenRole({ user: p })}
                          aria-label="Adicionar role"
                        >
                          <Shield className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setOpenSenha({ user: p })}
                          aria-label="Resetar senha"
                        >
                          <KeyRound className="h-4 w-4" />
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

      <NovoUsuarioDialog
        open={openNovo}
        onOpenChange={setOpenNovo}
        tenants={tenants}
        onSaved={async () => {
          setOpenNovo(false);
          await load();
        }}
      />

      <AdicionarRoleDialog
        open={!!openRole}
        onOpenChange={(v) => !v && setOpenRole(null)}
        user={openRole?.user ?? null}
        tenants={tenants}
        onSaved={async () => {
          setOpenRole(null);
          await load();
        }}
      />

      <ResetSenhaDialog
        open={!!openSenha}
        onOpenChange={(v) => !v && setOpenSenha(null)}
        user={openSenha?.user ?? null}
        onSaved={() => setOpenSenha(null)}
      />
    </div>
  );
}

// ============= Dialogs =============

function NovoUsuarioDialog({
  open,
  onOpenChange,
  tenants,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenants: Tenant[];
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    password: "",
    role: "cidadao" as AppRole,
    tenant_id: "" as string,
    secretaria_slug: "",
  });
  const [createdPw, setCreatedPw] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({
        nome: "",
        email: "",
        password: "",
        role: "cidadao",
        tenant_id: "",
        secretaria_slug: "",
      });
      setCreatedPw(null);
    }
  }, [open]);

  const precisaTenant = form.role !== "superadmin" && form.role !== "reseller";
  const precisaSecretaria = form.role === "secretario";

  async function salvar() {
    if (!form.nome.trim() || !form.email.trim()) {
      toast.error("Nome e email obrigatórios");
      return;
    }
    if (precisaTenant && !form.tenant_id) {
      toast.error("Selecione o município");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: {
        action: "create",
        nome: form.nome.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password.trim() || undefined,
        role: form.role,
        tenant_id: precisaTenant ? form.tenant_id : null,
        secretaria_slug: precisaSecretaria ? form.secretaria_slug.trim() : null,
      },
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data?.error) {
      toast.error(data.error);
      return;
    }
    toast.success("Usuário criado");
    setCreatedPw(data?.password ?? null);
    if (!data?.password) onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>
            Cria a conta no auth e atribui a role inicial.
          </DialogDescription>
        </DialogHeader>

        {createdPw ? (
          <div className="space-y-3">
            <p className="text-sm">Usuário criado com sucesso. Senha gerada:</p>
            <code className="block break-all rounded bg-muted px-3 py-2 font-mono text-sm">
              {createdPw}
            </code>
            <p className="text-xs text-muted-foreground">
              Copie agora — não será exibida novamente.
            </p>
            <DialogFooter>
              <Button onClick={onSaved}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pw">Senha (opcional — gera aleatória se vazio)</Label>
                <Input
                  id="pw"
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Role inicial</Label>
                  <Select
                    value={form.role}
                    onValueChange={(v) => setForm((f) => ({ ...f, role: v as AppRole }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cidadao">Cidadão</SelectItem>
                      <SelectItem value="secretario">Secretário</SelectItem>
                      <SelectItem value="prefeito">Prefeito</SelectItem>
                      <SelectItem value="governador">Governador</SelectItem>
                      <SelectItem value="reseller">Revenda</SelectItem>
                      <SelectItem value="superadmin">Superadmin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {precisaTenant && (
                  <div className="grid gap-1.5">
                    <Label>Município</Label>
                    <Select
                      value={form.tenant_id}
                      onValueChange={(v) => setForm((f) => ({ ...f, tenant_id: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {tenants.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {precisaSecretaria && (
                <div className="grid gap-1.5">
                  <Label htmlFor="sec">Secretaria (slug)</Label>
                  <Input
                    id="sec"
                    placeholder="saude, educacao, financas, …"
                    value={form.secretaria_slug}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, secretaria_slug: e.target.value }))
                    }
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={salvar} disabled={saving}>
                {saving ? "Criando…" : "Criar"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AdicionarRoleDialog({
  open,
  onOpenChange,
  user,
  tenants,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: Profile | null;
  tenants: Tenant[];
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<AppRole>("secretario");
  const [tenantId, setTenantId] = useState<string>("");
  const [secretaria, setSecretaria] = useState("");

  useEffect(() => {
    if (open && user) {
      setRole("secretario");
      setTenantId(user.tenant_id ?? "");
      setSecretaria("");
    }
  }, [open, user]);

  const precisaTenant = role !== "superadmin" && role !== "reseller";
  const precisaSecretaria = role === "secretario";

  async function salvar() {
    if (!user) return;
    if (precisaTenant && !tenantId) {
      toast.error("Selecione o município");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: {
        action: "set_role",
        user_id: user.id,
        role,
        tenant_id: precisaTenant ? tenantId : null,
        secretaria_slug: precisaSecretaria ? secretaria.trim() : null,
      },
    });
    setSaving(false);
    if (error || data?.error) {
      toast.error(error?.message ?? data?.error);
      return;
    }
    toast.success("Role atribuída");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atribuir role</DialogTitle>
          <DialogDescription>
            {user?.nome ?? user?.email} · {user?.email}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cidadao">Cidadão</SelectItem>
                <SelectItem value="secretario">Secretário</SelectItem>
                <SelectItem value="prefeito">Prefeito</SelectItem>
                <SelectItem value="governador">Governador</SelectItem>
                <SelectItem value="reseller">Revenda</SelectItem>
                <SelectItem value="superadmin">Superadmin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {precisaTenant && (
            <div className="grid gap-1.5">
              <Label>Município</Label>
              <Select value={tenantId} onValueChange={setTenantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {precisaSecretaria && (
            <div className="grid gap-1.5">
              <Label>Secretaria (slug)</Label>
              <Input
                placeholder="saude, educacao, financas, …"
                value={secretaria}
                onChange={(e) => setSecretaria(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={saving}>
            {saving ? "Salvando…" : "Atribuir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetSenhaDialog({
  open,
  onOpenChange,
  user,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: Profile | null;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState("");

  useEffect(() => {
    if (open) setPw("");
  }, [open]);

  async function salvar() {
    if (!user) return;
    if (pw.length < 8) {
      toast.error("Senha mínima de 8 caracteres");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "reset_password", user_id: user.id, password: pw },
    });
    setSaving(false);
    if (error || data?.error) {
      toast.error(error?.message ?? data?.error);
      return;
    }
    toast.success("Senha redefinida");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resetar senha</DialogTitle>
          <DialogDescription>
            {user?.nome ?? user?.email} · {user?.email}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="newpw">Nova senha (mínimo 8 caracteres)</Label>
          <Input
            id="newpw"
            type="text"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          {pw && (
            <Badge variant="outline" className="w-fit text-xs">
              {pw.length} caracteres
            </Badge>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={saving}>
            {saving ? "Salvando…" : "Resetar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

}
