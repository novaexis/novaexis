import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/Logo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Handshake, Users, TrendingUp, Filter } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/parceiro")({
  head: () => ({
    meta: [
      { title: "Portal do Parceiro — NovaeXis" },
      {
        name: "description",
        content: "Indique municípios e acompanhe suas comissões como parceiro NovaeXis.",
      },
    ],
  }),
  component: ParceiroPage,
});

interface Lead {
  id: string;
  nome: string;
  email: string;
  municipio: string | null;
  cargo: string | null;
  status: string;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: "novo", label: "Novo" },
  { value: "qualificado", label: "Qualificado" },
  { value: "em_negociacao", label: "Em negociação" },
  { value: "convertido", label: "Convertido" },
  { value: "perdido", label: "Perdido" },
];

function ParceiroPage() {
  const { user, loading } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [novo, setNovo] = useState({ nome: "", email: "", telefone: "", municipio: "", cargo: "Prefeito", observacoes: "" });
  const [enviando, setEnviando] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  useEffect(() => {
    if (!user) return;
    void carregar();
  }, [user]);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from("leads_comerciais")
      .select("id, nome, email, municipio, cargo, status, created_at")
      .order("created_at", { ascending: false });
    setLeads(data ?? []);
    setCarregando(false);
  }

  async function atualizarStatus(id: string, novoStatus: string) {
    const { error } = await supabase
      .from("leads_comerciais")
      .update({ status: novoStatus })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar status: " + error.message);
      return;
    }

    setLeads(prev => prev.map(l => l.id === id ? { ...l, status: novoStatus } : l));
    toast.success("Status atualizado!");
  }

  async function indicar() {
    if (!novo.nome || !novo.email) {
      toast.error("Nome e email são obrigatórios");
      return;
    }
    setEnviando(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("reseller_id")
        .eq("id", user?.id ?? "")
        .maybeSingle();

      const { error } = await supabase.from("leads_comerciais").insert({
        nome: novo.nome,
        email: novo.email,
        telefone: novo.telefone || null,
        municipio: novo.municipio || null,
        cargo: novo.cargo || null,
        observacoes: novo.observacoes || null,
        origem: "parceiro",
        reseller_id: profile?.reseller_id ?? null,
      });
      if (error) throw error;
      toast.success("Indicação enviada!");
      setNovo({ nome: "", email: "", telefone: "", municipio: "", cargo: "Prefeito", observacoes: "" });
      void carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao indicar");
    } finally {
      setEnviando(false);
    }
  }

  const leadsFiltrados = useMemo(() => {
    if (filtroStatus === "todos") return leads;
    return leads.filter(l => l.status === filtroStatus);
  }, [leads, filtroStatus]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
        <Logo className="h-10" />
        <h1 className="mt-6 text-xl font-semibold">Portal do Parceiro</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Faça login para acessar o portal de parceiros do NovaeXis.
        </p>
        <Link to="/login" className="mt-4">
          <Button>Entrar</Button>
        </Link>
      </div>
    );
  }

  const total = leads.length;
  const convertidos = leads.filter((l) => l.status === "convertido").length;
  const novos = leads.filter((l) => l.status === "novo").length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo className="h-8" />
            <Badge variant="outline" className="gap-1">
              <Handshake className="h-3 w-3" /> Parceiro
            </Badge>
          </div>
          <Link to="/">
            <Button variant="ghost" size="sm">Voltar ao site</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold">Olá, {user.email?.split("@")[0]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Indique municípios e acompanhe o status comercial.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <Users className="h-5 w-5 text-primary" />
            <p className="mt-2 text-xs text-muted-foreground">Total de indicações</p>
            <p className="font-mono text-2xl font-semibold">{total}</p>
          </Card>
          <Card className="p-4">
            <Plus className="h-5 w-5 text-amber-500" />
            <p className="mt-2 text-xs text-muted-foreground">Novos</p>
            <p className="font-mono text-2xl font-semibold">{novos}</p>
          </Card>
          <Card className="p-4">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <p className="mt-2 text-xs text-muted-foreground">Convertidos</p>
            <p className="font-mono text-2xl font-semibold">{convertidos}</p>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.5fr]">
          <Card className="p-5">
            <h2 className="text-base font-semibold">Indicar município</h2>
            <div className="mt-4 space-y-3">
              <div>
                <Label htmlFor="n">Nome do contato</Label>
                <Input id="n" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="e">Email</Label>
                <Input id="e" type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="t">Telefone</Label>
                  <Input id="t" value={novo.telefone} onChange={(e) => setNovo({ ...novo, telefone: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="c">Cargo</Label>
                  <Input id="c" value={novo.cargo} onChange={(e) => setNovo({ ...novo, cargo: e.target.value })} className="mt-1" />
                </div>
              </div>
              <div>
                <Label htmlFor="m">Município</Label>
                <Input id="m" value={novo.municipio} onChange={(e) => setNovo({ ...novo, municipio: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="o">Observações</Label>
                <Textarea id="o" rows={3} value={novo.observacoes} onChange={(e) => setNovo({ ...novo, observacoes: e.target.value })} className="mt-1" />
              </div>
              <Button onClick={indicar} disabled={enviando} className="w-full">
                {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar indicação
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Minhas indicações</h2>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <SelectValue placeholder="Filtrar por status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {carregando ? (
              <Loader2 className="mx-auto mt-6 h-5 w-5 animate-spin text-primary" />
            ) : leadsFiltrados.length === 0 ? (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Nenhuma indicação encontrada.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {leadsFiltrados.map((l) => (
                  <li key={l.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium">{l.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.cargo} {l.municipio && `· ${l.municipio}`}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{l.email}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge status={l.status} />
                        <Select
                          value={l.status}
                          onValueChange={(val) => atualizarStatus(l.id, val)}
                        >
                          <SelectTrigger className="h-7 w-[120px] text-[10px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value} className="text-[10px]">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    novo: { label: "Novo", cls: "border-amber-500/40 bg-amber-500/10 text-amber-700" },
    qualificado: { label: "Qualificado", cls: "border-blue-500/40 bg-blue-500/10 text-blue-700" },
    em_negociacao: { label: "Em negociação", cls: "border-purple-500/40 bg-purple-500/10 text-purple-700" },
    convertido: { label: "Convertido", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" },
    perdido: { label: "Perdido", cls: "border-red-500/40 bg-red-500/10 text-red-700" },
  };
  const m = map[status] ?? { label: status, cls: "" };
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

