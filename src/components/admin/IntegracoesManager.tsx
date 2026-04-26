import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";

type Integrador = {
  id: string;
  tenant_id: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  status: string;
  endpoint: string | null;
  ultimo_sync: string | null;
  ultimo_erro: string | null;
  total_registros_importados: number;
  secretaria_slug: string;
  tenant_nome?: string;
};

type SyncLog = {
  id: string;
  integrador_id: string;
  tenant_id: string;
  iniciado_at: string;
  concluido_at: string | null;
  status: string;
  registros_processados: number | null;
  registros_salvos: number | null;
  registros_ignorados: number | null;
  erro_mensagem: string | null;
  duracao_ms: number | null;
};

// Mapeia integrador.nome -> nome de edge function invocável.
// Por enquanto: sync-siconfi. Adicionar mais conforme criados.
const FUNCAO_POR_NOME: Record<string, string> = {
  "sync-siconfi": "sync-siconfi",
};

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    sucesso: { label: "Sucesso", variant: "default" },
    parcial: { label: "Parcial", variant: "secondary" },
    erro: { label: "Erro", variant: "destructive" },
    em_andamento: { label: "Em andamento", variant: "outline" },
    ativo: { label: "Ativo", variant: "default" },
    aguardando_configuracao: { label: "Aguardando", variant: "outline" },
  };
  const m = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

function statusIcon(status: string) {
  if (status === "sucesso") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "erro") return <XCircle className="h-4 w-4 text-destructive" />;
  if (status === "parcial") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  if (status === "em_andamento") return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuracao(ms: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function IntegracoesManager() {
  const [integradores, setIntegradores] = useState<Integrador[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [logDetalhe, setLogDetalhe] = useState<SyncLog | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [intRes, logRes] = await Promise.all([
        supabase
          .from("integradores")
          .select("*, tenants(nome)")
          .order("created_at", { ascending: false }),
        supabase
          .from("sync_logs")
          .select("*")
          .order("iniciado_at", { ascending: false })
          .limit(50),
      ]);
      if (intRes.error) throw intRes.error;
      if (logRes.error) throw logRes.error;
      setIntegradores(
        (intRes.data ?? []).map((i: Integrador & { tenants?: { nome: string } | null }) => ({
          ...i,
          tenant_nome: i.tenants?.nome ?? "—",
        })),
      );
      setLogs(logRes.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar integrações");
    } finally {
      setLoading(false);
    }
  }

  async function executar(integrador: Integrador) {
    const funcao = FUNCAO_POR_NOME[integrador.nome];
    if (!funcao) {
      toast.error(`Sem edge function mapeada para "${integrador.nome}"`);
      return;
    }
    setRunning(integrador.id);
    try {
      const { data, error } = await supabase.functions.invoke(funcao, {});
      if (error) throw error;
      const d = data as { salvos?: number; ignorados?: number; processados?: number } | null;
      toast.success(
        `${integrador.nome}: ${d?.salvos ?? 0} salvos / ${d?.ignorados ?? 0} ignorados (${d?.processados ?? 0} processados)`,
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Falha ao executar ${integrador.nome}`);
    } finally {
      setRunning(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Integrações externas</h2>
          <p className="text-sm text-muted-foreground">
            Status dos integradores configurados e histórico das últimas sincronizações.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* Integradores */}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Integradores ({integradores.length})</h3>
        {integradores.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum integrador cadastrado ainda. Execute uma edge function de sync (ex.
            sync-siconfi) para registrar o primeiro.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último sync</TableHead>
                <TableHead className="text-right">Registros</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {integradores.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    <div className="font-medium">{i.nome}</div>
                    {i.descricao && (
                      <div className="text-xs text-muted-foreground">{i.descricao}</div>
                    )}
                    {i.ultimo_erro && (
                      <div className="mt-1 text-xs text-destructive">⚠ {i.ultimo_erro}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{i.tenant_nome}</TableCell>
                  <TableCell>{statusBadge(i.status)}</TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {formatDateTime(i.ultimo_sync)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {i.total_registros_importados}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={running === i.id || !FUNCAO_POR_NOME[i.nome]}
                      onClick={() => void executar(i)}
                    >
                      {running === i.id ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="mr-2 h-3 w-3" />
                      )}
                      Executar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Histórico de execuções */}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">
          Histórico de execuções (últimas 50)
        </h3>
        {logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma execução registrada ainda.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Início</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Processados</TableHead>
                <TableHead className="text-right">Salvos</TableHead>
                <TableHead className="text-right">Ignorados</TableHead>
                <TableHead className="text-right">Duração</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{statusIcon(l.status)}</TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {formatDateTime(l.iniciado_at)}
                  </TableCell>
                  <TableCell>{statusBadge(l.status)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {l.registros_processados ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    {l.registros_salvos ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-destructive">
                    {l.registros_ignorados ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatDuracao(l.duracao_ms)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setLogDetalhe(l)}>
                      Detalhes
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Modal de detalhes */}
      <Dialog open={!!logDetalhe} onOpenChange={(o) => !o && setLogDetalhe(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da execução</DialogTitle>
          </DialogHeader>
          {logDetalhe && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Iniciado</p>
                  <p className="font-mono">{formatDateTime(logDetalhe.iniciado_at)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Concluído</p>
                  <p className="font-mono">{formatDateTime(logDetalhe.concluido_at)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Status</p>
                  <div>{statusBadge(logDetalhe.status)}</div>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Duração</p>
                  <p className="font-mono">{formatDuracao(logDetalhe.duracao_ms)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Processados</p>
                  <p className="font-mono">{logDetalhe.registros_processados ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Salvos</p>
                  <p className="font-mono text-emerald-600 dark:text-emerald-400">
                    {logDetalhe.registros_salvos ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Ignorados</p>
                  <p className="font-mono text-destructive">
                    {logDetalhe.registros_ignorados ?? "—"}
                  </p>
                </div>
              </div>
              {logDetalhe.erro_mensagem && (
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Mensagem de erro</p>
                  <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-3 text-xs">
                    {logDetalhe.erro_mensagem}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
