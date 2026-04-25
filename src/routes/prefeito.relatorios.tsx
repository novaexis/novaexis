import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  FileText,
  Loader2,
  Printer,
  Download,
  Eye,
  Sparkles,
  Trash2,
} from "lucide-react";
import { gerarRelatorioHTML, type RelatorioInput } from "@/lib/relatorio-html";

export const Route = createFileRoute("/prefeito/relatorios")({
  head: () => ({
    meta: [{ title: "Relatórios — Prefeito — NovaeXis" }],
  }),
  component: RelatoriosPage,
});

interface RelatorioRow {
  id: string;
  titulo: string;
  periodo_inicio: string;
  periodo_fim: string;
  storage_path: string | null;
  resumo_executivo: string | null;
  created_at: string;
}

function RelatoriosPage() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [rows, setRows] = useState<RelatorioRow[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    void load(tenantId);
  }, [tenantId]);

  async function load(tid: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from("relatorios_executivos")
      .select("id, titulo, periodo_inicio, periodo_fim, storage_path, resumo_executivo, created_at")
      .eq("tenant_id", tid)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) toast.error("Erro ao carregar relatórios");
    setRows((data ?? []) as RelatorioRow[]);
    setLoading(false);
  }

  async function gerarRelatorio() {
    if (!tenantId || !profile) return;
    setGerando(true);
    try {
      const fim = new Date();
      const inicio = new Date();
      inicio.setDate(inicio.getDate() - 30);
      const fimISO = fim.toISOString().slice(0, 10);
      const inicioISO = inicio.toISOString().slice(0, 10);

      const [tenant, kpis, alertas, scores, briefing] = await Promise.all([
        supabase.from("tenants").select("nome, populacao").eq("id", tenantId).maybeSingle(),
        supabase
          .from("kpis")
          .select("secretaria_slug, indicador, valor, unidade, variacao_pct, status, referencia_data")
          .eq("tenant_id", tenantId)
          .gte("referencia_data", inicioISO)
          .order("referencia_data", { ascending: false })
          .limit(80),
        supabase
          .from("alertas_prazos")
          .select("titulo, status, prazo, valor_estimado, tipo")
          .eq("tenant_id", tenantId)
          .order("prazo", { ascending: true })
          .limit(20),
        supabase
          .from("scores_aprovacao")
          .select("data, score, total_mencoes")
          .eq("tenant_id", tenantId)
          .order("data", { ascending: false })
          .limit(7),
        supabase
          .from("briefings_semanais")
          .select("destaques, alertas, recomendacoes, conteudo_markdown")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const briefingResumo = briefing.data
        ? {
            resumo: extrairResumoMd(briefing.data.conteudo_markdown),
            destaques: (briefing.data.destaques as []) ?? [],
            alertas: (briefing.data.alertas as []) ?? [],
            recomendacoes: (briefing.data.recomendacoes as []) ?? [],
          }
        : null;

      const input: RelatorioInput = {
        municipio: tenant.data?.nome ?? "Município",
        periodoInicio: inicioISO,
        periodoFim: fimISO,
        populacao: tenant.data?.populacao ?? null,
        kpis: (kpis.data ?? []) as RelatorioInput["kpis"],
        alertas: (alertas.data ?? []) as RelatorioInput["alertas"],
        scores: (scores.data ?? []) as RelatorioInput["scores"],
        briefing: briefingResumo,
      };

      const html = gerarRelatorioHTML(input);

      // Upload no Storage
      const filename = `${tenantId}/${fimISO}-${Date.now()}.html`;
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const { error: upErr } = await supabase.storage
        .from("relatorios")
        .upload(filename, blob, { contentType: "text/html", upsert: false });
      if (upErr) throw upErr;

      // Persiste registro
      const { error: insErr } = await supabase.from("relatorios_executivos").insert({
        tenant_id: tenantId,
        periodo_inicio: inicioISO,
        periodo_fim: fimISO,
        titulo: `Relatório ${new Date(inicioISO).toLocaleDateString("pt-BR")} – ${new Date(fimISO).toLocaleDateString("pt-BR")}`,
        storage_path: filename,
        resumo_executivo: briefingResumo?.resumo ?? null,
        gerado_por: profile.id,
      });
      if (insErr) throw insErr;

      toast.success("Relatório gerado");
      await load(tenantId);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erro ao gerar relatório");
    } finally {
      setGerando(false);
    }
  }

  async function abrirRelatorio(path: string, imprimir = false) {
    try {
      // Baixa o arquivo do Storage e renderiza como HTML via Blob URL
      // (evita que o navegador trate a URL assinada como download/texto)
      const { data, error } = await supabase.storage.from("relatorios").download(path);
      if (error || !data) {
        toast.error("Erro ao abrir relatório");
        return;
      }
      const text = await data.text();
      const htmlBlob = new Blob([text], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(htmlBlob);

      const w = window.open(url, "_blank");
      if (!w) {
        toast.error("Permita pop-ups para abrir o relatório");
        URL.revokeObjectURL(url);
        return;
      }
      if (imprimir) {
        w.addEventListener("load", () => {
          setTimeout(() => {
            try {
              w.focus();
              w.print();
            } catch {
              /* ignore */
            }
          }, 500);
        });
      }
      // Libera o blob após algum tempo
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao abrir relatório");
    }
  }

  async function excluirRelatorio(id: string, path: string | null) {
    if (!confirm("Excluir este relatório? Esta ação não pode ser desfeita.")) return;
    try {
      if (path) {
        const { error: stErr } = await supabase.storage.from("relatorios").remove([path]);
        if (stErr) throw stErr;
      }
      const { error: dbErr } = await supabase
        .from("relatorios_executivos")
        .delete()
        .eq("id", id);
      if (dbErr) throw dbErr;
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success("Relatório excluído");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erro ao excluir relatório");
    }
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Relatórios executivos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Snapshots consolidados do município, prontos para apresentar
          </p>
        </div>
        <Button onClick={gerarRelatorio} disabled={gerando} className="gap-2">
          {gerando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Gerar relatório agora
        </Button>
      </header>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-12 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhum relatório gerado ainda. Clique em "Gerar relatório agora".
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <p className="truncate font-medium">{r.titulo}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Gerado em{" "}
                  {new Date(r.created_at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {r.resumo_executivo && (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                    {r.resumo_executivo}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {r.storage_path && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirRelatorio(r.storage_path!, false)}
                      className="gap-2"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ver
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => abrirRelatorio(r.storage_path!, true)}
                      className="gap-2"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Imprimir / PDF
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => excluirRelatorio(r.id, r.storage_path)}
                  className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Excluir relatório"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        <Download className="mr-1 inline h-3 w-3" />
        Para salvar como PDF, clique em "Imprimir / PDF" e escolha "Salvar como PDF" no destino do navegador.
      </p>
    </div>
  );
}

function extrairResumoMd(md: string): string {
  const m = md.match(/##\s+Resumo executivo\s*\n+([^\n#]+)/i);
  return m?.[1]?.trim() ?? "";
}
