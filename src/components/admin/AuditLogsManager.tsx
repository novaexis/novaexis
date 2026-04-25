import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, RefreshCw, Eye, Activity, Users, Building2, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type AuditLog = {
  id: string;
  created_at: string;
  actor_id: string | null;
  action: string;
  severity: string | null;
  payload: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  target_id: string | null;
  profiles?: {
    email: string | null;
  } | null;
};

type UsageRow = {
  tenant_id: string;
  tenant_nome: string;
  users: number;
  demandas: number;
  demandas_abertas: number;
  agendamentos: number;
  matriculas: number;
};

export function AuditLogsManager() {
  const [tab, setTab] = useState<"logs" | "uso">("logs");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={tab === "logs" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("logs")}
          className="gap-2"
        >
          <Activity className="h-4 w-4" /> Audit logs
        </Button>
        <Button
          variant={tab === "uso" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("uso")}
          className="gap-2"
        >
          <FileText className="h-4 w-4" /> Métricas por tenant
        </Button>
      </div>

      {tab === "logs" ? <LogsTable /> : <UsageTable />}
    </div>
  );
}

function LogsTable() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 50;

  async function loadLogs() {
    setLoading(true);
    try {
      if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
        toast.error("A data inicial não pode ser maior que a data final");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("get-audit-logs-admin", {
        body: {
          page,
          perPage,
          action: actionFilter === "all" ? undefined : actionFilter,
          severity: severityFilter === "all" ? undefined : severityFilter,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
      });
      
      if (error) {
        // Tratar erro padronizado da function
        let message = "Erro ao carregar logs";
        let code = "";
        
        try {
          const errorData = await error.context?.json();
          if (errorData?.error) {
            message = errorData.error.message || message;
            code = errorData.error.code ? ` [${errorData.error.code}]` : "";
          }
        } catch {
          message = error.message || message;
        }
        
        throw new Error(`${message}${code}`);
      }
      
      setLogs((data.logs ?? []) as unknown as AuditLog[]);
      setTotal(data.total ?? 0);
    } catch (e) {
      console.error("Erro na consulta de auditoria:", e);
      toast.error(e instanceof Error ? e.message : "Falha ao carregar logs via API");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, [page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (page !== 1) setPage(1);
      else void loadLogs();
    }, 300);
    return () => clearTimeout(timer);
  }, [severityFilter, actionFilter, dateFrom, dateTo]);

  const actions = useMemo(() => {
    const set = new Set<string>();
    // Usamos os logs atuais para sugerir ações no filtro, mas idealmente viria de um enum ou query específica
    for (const l of logs) set.add(l.action);
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter(
      (l) =>
        l.profiles?.email?.toLowerCase().includes(term) ||
        l.action.toLowerCase().includes(term) ||
        l.severity?.toLowerCase().includes(term) ||
        l.target_id?.toLowerCase().includes(term),
    );
  }, [logs, search]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <Card className="p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar ator, ação ou alvo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-[200px]"
        />
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Severidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Severidade: Todas</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Ação: Todas</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[140px] text-xs"
          />
          <span className="text-muted-foreground">até</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[140px] text-xs"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadLogs()} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8"
            disabled={page <= 1 || loading} 
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">Página {page} de {totalPages || 1}</span>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8"
            disabled={page >= totalPages || loading} 
            onClick={() => setPage(p => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">
          {total} registros encontrados
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Nenhum registro de auditoria encontrado com os filtros aplicados.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Ator</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Alvo</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-[10px] whitespace-nowrap">
                    {new Date(l.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-sm max-w-[150px] truncate">
                    {l.profiles?.email ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        l.severity === "critical" ? "destructive" : 
                        l.severity === "warning" ? "secondary" : "outline"
                      }
                      className="text-[10px] uppercase"
                    >
                      {l.severity || "info"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">{l.action}</span>
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {l.target_id ? `#${l.target_id.slice(0, 8)}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelected(l)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do registro</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <DetailRow label="ID" value={selected.id} mono />
              <DetailRow
                label="Quando"
                value={new Date(selected.created_at).toLocaleString("pt-BR")}
              />
              <DetailRow label="Ator" value={selected.profiles?.email ?? "—"} />
              <DetailRow label="Ação" value={selected.action} mono />
              <DetailRow label="Severidade" value={selected.severity || "info"} />
              <DetailRow label="Alvo" value={selected.target_id || "—"} mono />
              {selected.ip_address && (
                <DetailRow label="IP" value={selected.ip_address} mono />
              )}
              {selected.user_agent && (
                <DetailRow label="User Agent" value={selected.user_agent} />
              )}
              <div>
                <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                  Payload / Detalhes
                </p>
                <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs">
                  {JSON.stringify(selected.payload ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-3">
      <span className="w-24 shrink-0 text-xs font-medium uppercase text-muted-foreground">
        {label}
      </span>
      <span className={mono ? "break-all font-mono text-xs" : "text-sm"}>{value}</span>
    </div>
  );
}

function UsageTable() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: tenants, error: tErr } = await supabase
        .from("tenants")
        .select("id, nome")
        .order("nome");
      if (tErr) throw tErr;

      const result: UsageRow[] = [];

      for (const t of tenants ?? []) {
        const [users, demandas, demandasAb, agend, matr] = await Promise.all([
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", t.id),
          supabase
            .from("demandas")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", t.id),
          supabase
            .from("demandas")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", t.id)
            .in("status", ["aberta", "em_andamento"]),
          supabase
            .from("agendamentos_saude")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", t.id),
          supabase
            .from("matriculas")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", t.id),
        ]);

        result.push({
          tenant_id: t.id,
          tenant_nome: t.nome,
          users: users.count ?? 0,
          demandas: demandas.count ?? 0,
          demandas_abertas: demandasAb.count ?? 0,
          agendamentos: agend.count ?? 0,
          matriculas: matr.count ?? 0,
        });
      }

      setRows(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar métricas");
    } finally {
      setLoading(false);
    }
  }

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          users: acc.users + r.users,
          demandas: acc.demandas + r.demandas,
          demandas_abertas: acc.demandas_abertas + r.demandas_abertas,
          agendamentos: acc.agendamentos + r.agendamentos,
          matriculas: acc.matriculas + r.matriculas,
        }),
        { users: 0, demandas: 0, demandas_abertas: 0, agendamentos: 0, matriculas: 0 },
      ),
    [rows],
  );

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Uso por tenant</h3>
          <p className="text-xs text-muted-foreground">
            Volume de usuários, demandas, agendamentos e matrículas por município.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard icon={Building2} label="Tenants" value={rows.length} />
        <SummaryCard icon={Users} label="Usuários" value={totals.users} />
        <SummaryCard icon={Activity} label="Demandas" value={totals.demandas} />
        <SummaryCard icon={Activity} label="Em aberto" value={totals.demandas_abertas} />
        <SummaryCard icon={FileText} label="Agendamentos" value={totals.agendamentos} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Município</TableHead>
                <TableHead className="text-right">Usuários</TableHead>
                <TableHead className="text-right">Demandas</TableHead>
                <TableHead className="text-right">Em aberto</TableHead>
                <TableHead className="text-right">Agendamentos</TableHead>
                <TableHead className="text-right">Matrículas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.tenant_id}>
                  <TableCell className="font-medium">{r.tenant_nome}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {r.users}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {r.demandas}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {r.demandas_abertas > 0 ? (
                      <Badge variant="secondary">{r.demandas_abertas}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {r.agendamentos}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {r.matriculas}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
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
