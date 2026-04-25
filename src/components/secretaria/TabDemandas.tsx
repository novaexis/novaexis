import { useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Eye, Loader2, MessageSquarePlus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { StatusBadge } from "@/components/StatusBadge";
import { KPICard } from "@/components/KPICard";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { DemandaSecretaria } from "@/hooks/useSecretaria";

const STATUS_FLOW = ["aberta", "em_analise", "em_andamento", "concluida"] as const;
type Status = (typeof STATUS_FLOW)[number];

interface TabDemandasProps {
  demandas: DemandaSecretaria[];
  canEdit: boolean;
  onChanged: () => void | Promise<void>;
}

export function TabDemandas({ demandas, canEdit, onChanged }: TabDemandasProps) {
  const { profile } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("todas");
  const [prioFilter, setPrioFilter] = useState<string>("todas");
  const [periodoFilter, setPeriodoFilter] = useState<string>("90");
  const [busca, setBusca] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<DemandaSecretaria | null>(null);
  const [observacao, setObservacao] = useState("");
  const [savingObs, setSavingObs] = useState(false);

  const filtered = useMemo(() => {
    const now = Date.now();
    const periodoMs =
      periodoFilter === "1" ? 86400000
        : periodoFilter === "7" ? 7 * 86400000
          : periodoFilter === "30" ? 30 * 86400000
            : 90 * 86400000;
    const lower = busca.toLowerCase().trim();
    return demandas.filter((d) => {
      if (statusFilter !== "todas" && d.status !== statusFilter) return false;
      if (prioFilter !== "todas" && d.prioridade !== prioFilter) return false;
      const idade = now - new Date(d.created_at).getTime();
      if (idade > periodoMs) return false;
      if (lower) {
        if (
          !d.protocolo.toLowerCase().includes(lower) &&
          !d.titulo.toLowerCase().includes(lower) &&
          !(d.descricao ?? "").toLowerCase().includes(lower)
        ) return false;
      }
      return true;
    });
  }, [demandas, statusFilter, prioFilter, periodoFilter, busca]);

  const metricas = useMemo(() => {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const abertas = demandas.filter((d) => d.status !== "concluida").length;
    const vencidas = demandas.filter(
      (d) => d.status !== "concluida" && d.prazo_sla && new Date(d.prazo_sla).getTime() < now,
    ).length;
    const concluidasHoje = demandas.filter(
      (d) => d.status === "concluida" && new Date(d.updated_at).getTime() >= todayStart.getTime(),
    ).length;
    const tempos = demandas
      .filter((d) => d.status === "concluida")
      .map((d) => new Date(d.updated_at).getTime() - new Date(d.created_at).getTime());
    const tempoMedio = tempos.length
      ? tempos.reduce((a, b) => a + b, 0) / tempos.length / 86400000
      : 0;
    return { abertas, vencidas, concluidasHoje, tempoMedio: tempoMedio.toFixed(1) };
  }, [demandas]);

  async function atualizarStatus(d: DemandaSecretaria, novo: Status) {
    if (!profile) return;
    setUpdating(d.id);
    const anterior = d.status;
    const { error } = await supabase
      .from("demandas")
      .update({ status: novo })
      .eq("id", d.id);
    if (error) {
      toast.error("Erro ao atualizar status: " + error.message);
      setUpdating(null);
      return;
    }
    await supabase.from("demanda_historico").insert({
      tenant_id: profile.tenant_id!,
      demanda_id: d.id,
      status_anterior: anterior,
      status_novo: novo,
      usuario_id: profile.id,
    });
    toast.success("Status atualizado e cidadão notificado");
    setUpdating(null);
    await onChanged();
  }

  async function salvarObservacao() {
    if (!detalhe || !profile || !observacao.trim()) return;
    setSavingObs(true);
    const { error } = await supabase.from("demanda_historico").insert({
      tenant_id: profile.tenant_id!,
      demanda_id: detalhe.id,
      status_anterior: detalhe.status,
      status_novo: detalhe.status,
      observacao: observacao.trim(),
      usuario_id: profile.id,
    });
    setSavingObs(false);
    if (error) {
      toast.error("Erro ao salvar observação: " + error.message);
      return;
    }
    toast.success("Observação registrada");
    setObservacao("");
    setDetalhe(null);
    await onChanged();
  }

  function isVencida(d: DemandaSecretaria): boolean {
    if (d.status === "concluida") return false;
    return Boolean(d.prazo_sla && new Date(d.prazo_sla).getTime() < Date.now());
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard titulo="Abertas" valor={metricas.abertas} status="info" />
        <KPICard
          titulo="Vencidas SLA"
          valor={metricas.vencidas}
          status={metricas.vencidas > 0 ? "critico" : "ok"}
        />
        <KPICard titulo="Concluídas hoje" valor={metricas.concluidasHoje} status="ok" />
        <KPICard
          titulo="Tempo médio (dias)"
          valor={metricas.tempoMedio}
          status="atencao"
        />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar protocolo ou descrição"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos status</SelectItem>
              <SelectItem value="aberta">Abertas</SelectItem>
              <SelectItem value="em_analise">Em análise</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="concluida">Concluídas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={prioFilter} onValueChange={setPrioFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Toda prioridade</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Hoje</SelectItem>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Protocolo</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Cidadão</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Abertura</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhuma demanda encontrada com os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((d) => {
                  const vencida = isVencida(d);
                  const urgente = d.prioridade === "urgente";
                  return (
                    <TableRow
                      key={d.id}
                      className={cn(vencida && "bg-destructive/5 hover:bg-destructive/10")}
                    >
                      <TableCell className="font-mono text-xs">#{d.protocolo}</TableCell>
                      <TableCell className="max-w-[200px] truncate font-medium">{d.titulo}</TableCell>
                      <TableCell className="text-sm">{d.cidadao_nome}</TableCell>
                      <TableCell>
                        <span className={cn("inline-flex", urgente && "animate-pulse")}>
                          <StatusBadge status={d.prioridade} />
                        </span>
                      </TableCell>
                      <TableCell><StatusBadge status={d.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(d.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        {vencida && (
                          <div className="mt-0.5 inline-flex items-center gap-1 text-destructive">
                            <AlertTriangle className="h-3 w-3" /> SLA vencido
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          {canEdit && (
                            <Select
                              value={d.status}
                              onValueChange={(v) => void atualizarStatus(d, v as Status)}
                              disabled={updating === d.id}
                            >
                              <SelectTrigger className="h-8 w-[140px]">
                                {updating === d.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : <SelectValue />}
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_FLOW.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    <StatusBadge status={s} />
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setDetalhe(d)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Demanda #{detalhe?.protocolo}</DialogTitle>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Título</p>
                <p className="font-medium">{detalhe.titulo}</p>
              </div>
              {detalhe.descricao && (
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Descrição</p>
                  <p>{detalhe.descricao}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Status</p>
                  <StatusBadge status={detalhe.status} />
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Prioridade</p>
                  <StatusBadge status={detalhe.prioridade} />
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Cidadão</p>
                  <p>{detalhe.cidadao_nome}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Abertura</p>
                  <p>{format(new Date(detalhe.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                </div>
                {detalhe.endereco && (
                  <div className="col-span-2">
                    <p className="text-xs uppercase text-muted-foreground">Endereço</p>
                    <p>{detalhe.endereco}</p>
                  </div>
                )}
              </div>
              {canEdit && (
                <div className="border-t pt-3">
                  <label className="mb-1 flex items-center gap-1 text-xs uppercase text-muted-foreground">
                    <MessageSquarePlus className="h-3 w-3" /> Adicionar observação
                  </label>
                  <Textarea
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="Anotação interna sobre esta demanda…"
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetalhe(null)}>Fechar</Button>
            {canEdit && (
              <Button
                onClick={() => void salvarObservacao()}
                disabled={!observacao.trim() || savingObs}
              >
                {savingObs && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar observação
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
