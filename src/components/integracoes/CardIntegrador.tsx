import { useState } from "react";
import { ChevronDown, ChevronRight, AlertCircle, CheckCircle2, Settings2, Upload, RefreshCcw, Eye, Copy, Power } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface IntegradorItem {
  id: string;
  tenant_id: string;
  secretaria_slug: string;
  nome: string;
  descricao: string | null;
  tipo: "api_rest" | "etl_agente" | "legado" | "importacao_manual";
  status: "ativo" | "inativo" | "erro" | "aguardando_configuracao";
  ultimo_sync: string | null;
  ultimo_erro: string | null;
  total_registros_importados: number;
}

export interface SyncLogItem {
  id: string;
  iniciado_at: string;
  concluido_at: string | null;
  status: "em_andamento" | "sucesso" | "erro" | "parcial";
  registros_processados: number;
  registros_salvos: number;
  registros_ignorados: number;
  duracao_ms: number | null;
  erro_mensagem: string | null;
}

interface Props {
  integrador: IntegradorItem;
  onVerErro: (i: IntegradorItem) => void;
  onImportar: (i: IntegradorItem) => void;
  onConfigurar?: (i: IntegradorItem) => void;
}

const STATUS_META: Record<IntegradorItem["status"], { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  ativo: { label: "Ativo", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", Icon: CheckCircle2 },
  erro: { label: "Erro", cls: "bg-destructive/15 text-destructive border-destructive/30", Icon: AlertCircle },
  inativo: { label: "Inativo", cls: "bg-muted text-muted-foreground border-border", Icon: Power },
  aguardando_configuracao: { label: "Configurar", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30", Icon: Settings2 },
};

const TIPO_LABEL: Record<IntegradorItem["tipo"], string> = {
  api_rest: "API REST",
  etl_agente: "ETL Agente",
  legado: "Legado",
  importacao_manual: "Manual",
};

export function CardIntegrador({ integrador, onVerErro, onImportar, onConfigurar }: Props) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<SyncLogItem[] | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const meta = STATUS_META[integrador.status];
  const StatusIcon = meta.Icon;

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && !logs) {
      setLoadingLogs(true);
      const { data, error } = await supabase
        .from("sync_logs")
        .select("id, iniciado_at, concluido_at, status, registros_processados, registros_salvos, registros_ignorados, duracao_ms, erro_mensagem")
        .eq("integrador_id", integrador.id)
        .order("iniciado_at", { ascending: false })
        .limit(5);
      if (error) toast.error("Erro ao carregar logs");
      setLogs((data ?? []) as SyncLogItem[]);
      setLoadingLogs(false);
    }
  }

  return (
    <div className={cn("rounded-lg border bg-card transition-colors", integrador.status === "erro" && "border-destructive/40")}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={toggleOpen} className="text-muted-foreground hover:text-foreground" aria-label="Expandir">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <StatusIcon className={cn("h-5 w-5 shrink-0",
          integrador.status === "ativo" && "text-emerald-600 dark:text-emerald-400",
          integrador.status === "erro" && "text-destructive",
          integrador.status === "aguardando_configuracao" && "text-blue-600 dark:text-blue-400",
          integrador.status === "inativo" && "text-muted-foreground",
        )} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{integrador.nome}</p>
            <Badge variant="outline" className={cn("text-[10px] uppercase", meta.cls)}>{meta.label}</Badge>
            <Badge variant="outline" className="text-[10px] uppercase">{TIPO_LABEL[integrador.tipo]}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {integrador.ultimo_sync
              ? `Último sync: ${formatDistanceToNow(new Date(integrador.ultimo_sync), { locale: ptBR, addSuffix: true })}`
              : "Nunca sincronizado"}
            {integrador.total_registros_importados > 0 && (
              <> · {integrador.total_registros_importados.toLocaleString("pt-BR")} registros</>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {integrador.status === "erro" && (
            <Button size="sm" variant="outline" onClick={() => onVerErro(integrador)}>
              <Eye className="mr-1 h-3.5 w-3.5" /> Ver erro
            </Button>
          )}
          {integrador.tipo === "importacao_manual" && (
            <Button size="sm" onClick={() => onImportar(integrador)}>
              <Upload className="mr-1 h-3.5 w-3.5" /> Importar
            </Button>
          )}
          {integrador.status === "aguardando_configuracao" && onConfigurar && (
            <Button size="sm" variant="outline" onClick={() => onConfigurar(integrador)}>
              <Settings2 className="mr-1 h-3.5 w-3.5" /> Configurar
            </Button>
          )}
          {integrador.status === "erro" && (
            <Button size="sm" variant="ghost" title="Tentar novamente">
              <RefreshCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t bg-muted/30 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Últimas execuções</p>
          {loadingLogs ? (
            <p className="text-xs text-muted-foreground">Carregando...</p>
          ) : !logs || logs.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem execuções registradas.</p>
          ) : (
            <ul className="space-y-1.5">
              {logs.map((log) => (
                <li key={log.id} className="flex items-center gap-3 rounded border bg-background px-2.5 py-1.5 text-xs">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      log.status === "sucesso" && "border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
                      log.status === "erro" && "border-destructive/30 text-destructive",
                      log.status === "parcial" && "border-amber-500/30 text-amber-700 dark:text-amber-400",
                    )}
                  >
                    {log.status}
                  </Badge>
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(log.iniciado_at), { locale: ptBR, addSuffix: true })}
                  </span>
                  <span>·</span>
                  <span>
                    {log.registros_salvos}/{log.registros_processados} salvos
                  </span>
                  {log.registros_ignorados > 0 && (
                    <span className="text-amber-600">· {log.registros_ignorados} ignorados</span>
                  )}
                  {log.duracao_ms && <span className="ml-auto text-muted-foreground">{(log.duracao_ms / 1000).toFixed(1)}s</span>}
                  {log.erro_mensagem && <span className="text-destructive truncate max-w-[280px]" title={log.erro_mensagem}>{log.erro_mensagem}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function ModalErroIntegrador({
  integrador,
  onClose,
}: {
  integrador: IntegradorItem | null;
  onClose: () => void;
}) {
  if (!integrador) return null;
  const erro = integrador.ultimo_erro ?? "Sem detalhes do erro disponíveis.";

  function copiar() {
    navigator.clipboard.writeText(erro);
    toast.success("Erro copiado para a área de transferência");
  }

  function abrirSuporte() {
    const subject = encodeURIComponent(`[NovaeXis] Erro no integrador ${integrador?.nome}`);
    const body = encodeURIComponent(`Integrador: ${integrador?.nome}\nSecretaria: ${integrador?.secretaria_slug}\n\nErro:\n${erro}`);
    window.location.href = `mailto:suporte@novaexis.com?subject=${subject}&body=${body}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-lg border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Detalhes do erro</h3>
            <p className="text-sm text-muted-foreground">{integrador.nome}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
        </div>
        <pre className="mb-4 max-h-80 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap break-words">
          {erro}
        </pre>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={copiar}>
            <Copy className="mr-1 h-3.5 w-3.5" /> Copiar erro
          </Button>
          <Button size="sm" onClick={abrirSuporte}>Abrir ticket de suporte</Button>
        </div>
      </div>
    </div>
  );
}
