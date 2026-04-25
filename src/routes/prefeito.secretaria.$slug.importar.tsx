import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, Loader2, Check, X, FileSpreadsheet, FileText, FileType2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getSecretariaMeta } from "@/lib/secretarias-municipais";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/prefeito/secretaria/$slug/importar")({
  head: ({ params }) => ({
    meta: [{ title: `Importar dados — ${params.slug} — NovaeXis` }],
  }),
  component: ImportarPage,
});

interface MapeamentoIA {
  coluna_origem: string;
  indicador_destino: string;
  unidade: string;
  fator_conversao: number;
  exemplo_valor: string;
  confianca: "alta" | "media" | "baixa";
  observacao?: string;
}

interface AnaliseIA {
  total_linhas_estimado: number;
  periodo_detectado: string;
  confianca_analise: "alta" | "media" | "baixa";
  mapeamentos: MapeamentoIA[];
  colunas_nao_identificadas: string[];
  avisos: string[];
}

type Etapa = "upload" | "analise" | "revisao" | "processando" | "concluido";

function ImportarPage() {
  const { slug } = Route.useParams();
  const meta = getSecretariaMeta(slug);
  return (
    <RoleGuard
      allowed={["prefeito", "secretario", "superadmin"]}
      title="Importar dados"
      subtitle={meta?.nomeCompleto ?? slug}
    >
      <Wizard slug={slug} />
    </RoleGuard>
  );
}

