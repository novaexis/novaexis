import { useEffect, useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";

interface RelatorioItem {
  id: string;
  titulo: string;
  periodo_inicio: string;
  periodo_fim: string;
  storage_path: string | null;
  created_at: string;
}

interface TabRelatoriosProps {
  slug: string;
  nomeSecretaria: string;
  canEdit: boolean;
}

export function TabRelatorios({ slug, nomeSecretaria, canEdit }: TabRelatoriosProps) {
  const { profile } = useAuth();
  const [periodo, setPeriodo] = useState("mes");
  const [relatorios, setRelatorios] = useState<RelatorioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);

  async function load() {
    if (!profile?.tenant_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("relatorios_executivos")
      .select("id, titulo, periodo_inicio, periodo_fim, storage_path, created_at")
      .eq("tenant_id", profile.tenant_id)
      .ilike("titulo", `%${slug}%`)
      .order("created_at", { ascending: false })
      .limit(20);
    setRelatorios((data ?? []) as RelatorioItem[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.tenant_id, slug]);

  async function gerar() {
    if (!profile?.tenant_id) return;
    setGerando(true);
    const fim = new Date();
    const inicio = new Date();
    if (periodo === "semana") inicio.setDate(inicio.getDate() - 7);
    else if (periodo === "mes") inicio.setMonth(inicio.getMonth() - 1);
    else inicio.setMonth(inicio.getMonth() - 3);

    const { error } = await supabase.from("relatorios_executivos").insert({
      tenant_id: profile.tenant_id,
      titulo: `Relatório ${nomeSecretaria} (${slug}) — ${periodo}`,
      periodo_inicio: format(inicio, "yyyy-MM-dd"),
      periodo_fim: format(fim, "yyyy-MM-dd"),
      gerado_por: profile.id,
      resumo_executivo: `Relatório do período ${format(inicio, "dd/MM/yyyy")} a ${format(fim, "dd/MM/yyyy")}.`,
    });
    setGerando(false);
    if (error) {
      toast.error("Erro ao gerar relatório: " + error.message);
      return;
    }
    toast.success("Relatório gerado");
    await load();
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs uppercase text-muted-foreground">
              Período
            </label>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semana">Última semana</SelectItem>
                <SelectItem value="mes">Último mês</SelectItem>
                <SelectItem value="trimestre">Último trimestre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => void gerar()} disabled={gerando || !canEdit}>
            {gerando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <FileText className="mr-2 h-4 w-4" /> Gerar relatório do período
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Relatórios anteriores</h3>
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : relatorios.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum relatório gerado ainda. Use o botão acima para criar o primeiro.
          </p>
        ) : (
          <ul className="space-y-2">
            {relatorios.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{r.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(r.periodo_inicio), "dd/MM/yyyy", { locale: ptBR })} —{" "}
                      {format(new Date(r.periodo_fim), "dd/MM/yyyy", { locale: ptBR })} · gerado em{" "}
                      {format(new Date(r.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                {r.storage_path && (
                  <Button variant="ghost" size="sm">
                    <Download className="mr-1 h-4 w-4" /> Baixar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
