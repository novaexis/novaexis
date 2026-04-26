import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";

const SUPABASE_PROJECT_REF = "xktjkdxgyjhxlvlgypgj";
const FUNCTION_NAME = "sync-siconfi";

export const Route = createFileRoute("/prefeito/kpis-siconfi/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria SICONFI — Prefeito — NovaeXis" },
      {
        name: "description",
        content:
          "Histórico de execuções da sincronização SICONFI: KPIs processados, salvos, ignorados e links para os logs detalhados.",
      },
    ],
  }),
  component: AuditoriaSiconfiPage,
});

interface SyncLogRow {
  id: string;
  iniciado_at: string;
  concluido_at: string | null;
  status: string;
  registros_processados: number;
  registros_salvos: number;
  registros_ignorados: number;
  duracao_ms: number | null;
  erro_mensagem: string | null;
  payload_size_kb: number | null;
  integrador_id: string;
}

function fmtData(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDuracao(ms: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "sucesso") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Sucesso
      </Badge>
    );
  }
  if (s === "parcial") {
    return (
      <Badge className="bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400">
        <AlertTriangle className="mr-1 h-3 w-3" />
        Parcial
      </Badge>
    );
  }
  if (s === "erro") {
    return (
      <Badge variant="destructive">
        <XCircle className="mr-1 h-3 w-3" />
        Erro
      </Badge>
    );
  }
  if (s === "em_andamento") {
    return (
      <Badge variant="secondary">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        Em andamento
      </Badge>
    );
  }
  return <Badge variant="outline">{status}</Badge>;
}