function Wizard({ slug }: { slug: string }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const tenantId = profile?.tenant_id;
  const [etapa, setEtapa] = useState<Etapa>("upload");
  const [arquivoNome, setArquivoNome] = useState<string>("");
  const [storagePath, setStoragePath] = useState<string>("");
  const [analise, setAnalise] = useState<AnaliseIA | null>(null);
  const [mapeamentos, setMapeamentos] = useState<(MapeamentoIA & { acao: "pendente" | "confirmado" | "removido" })[]>([]);
  const [resultado, setResultado] = useState<{ salvos: number; ignorados: number; processados: number } | null>(null);

  const onDrop = useCallback(async (files: File[]) => {
    if (!tenantId) return;
    const file = files[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 25MB)");
      return;
    }
    setArquivoNome(file.name);
    setEtapa("analise");

    const path = `${tenantId}/${Date.now()}-${file.name}`;
    const upload = await supabase.storage.from("arquivos-importacao").upload(path, file);
    if (upload.error) {
      toast.error(`Falha no upload: ${upload.error.message}`);
      setEtapa("upload");
      return;
    }
    setStoragePath(path);

    const { data, error } = await supabase.functions.invoke("analisar-arquivo", {
      body: { storage_path: path, secretaria_slug: slug, tenant_id: tenantId, arquivo_nome: file.name },
    });
    if (error || !data) {
      toast.error(error?.message ?? "Falha na análise IA");
      setEtapa("upload");
      return;
    }
    const res = data as AnaliseIA;
    setAnalise(res);
    setMapeamentos(res.mapeamentos.map((m) => ({ ...m, acao: m.confianca === "baixa" ? "removido" : "pendente" })));
    setEtapa("revisao");
  }, [tenantId, slug]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
  });

  const confirmadosCount = mapeamentos.filter((m) => m.acao === "confirmado").length;
  const removidosCount = mapeamentos.filter((m) => m.acao === "removido").length;
  const interagiu = mapeamentos.some((m) => m.acao !== "pendente");
  const podeImportar = interagiu && confirmadosCount > 0;

  async function processar() {
    if (!tenantId) return;
    setEtapa("processando");
    const { data, error } = await supabase.functions.invoke("processar-importacao", {
      body: {
        storage_path: storagePath,
        tenant_id: tenantId,
        secretaria_slug: slug,
        periodo: analise?.periodo_detectado,
        mapeamentos_confirmados: mapeamentos.filter((m) => m.acao === "confirmado"),
      },
    });
    if (error || !data) {
      toast.error(error?.message ?? "Falha no processamento");
      setEtapa("revisao");
      return;
    }
    setResultado(data as { salvos: number; ignorados: number; processados: number });
    setEtapa("concluido");
  }

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-8">
      <div className="mb-4">
        <Link to="/prefeito/integracoes">
          <Button variant="ghost" size="sm" className="-ml-2">
            <ArrowLeft className="mr-1 h-4 w-4" /> Integrações
          </Button>
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-bold">Importar dados</h1>
        <Stepper etapa={etapa} />
      </header>

      {etapa === "upload" && (
        <Card
          {...getRootProps()}
          className={cn(
            "cursor-pointer border-2 border-dashed p-12 text-center transition-colors",
            isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
          )}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-base font-medium">
            {isDragActive ? "Solte o arquivo aqui" : "Arraste o arquivo ou clique para selecionar"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            .xlsx, .xls, .csv ou .pdf · máx 25MB
          </p>
          <div className="mt-4 flex items-center justify-center gap-3 text-muted-foreground">
            <FileSpreadsheet className="h-5 w-5" />
            <FileType2 className="h-5 w-5" />
            <FileText className="h-5 w-5" />
          </div>
        </Card>
      )}

      {etapa === "analise" && (
        <Card className="p-12 text-center">
          <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-primary" />
          <p className="text-base font-medium">Nossa IA está analisando o arquivo...</p>
          <p className="mt-1 text-sm text-muted-foreground">{arquivoNome}</p>
        </Card>
      )}

      {etapa === "revisao" && analise && (
        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-sm">
              <span className="font-semibold">Arquivo:</span> {arquivoNome}
              <span className="mx-2 text-border">·</span>
              <span className="font-semibold">{analise.total_linhas_estimado}</span> linhas
              <span className="mx-2 text-border">·</span>
              Período: <span className="font-semibold">{analise.periodo_detectado}</span>
              <span className="mx-2 text-border">·</span>
              Confiança: <Badge variant="outline">{analise.confianca_analise}</Badge>
            </p>
          </Card>

          {analise.avisos?.length > 0 && (
            <Card className="border-amber-500/40 bg-amber-500/5 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" /> Avisos da IA
              </p>
              <ul className="ml-5 list-disc space-y-1 text-sm">
                {analise.avisos.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </Card>
          )}

          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase">
                <tr>
                  <th className="px-3 py-2">Coluna do arquivo</th>
                  <th className="px-3 py-2">Indicador NovaeXis</th>
                  <th className="px-3 py-2">Unidade</th>
                  <th className="px-3 py-2">Exemplo</th>
                  <th className="px-3 py-2">Confiança</th>
                  <th className="px-3 py-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {mapeamentos.map((m, idx) => (
                  <tr key={idx} className={cn("border-t", m.acao === "removido" && "opacity-40")}>
                    <td className="px-3 py-2 font-medium">{m.coluna_origem}</td>
                    <td className="px-3 py-2 font-mono text-xs">{m.indicador_destino}</td>
                    <td className="px-3 py-2">{m.unidade}</td>
                    <td className="px-3 py-2 text-muted-foreground">{m.exemplo_valor}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={cn(
                        m.confianca === "alta" && "border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
                        m.confianca === "media" && "border-amber-500/30 text-amber-700 dark:text-amber-400",
                        m.confianca === "baixa" && "border-destructive/30 text-destructive",
                      )}>{m.confianca}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant={m.acao === "confirmado" ? "default" : "outline"}
                        className="mr-1"
                        onClick={() => setMapeamentos((prev) => prev.map((p, i) => i === idx ? { ...p, acao: "confirmado" } : p))}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant={m.acao === "removido" ? "destructive" : "outline"}
                        onClick={() => setMapeamentos((prev) => prev.map((p, i) => i === idx ? { ...p, acao: "removido" } : p))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {analise.colunas_nao_identificadas?.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Colunas ignoradas: {analise.colunas_nao_identificadas.join(", ")}
            </p>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {confirmadosCount} confirmados · {removidosCount} removidos · {analise.colunas_nao_identificadas?.length ?? 0} não identificadas
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEtapa("upload")}>Cancelar</Button>
              <Button disabled={!podeImportar} onClick={processar}>Confirmar e importar</Button>
            </div>
          </div>
        </div>
      )}

      {etapa === "processando" && (
        <Card className="p-12 text-center">
          <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-primary" />
          <p className="text-base font-medium">Processando importação...</p>
          <p className="mt-1 text-sm text-muted-foreground">Salvando indicadores no banco</p>
        </Card>
      )}

      {etapa === "concluido" && resultado && (
        <Card className="p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
          <h2 className="text-xl font-bold">Importação concluída!</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {resultado.processados} registros processados · <span className="font-semibold">{resultado.salvos} indicadores salvos</span>
            {resultado.ignorados > 0 && <> · {resultado.ignorados} linhas ignoradas</>}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={() => { setEtapa("upload"); setAnalise(null); setResultado(null); }}>
              Importar outro arquivo
            </Button>
            <Button onClick={() => navigate({ to: "/painel/secretaria/$slug", params: { slug } })}>
              Ver indicadores
            </Button>
          </div>
        </Card>
      )}
    </main>
  );
}

function Stepper({ etapa }: { etapa: Etapa }) {
  const steps: { key: Etapa; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "revisao", label: "Revisão IA" },
    { key: "processando", label: "Processamento" },
    { key: "concluido", label: "Concluído" },
  ];
  const currentIdx = steps.findIndex((s) =>
    etapa === "analise" ? s.key === "upload" : s.key === etapa
  );
  return (
    <ol className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
          <span className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold",
            i <= currentIdx ? "border-primary bg-primary text-primary-foreground" : "border-border",
          )}>{i + 1}</span>
          <span className={cn(i <= currentIdx && "text-foreground font-medium")}>{s.label}</span>
          {i < steps.length - 1 && <span className="mx-1">→</span>}
        </li>
      ))}
    </ol>
  );
}