function AuditoriaSiconfiPage() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;
  const [logs, setLogs] = useState<SyncLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroJanela, setFiltroJanela] = useState<string>("90");
  const [detalhe, setDetalhe] = useState<SyncLogRow | null>(null);

  async function carregar() {
    if (!tenantId) return;
    setLoading(true);
    // Resolve o integrador sync-siconfi do tenant
    const { data: integ } = await supabase
      .from("integradores")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("nome", FUNCTION_NAME)
      .maybeSingle();

    if (!integ?.id) {
      setLogs([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("sync_logs")
      .select(
        "id, iniciado_at, concluido_at, status, registros_processados, registros_salvos, registros_ignorados, duracao_ms, erro_mensagem, payload_size_kb, integrador_id",
      )
      .eq("integrador_id", integ.id)
      .order("iniciado_at", { ascending: false })
      .limit(200);

    if (error) {
      toast.error("Erro ao carregar histórico");
      setLogs([]);
    } else {
      setLogs((data ?? []) as SyncLogRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const logsFiltrados = useMemo(() => {
    let r = logs;
    if (filtroStatus !== "todos") r = r.filter((l) => l.status === filtroStatus);
    if (filtroJanela !== "todos") {
      const dias = Number(filtroJanela);
      const corte = Date.now() - dias * 24 * 60 * 60 * 1000;
      r = r.filter((l) => new Date(l.iniciado_at).getTime() >= corte);
    }
    return r;
  }, [logs, filtroStatus, filtroJanela]);

  const resumo = useMemo(() => {
    const total = logsFiltrados.length;
    const sucesso = logsFiltrados.filter((l) => l.status === "sucesso").length;
    const parcial = logsFiltrados.filter((l) => l.status === "parcial").length;
    const erro = logsFiltrados.filter((l) => l.status === "erro").length;
    const totalProcessados = logsFiltrados.reduce((a, l) => a + (l.registros_processados ?? 0), 0);
    const totalSalvos = logsFiltrados.reduce((a, l) => a + (l.registros_salvos ?? 0), 0);
    const totalIgnorados = logsFiltrados.reduce((a, l) => a + (l.registros_ignorados ?? 0), 0);
    return { total, sucesso, parcial, erro, totalProcessados, totalSalvos, totalIgnorados };
  }, [logsFiltrados]);

  if (!tenantId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Faça login com um perfil vinculado a uma prefeitura para visualizar a auditoria.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/prefeito/kpis-siconfi">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Voltar
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Auditoria — sync-siconfi</h1>
            <p className="text-sm text-muted-foreground">
              Histórico de execuções da sincronização SICONFI deste tenant.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button asChild size="sm" variant="ghost">
            <a
              href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/functions/${FUNCTION_NAME}/logs`}
              target="_blank"
              rel="noreferrer"
            >
              Logs Supabase
              <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        </div>
      </header>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Execuções</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{resumo.total}</div>
            <div className="mt-1 flex flex-wrap gap-1 text-xs">
              <span className="text-emerald-600 dark:text-emerald-400">✓ {resumo.sucesso}</span>
              <span className="text-amber-600 dark:text-amber-400">⚠ {resumo.parcial}</span>
              <span className="text-rose-600 dark:text-rose-400">✕ {resumo.erro}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Processados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{resumo.totalProcessados.toLocaleString("pt-BR")}</div>
            <p className="mt-1 text-xs text-muted-foreground">KPIs lidos do SICONFI</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Inseridos / atualizados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
              {resumo.totalSalvos.toLocaleString("pt-BR")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Upserts bem-sucedidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Ignorados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-rose-600 dark:text-rose-400">
              {resumo.totalIgnorados.toLocaleString("pt-BR")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Falhas de upsert</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Status</label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="sucesso">Sucesso</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="erro">Erro</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Período</label>
            <Select value={filtroJanela} onValueChange={setFiltroJanela}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
                <SelectItem value="todos">Todo o histórico</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de execuções */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Execuções</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : logsFiltrados.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <ListChecks className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Nenhuma execução encontrada para os filtros atuais.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Início</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Processados</TableHead>
                    <TableHead className="text-right">Salvos</TableHead>
                    <TableHead className="text-right">Ignorados</TableHead>
                    <TableHead className="text-right">Duração</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsFiltrados.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs">{fmtData(l.iniciado_at)}</TableCell>
                      <TableCell>{statusBadge(l.status)}</TableCell>
                      <TableCell className="text-right text-xs font-medium">
                        {l.registros_processados.toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        {l.registros_salvos.toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell
                        className={`text-right text-xs font-medium ${
                          l.registros_ignorados > 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-muted-foreground"
                        }`}
                      >
                        {l.registros_ignorados.toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {fmtDuracao(l.duracao_ms)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDetalhe(l)}>
                          Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalhes */}
      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da execução</DialogTitle>
            <DialogDescription>
              Iniciada em {detalhe ? fmtData(detalhe.iniciado_at) : ""}
            </DialogDescription>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="mt-1">{statusBadge(detalhe.status)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Conclusão</div>
                  <div className="mt-1">{fmtData(detalhe.concluido_at)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Duração</div>
                  <div className="mt-1">{fmtDuracao(detalhe.duracao_ms)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Payload</div>
                  <div className="mt-1">
                    {detalhe.payload_size_kb != null ? `${detalhe.payload_size_kb} KB` : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Processados</div>
                  <div className="mt-1 font-medium">{detalhe.registros_processados}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Salvos / Ignorados</div>
                  <div className="mt-1 font-medium">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {detalhe.registros_salvos}
                    </span>
                    {" / "}
                    <span
                      className={
                        detalhe.registros_ignorados > 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-muted-foreground"
                      }
                    >
                      {detalhe.registros_ignorados}
                    </span>
                  </div>
                </div>
              </div>

              {detalhe.erro_mensagem && (
                <div>
                  <div className="text-xs text-muted-foreground">Mensagem / Alertas</div>
                  <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs">
                    {detalhe.erro_mensagem}
                  </pre>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button asChild size="sm" variant="outline">
                  <a
                    href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/functions/${FUNCTION_NAME}/logs`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver logs no Supabase
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link to="/prefeito/kpis-siconfi">Ver KPIs importados</Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
